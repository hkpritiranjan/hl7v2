import { describe, it, expect } from 'vitest';
import { parse } from '../parser.js';
import { createAck } from '../ack.js';

// Canonical ADT A01 used across all tests
const ADT_RAW =
  'MSH|^~\\&|HOSP|DEPT|RECV|RFAC|20240101120000||ADT^A01^ADT_A01|MSG000001|P|2.5.1\r' +
  'PID|1||12345^^^HOSP^MR||DOE^JOHN^A||19800101|M';

describe('createAck', () => {
  it('produces a string that starts with MSH', () => {
    const msg = parse(ADT_RAW);
    expect(createAck(msg, 'AA')).toMatch(/^MSH\|/);
  });

  it('is parseable by parse()', () => {
    const msg = parse(ADT_RAW);
    expect(() => parse(createAck(msg, 'AA'))).not.toThrow();
  });

  it('sets message type to ACK', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA'));
    expect(ack.messageType.type).toBe('ACK');
  });

  it('swaps sendingApplication and receivingApplication', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA'));
    expect(ack.sendingApplication).toBe(msg.receivingApplication);
    expect(ack.receivingApplication).toBe(msg.sendingApplication);
  });

  it('swaps sendingFacility and receivingFacility', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA'));
    expect(ack.sendingFacility).toBe(msg.receivingFacility);
    expect(ack.receivingFacility).toBe(msg.sendingFacility);
  });

  it('preserves version from the inbound message', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA'));
    expect(ack.version).toBe(msg.version);
  });

  it('preserves processing ID from the inbound message', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA'));
    expect(ack.processingId).toBe(msg.processingId);
  });

  it.each(['AA', 'AE', 'AR'] as const)('includes code %s in MSA.1', (code) => {
    const msg = parse(ADT_RAW);
    expect(createAck(msg, code)).toContain(`\rMSA|${code}|`);
  });

  it('places the original message control ID in MSA.2', () => {
    const msg = parse(ADT_RAW);
    expect(createAck(msg, 'AA')).toContain(`MSA|AA|${msg.messageControlId}`);
  });

  it('omits MSA.3 when no text is provided', () => {
    const msg = parse(ADT_RAW);
    const ack = createAck(msg, 'AA');
    const msa = ack.split('\r')[1] ?? '';
    // MSA|AA|MSG000001 — no trailing pipe when text is absent
    expect(msa.split('|').length).toBe(3);
  });

  it('places text in MSA.3 when provided', () => {
    const msg = parse(ADT_RAW);
    const ack = createAck(msg, 'AE', { text: 'Required field PID.5 is missing' });
    expect(ack).toContain('MSA|AE|MSG000001|Required field PID.5 is missing');
  });

  it('uses the explicit message control ID when provided', () => {
    const msg = parse(ADT_RAW);
    const ack = parse(createAck(msg, 'AA', { messageControlId: 'ACKTEST001' }));
    expect(ack.messageControlId).toBe('ACKTEST001');
  });

  it('preserves \\n line endings', () => {
    const raw = ADT_RAW.replace(/\r/g, '\n');
    const msg = parse(raw);
    const ack = createAck(msg, 'AA');
    expect(ack).toContain('\n');
    expect(ack).not.toContain('\r');
  });

  it('preserves \\r\\n line endings', () => {
    const raw = ADT_RAW.replace(/\r/g, '\r\n');
    const msg = parse(raw);
    const ack = createAck(msg, 'AA');
    expect(ack).toContain('\r\n');
  });

  it('preserves encoding characters from the inbound message in MSH.2', () => {
    const msg = parse(ADT_RAW);
    const ack = createAck(msg, 'AA');
    // ACK's MSH.2 must reproduce the inbound encoding chars verbatim
    expect(ack).toMatch(/^MSH\|\^~\\&\|/);
  });
});
