import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser.js';
import { encode, encodeSegment } from '../encoder.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dir, '../../fixtures');

const adtRaw = readFileSync(resolve(fixturesDir, 'adt-a01.hl7'), 'utf-8').trim();
const oruRaw = readFileSync(resolve(fixturesDir, 'oru-r01.hl7'), 'utf-8').trim();

describe('encode — round-trip fidelity', () => {
  it('round-trips ADT A01 message exactly', () => {
    const msg = parse(adtRaw);
    expect(encode(msg)).toBe(adtRaw);
  });

  it('round-trips ORU R01 message exactly', () => {
    const msg = parse(oruRaw);
    expect(encode(msg)).toBe(oruRaw);
  });
});

describe('encode — options', () => {
  it('uses custom line ending', () => {
    const msg = parse(adtRaw);
    const result = encode(msg, { lineEnding: '\r\n' });
    expect(result).toContain('\r\n');
    expect(result).not.toContain('\n\r');
  });

  it('appends trailing newline when requested', () => {
    const msg = parse(adtRaw);
    const result = encode(msg, { trailingNewline: true });
    const lastChar = result[result.length - 1];
    // The message's detected line ending is appended; just check a newline character exists
    expect(lastChar === '\n' || lastChar === '\r').toBe(true);
  });

  it('does not append trailing newline by default', () => {
    const msg = parse(adtRaw);
    const result = encode(msg);
    const lastChar = result[result.length - 1];
    expect(lastChar).not.toBe('\n');
  });
});

describe('encode — MSH reconstruction', () => {
  it('preserves MSH.1 (field separator) in correct position', () => {
    const msg = parse(adtRaw);
    const result = encode(msg);
    expect(result.startsWith('MSH|')).toBe(true);
  });

  it('preserves MSH.2 (encoding chars) verbatim', () => {
    const msg = parse(adtRaw);
    const result = encode(msg);
    const firstLine = result.split('\n')[0]!;
    const mshFields = firstLine.split('|');
    expect(mshFields[1]).toBe('^~\\&');
  });
});

describe('encodeSegment', () => {
  it('encodes a single segment correctly', () => {
    const msg = parse(adtRaw);
    const pid = msg.segments.find(s => s.id === 'PID')!;
    const result = encodeSegment(pid, msg.encoding);
    expect(result).toMatch(/^PID\|/);
    expect(result).toContain('Doe^John');
  });

  it('round-trips segment raw string', () => {
    const msg = parse(adtRaw);
    const pid = msg.segments.find(s => s.id === 'PID')!;
    const result = encodeSegment(pid, msg.encoding);
    expect(result).toBe(pid.raw);
  });
});
