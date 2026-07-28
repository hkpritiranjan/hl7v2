/**
 * @pritiranjan/hl7v2/mllp
 *
 * Minimal Lower Layer Protocol (MLLP) transport for HL7 v2 — Node.js only.
 *
 * MLLP is the standard TCP framing protocol for HL7 v2 in clinical environments.
 * Every byte of an HL7 message is wrapped in a three-byte envelope:
 *   <VT> message_bytes <FS><CR>
 * where VT = 0x0B, FS = 0x1C, CR = 0x0D.
 *
 * @example Server — receive messages, send ACKs
 * ```ts
 * import { MllpServer } from '@pritiranjan/hl7v2/mllp'
 * import { parse, createAck } from '@pritiranjan/hl7v2'
 *
 * const server = new MllpServer({ port: 2575 })
 * server.on('message', (raw, ack) => {
 *   const msg = parse(raw)
 *   ack(createAck(msg, 'AA'))
 * })
 * await server.listen()
 * ```
 *
 * @example Client — send a message, wait for ACK
 * ```ts
 * import { MllpClient } from '@pritiranjan/hl7v2/mllp'
 * import { encode } from '@pritiranjan/hl7v2'
 *
 * const client = new MllpClient({ host: '10.0.0.1', port: 2575 })
 * await client.connect()
 * const ack = await client.send(encode(msg))
 * await client.close()
 * ```
 */

import { EventEmitter } from 'node:events';
import net from 'node:net';

/** MLLP start-of-block byte (Vertical Tab, 0x0B). */
export const MLLP_VT = 0x0b;
/** MLLP end-of-block byte (File Separator, 0x1C). */
export const MLLP_FS = 0x1c;
/** MLLP end-of-block terminator byte (Carriage Return, 0x0D). */
export const MLLP_CR = 0x0d;

/**
 * Wrap an HL7 message string in an MLLP frame.
 *
 * @example
 * const buf = frame(encode(msg))
 * socket.write(buf)
 */
export function frame(message: string): Buffer {
  return Buffer.concat([
    Buffer.from([MLLP_VT]),
    Buffer.from(message, 'utf8'),
    Buffer.from([MLLP_FS, MLLP_CR]),
  ]);
}

/**
 * Extract complete HL7 messages from a raw TCP buffer.
 *
 * TCP is a stream — a single `data` event may contain partial frames,
 * complete frames, or multiple frames. Use `remainder` to preserve any
 * bytes that belong to the next (incomplete) frame.
 *
 * @returns `{ messages, remainder }` — complete HL7 strings and trailing bytes.
 *
 * @example
 * let buf = Buffer.alloc(0)
 * socket.on('data', chunk => {
 *   buf = Buffer.concat([buf, chunk])
 *   const { messages, remainder } = unframe(buf)
 *   buf = remainder
 *   for (const raw of messages) handle(raw)
 * })
 */
export function unframe(buffer: Buffer): { messages: string[]; remainder: Buffer } {
  const messages: string[] = [];
  let pos = 0;

  while (pos < buffer.length) {
    // Locate the start-of-block marker
    const vtPos = buffer.indexOf(MLLP_VT, pos);
    // No start-of-block marker found — trailing bytes are protocol garbage, discard.
    if (vtPos === -1) return { messages, remainder: Buffer.alloc(0) };

    // Locate the end-of-block marker (FS must be followed by CR)
    let fsPos = buffer.indexOf(MLLP_FS, vtPos + 1);
    while (fsPos !== -1) {
      if (buffer[fsPos + 1] === MLLP_CR) break;
      fsPos = buffer.indexOf(MLLP_FS, fsPos + 1);
    }

    // Incomplete frame — return everything from the VT as remainder
    if (fsPos === -1) return { messages, remainder: buffer.subarray(vtPos) };

    messages.push(buffer.subarray(vtPos + 1, fsPos).toString('utf8'));
    pos = fsPos + 2; // skip FS + CR
  }

  return { messages, remainder: Buffer.alloc(0) };
}

// ─── MllpServer ──────────────────────────────────────────────────────────────

