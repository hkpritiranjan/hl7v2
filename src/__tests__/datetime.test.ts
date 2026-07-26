import { describe, it, expect } from 'vitest';
import { parseHL7DateTime, formatHL7DateTime, formatHL7Date } from '../datetime.js';

describe('parseHL7DateTime', () => {
  it('parses date only (YYYYMMDD)', () => {
    const d = parseHL7DateTime('20240315')!;
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
  });

  it('parses year and month only (YYYYMM)', () => {
    const d = parseHL7DateTime('202403')!;
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(1);
  });

  it('parses year only (YYYY)', () => {
    const d = parseHL7DateTime('2024')!;
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(0);
    expect(d.getUTCDate()).toBe(1);
  });

  it('parses datetime with hours and minutes (YYYYMMDDHHMM)', () => {
    const d = parseHL7DateTime('202403151430')!;
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it('parses full datetime with seconds (YYYYMMDDHHMMSS)', () => {
    const d = parseHL7DateTime('20240315143022')!;
    expect(d.getUTCHours()).toBe(14);
    expect(d.getUTCMinutes()).toBe(30);
    expect(d.getUTCSeconds()).toBe(22);
  });

  it('parses datetime with fractional seconds', () => {
    const d = parseHL7DateTime('20240315143022.456')!;
    expect(d.getUTCMilliseconds()).toBe(456);
  });

  it('parses datetime with positive timezone offset', () => {
    const d = parseHL7DateTime('20240315143022+0530')!;
    // 14:30:22 IST = 14:30:22 - 05:30 = 09:00:22 UTC
    expect(d.getUTCHours()).toBe(9);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(22);
  });

  it('parses datetime with negative timezone offset', () => {
    const d = parseHL7DateTime('20240315143022-0500')!;
    // 14:30:22 EST = 14:30:22 + 05:00 = 19:30:22 UTC
    expect(d.getUTCHours()).toBe(19);
    expect(d.getUTCMinutes()).toBe(30);
  });

  it('returns undefined for empty string', () => {
    expect(parseHL7DateTime('')).toBeUndefined();
  });

  it('throws on invalid format', () => {
    expect(() => parseHL7DateTime('not-a-date')).toThrow();
  });
});

describe('formatHL7DateTime', () => {
  it('formats a Date as HL7 datetime string', () => {
    const d = new Date('2024-03-15T14:30:22.000Z');
    const result = formatHL7DateTime(d);
    expect(result).toMatch(/^20240315/);
    expect(result.length).toBeGreaterThanOrEqual(12);
  });

  it('round-trips through parse and format', () => {
    const original = '20240315143022';
    const d = parseHL7DateTime(original)!;
    const formatted = formatHL7DateTime(d);
    expect(formatted).toContain('20240315');
  });
});

describe('formatHL7Date', () => {
  it('formats a Date as YYYYMMDD', () => {
    const d = new Date(Date.UTC(2024, 2, 15)); // March 15, 2024
    expect(formatHL7Date(d)).toBe('20240315');
  });

  it('pads month and day with leading zeros', () => {
    const d = new Date(Date.UTC(2024, 0, 5)); // Jan 5, 2024
    expect(formatHL7Date(d)).toBe('20240105');
  });
});
