import { describe, it, expect, afterEach } from 'vitest';
import { frame, unframe, MllpServer, MllpClient, MLLP_VT, MLLP_FS, MLLP_CR } from '../mllp/index.js';

const SAMPLE_MSG =
  'MSH|^~\\&|SEND|FAC|RECV|RFAC|20240101120000||ADT^A01|MSG001|P|2.5.1\r' +
  'PID|1|||DOE^JOHN';

const SAMPLE_ACK =
  'MSH|^~\\&|RECV|RFAC|SEND|FAC|20240101120001||ACK|ACK001|P|2.5.1\r' +
  'MSA|AA|MSG001';

// ─── frame / unframe ─────────────────────────────────────────────────────────

describe('frame', () => {
  it('begins with the VT byte', () => {
    const buf = frame(SAMPLE_MSG);
    expect(buf[0]).toBe(MLLP_VT);
  });

  it('ends with FS then CR', () => {
    const buf = frame(SAMPLE_MSG);
    expect(buf[buf.length - 2]).toBe(MLLP_FS);
    expect(buf[buf.length - 1]).toBe(MLLP_CR);
  });

  it('preserves message content between the control bytes', () => {
    const buf = frame(SAMPLE_MSG);
    const content = buf.subarray(1, buf.length - 2).toString('utf8');
    expect(content).toBe(SAMPLE_MSG);
  });

  it('round-trips through unframe', () => {
    const { messages } = unframe(frame(SAMPLE_MSG));
    expect(messages).toStrictEqual([SAMPLE_MSG]);
  });
});

describe('unframe', () => {
  it('extracts a single framed message', () => {
    const { messages, remainder } = unframe(frame(SAMPLE_MSG));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(SAMPLE_MSG);
    expect(remainder.length).toBe(0);
  });

  it('extracts two consecutive messages from a single buffer', () => {
    const buf = Buffer.concat([frame(SAMPLE_MSG), frame(SAMPLE_ACK)]);
    const { messages, remainder } = unframe(buf);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toBe(SAMPLE_MSG);
    expect(messages[1]).toBe(SAMPLE_ACK);
    expect(remainder.length).toBe(0);
  });

  it('returns the partial frame as remainder when the buffer is incomplete', () => {
    const complete = frame(SAMPLE_MSG);
    const partial = complete.subarray(0, complete.length - 4);
    const { messages, remainder } = unframe(partial);
    expect(messages).toHaveLength(0);
    expect(remainder.length).toBeGreaterThan(0);
  });

  it('handles empty buffer without error', () => {
    const { messages, remainder } = unframe(Buffer.alloc(0));
    expect(messages).toHaveLength(0);
    expect(remainder.length).toBe(0);
  });

  it('discards bytes with no VT start byte as protocol garbage', () => {
    const { messages, remainder } = unframe(Buffer.from('no framing here'));
    expect(messages).toHaveLength(0);
    expect(remainder.length).toBe(0);
  });

  it('re-assembles a message split across two buffers', () => {
    const complete = frame(SAMPLE_MSG);
    const half = Math.floor(complete.length / 2);
    const firstChunk = complete.subarray(0, half);
    const secondChunk = complete.subarray(half);

    const first = unframe(firstChunk);
    expect(first.messages).toHaveLength(0);

    const combined = Buffer.concat([first.remainder, secondChunk]);
    const { messages } = unframe(combined);
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBe(SAMPLE_MSG);
  });
});

// ─── MllpServer + MllpClient integration ─────────────────────────────────────

describe('MllpServer + MllpClient', () => {
  let server: MllpServer | undefined;
  let client: MllpClient | undefined;

  afterEach(async () => {
    await client?.close();
    await server?.close();
    client = undefined;
    server = undefined;
  });

  it('sends a message and receives an ACK', async () => {
    server = new MllpServer({ port: 0 });
    server.on('message', (_raw, ack) => { ack(SAMPLE_ACK); });
    await server.listen();

    const { port } = server.address!;
    client = new MllpClient({ host: '127.0.0.1', port });
    await client.connect();

    const ack = await client.send(SAMPLE_MSG);
    expect(ack).toBe(SAMPLE_ACK);
  });

  it('server emits the exact raw string sent by the client', async () => {
    let received = '';
    server = new MllpServer({ port: 0 });
    server.on('message', (raw, ack) => { received = raw; ack(SAMPLE_ACK); });
    await server.listen();

    const { port } = server.address!;
    client = new MllpClient({ host: '127.0.0.1', port });
    await client.connect();

    await client.send(SAMPLE_MSG);
    expect(received).toBe(SAMPLE_MSG);
  });

  it('handles multiple sequential sends on the same connection', async () => {
    server = new MllpServer({ port: 0 });
    server.on('message', (_raw, ack) => { ack(SAMPLE_ACK); });
    await server.listen();

    const { port } = server.address!;
    client = new MllpClient({ host: '127.0.0.1', port });
    await client.connect();

    const ack1 = await client.send(SAMPLE_MSG);
    const ack2 = await client.send(SAMPLE_MSG);
    expect(ack1).toBe(SAMPLE_ACK);
    expect(ack2).toBe(SAMPLE_ACK);
  });

  it('connect() on an already-open client is a no-op', async () => {
    server = new MllpServer({ port: 0 });
    server.on('message', (_raw, ack) => { ack(SAMPLE_ACK); });
    await server.listen();

    const { port } = server.address!;
    client = new MllpClient({ host: '127.0.0.1', port });
    await client.connect();
    await client.connect(); // second call should not throw

    const ack = await client.send(SAMPLE_MSG);
    expect(ack).toBe(SAMPLE_ACK);
  });

  it('rejects send() when called before connect()', async () => {
    client = new MllpClient({ host: '127.0.0.1', port: 9_999 });
    await expect(client.send(SAMPLE_MSG)).rejects.toThrow(/not connected/i);
  });

  it('server.address is null before listen()', () => {
    // Use a local variable — server is never started, close() is a no-op
    const s = new MllpServer({ port: 0 });
    expect(s.address).toBeNull();
  });

  it('server.address is populated after listen()', async () => {
    server = new MllpServer({ port: 0 });
    await server.listen();
    const addr = server.address;
    expect(addr).not.toBeNull();
    expect(addr?.port).toBeGreaterThan(0);
  });
});