export interface MllpServerOptions {
  /** TCP port to listen on. Pass `0` to let the OS pick a free port. */
  port: number;
  /** Network interface to bind. Defaults to all interfaces (`'::'`). */
  host?: string;
  /**
   * Milliseconds of inactivity before a client socket is forcibly closed.
   * `0` = disabled (default).
   */
  socketTimeout?: number;
}

/** Callback used to send an MLLP-framed response back to the connected client. */
export type AckFn = (response: string) => void;

/** Typed event declarations for {@link MllpServer}. */
export declare interface MllpServer {
  /** Emitted for each complete, decoded HL7 message received over TCP. */
  on(event: 'message', listener: (raw: string, ack: AckFn) => void): this;
  /** Emitted when a new TCP connection is accepted. */
  on(event: 'connection', listener: (socket: net.Socket) => void): this;
  /** Emitted for socket-level or server-level errors. */
  on(event: 'error', listener: (err: Error) => void): this;
  /** Emitted once the server is bound and ready to accept connections. */
  on(event: 'listening', listener: () => void): this;
  on(event: string, listener: (...args: unknown[]) => void): this;

  emit(event: 'message', raw: string, ack: AckFn): boolean;
  emit(event: 'connection', socket: net.Socket): boolean;
  emit(event: 'error', err: Error): boolean;
  emit(event: 'listening'): boolean;
  emit(event: string, ...args: unknown[]): boolean;
}

/**
 * Minimal MLLP TCP server.
 *
 * Listens for inbound MLLP-framed HL7 messages, decodes each frame, and emits
 * a `'message'` event with the raw HL7 string and an `ack` function.
 * Call `ack(response)` to send the MLLP-framed reply back to the client.
 *
 * Multiple simultaneous client connections are supported; each connection
 * maintains its own receive buffer.
 *
 * @example
 * import { parse, createAck } from '@pritiranjan/hl7v2'
 * import { MllpServer } from '@pritiranjan/hl7v2/mllp'
 *
 * const server = new MllpServer({ port: 2575 })
 *
 * server.on('message', (raw, ack) => {
 *   const msg = parse(raw)
 *   console.log('Received', msg.messageType.type, msg.messageControlId)
 *   ack(createAck(msg, 'AA'))
 * })
 *
 * server.on('error', err => console.error('MLLP error:', err))
 * await server.listen()
 * console.log(`Listening on port ${server.address?.port}`)
 */
export class MllpServer extends EventEmitter {
  private readonly server: net.Server;

  constructor(private readonly options: MllpServerOptions) {
    super();
    this.server = net.createServer((socket) => { this.handleSocket(socket); });
    this.server.on('error', (err) => { this.emit('error', err); });
  }

  private handleSocket(socket: net.Socket): void {
    this.emit('connection', socket);

    if (this.options.socketTimeout) {
      socket.setTimeout(this.options.socketTimeout, () => { socket.destroy(); });
    }

    let buffer: Buffer = Buffer.alloc(0);

    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const { messages, remainder } = unframe(buffer);
      buffer = remainder;

      for (const raw of messages) {
        const ack: AckFn = (response) => {
          if (!socket.destroyed) socket.write(frame(response));
        };
        this.emit('message', raw, ack);
      }
    });

    socket.on('error', (err) => { this.emit('error', err); });
  }

  /**
   * Start accepting connections.
   * Resolves once the server is bound and listening.
   */
  listen(): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: Error): void => {
        this.server.off('listening', onListening);
        reject(err);
      };
      const onListening = (): void => {
        this.server.off('error', onError);
        this.emit('listening');
        resolve();
      };
      this.server.once('error', onError);
      this.server.once('listening', onListening);
      this.server.listen(this.options.port, this.options.host);
    });
  }

  /**
   * Stop accepting new connections.
   * Existing open connections are not forcibly terminated.
   */
  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.close((err) => {
        if (!err || (err as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
          resolve();
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * The bound address once the server is listening.
   * Returns `null` before {@link listen} resolves.
   */
  get address(): net.AddressInfo | null {
    const addr = this.server.address();
    return addr !== null && typeof addr === 'object' ? addr : null;
  }
}

// ─── MllpClient ──────────────────────────────────────────────────────────────

export interface MllpClientOptions {
  /** Hostname or IP address of the remote MLLP server. */
  host: string;
  /** TCP port of the remote MLLP server. */
  port: number;
  /** TCP connection timeout in milliseconds. Default: `10 000`. */
  connectTimeout?: number;
  /** Per-message response timeout in milliseconds. Default: `30 000`. */
  responseTimeout?: number;
}

interface Pending {
  resolve: (ack: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Minimal MLLP TCP client.
 *
 * Maintains a single persistent connection. Call {@link connect} once, then
 * {@link send} as many messages as needed. Each `send` resolves with the
 * raw HL7 ACK string returned by the server. Responses are matched to sends
 * in FIFO order, which is the behaviour mandated by the MLLP specification.
 *
 * @example
 * import { encode } from '@pritiranjan/hl7v2'
 * import { MllpClient } from '@pritiranjan/hl7v2/mllp'
 *
 * const client = new MllpClient({ host: '10.0.0.1', port: 2575 })
 * await client.connect()
 *
 * const ack = await client.send(encode(outboundMsg))
 * console.log('Got ACK:', ack)
 *
 * await client.close()
 */
export class MllpClient {
  private socket: net.Socket | null = null;
  private buffer: Buffer = Buffer.alloc(0);
  private readonly pending: Pending[] = [];

  constructor(private readonly options: MllpClientOptions) {}

  /**
   * Establish a TCP connection to the remote MLLP server.
   * Resolves once the connection is open.
   * Calling `connect()` on an already-open connection is a no-op.
   */
  connect(): Promise<void> {
    if (this.socket && !this.socket.destroyed) return Promise.resolve();

    const connectTimeout = this.options.connectTimeout ?? 10_000;

    return new Promise((resolve, reject) => {
      const socket = new net.Socket();

      const onConnectError = (err: Error): void => {
        socket.destroy();
        reject(err);
      };

      socket.setTimeout(connectTimeout);
      socket.once('timeout', () => {
        onConnectError(new Error(`MLLP connect timeout after ${connectTimeout}ms`));
      });
      socket.once('error', onConnectError);
      socket.once('connect', () => {
        socket.setTimeout(0);
        socket.off('error', onConnectError);
        socket.on('error', (err) => { this.rejectAll(err); });
        socket.on('close', () => {
          this.rejectAll(new Error('MLLP connection closed unexpectedly'));
        });
        resolve();
      });

      socket.on('data', (chunk: Buffer) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        const { messages, remainder } = unframe(this.buffer);
        this.buffer = remainder;

        for (const ack of messages) {
          const waiter = this.pending.shift();
          if (waiter) {
            clearTimeout(waiter.timer);
            waiter.resolve(ack);
          }
        }
      });

      socket.connect({ host: this.options.host, port: this.options.port });
      this.socket = socket;
    });
  }

  /**
   * Send an MLLP-framed HL7 message and wait for the server's ACK.
   *
   * @param message - The raw HL7 string to send (typically the output of `encode()`).
   * @returns A promise that resolves with the raw HL7 ACK string.
   * @throws If not connected, if the connection closes before an ACK arrives,
   *         or if the response timeout elapses.
   */
  send(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.socket || this.socket.destroyed) {
        reject(new Error('Not connected — call connect() first'));
        return;
      }

      const responseTimeout = this.options.responseTimeout ?? 30_000;
      const timer = setTimeout(() => {
        const idx = this.pending.findIndex((p) => p.resolve === resolve);
        if (idx !== -1) this.pending.splice(idx, 1);
        reject(new Error(`MLLP response timeout after ${responseTimeout}ms`));
      }, responseTimeout);

      this.pending.push({ resolve, reject, timer });
      this.socket.write(frame(message));
    });
  }

  /**
   * Gracefully close the connection.
   * Sends a FIN packet and waits for the remote side to acknowledge.
   */
  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.socket || this.socket.destroyed) {
        resolve();
        return;
      }
      this.socket.end(() => { resolve(); });
    });
  }

  private rejectAll(err: Error): void {
    const waiters = this.pending.splice(0);
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(err);
    }
  }
}
