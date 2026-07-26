import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser.js';
import {
  segment,
  segments,
  hasSegment,
  get,
  getFromSegment,
  getRepetitions,
} from '../query.js';
import { SegmentNotFoundError } from '../errors.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dir, '../../fixtures');

const adtRaw = readFileSync(resolve(fixturesDir, 'adt-a01.hl7'), 'utf-8');
const oruRaw = readFileSync(resolve(fixturesDir, 'oru-r01.hl7'), 'utf-8');

describe('segment()', () => {
  it('returns the first matching segment', () => {
    const msg = parse(adtRaw);
    const msh = segment(msg, 'MSH');
    expect(msh.id).toBe('MSH');
  });

  it('throws SegmentNotFoundError for missing segment', () => {
    const msg = parse(adtRaw);
    expect(() => segment(msg, 'ZZZ')).toThrow(SegmentNotFoundError);
  });

  it('error message includes the segment ID', () => {
    const msg = parse(adtRaw);
    try {
      segment(msg, 'ZZZ');
      expect.fail('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('ZZZ');
    }
  });

  it('returns segment at index using 1-based segmentIndex', () => {
    const msg = parse(oruRaw);
    const first  = segment(msg, 'OBX', { segmentIndex: 1 });
    const second = segment(msg, 'OBX', { segmentIndex: 2 });
    expect(first.fields[0]?.[0]?.[0]?.[0]).toBe('1');  // OBX.1 = set ID
    expect(second.fields[0]?.[0]?.[0]?.[0]).toBe('2');
  });
});

describe('segments()', () => {
  it('returns all matching segments', () => {
    const msg = parse(oruRaw);
    const obxList = segments(msg, 'OBX');
    expect(obxList.length).toBe(8);
  });

  it('returns empty array for missing segment (no throw)', () => {
    const msg = parse(adtRaw);
    expect(segments(msg, 'ZZZ')).toEqual([]);
  });
});

describe('hasSegment()', () => {
  it('returns true when segment is present', () => {
    const msg = parse(adtRaw);
    expect(hasSegment(msg, 'PID')).toBe(true);
    expect(hasSegment(msg, 'PV1')).toBe(true);
  });

  it('returns false when segment is absent', () => {
    const msg = parse(adtRaw);
    expect(hasSegment(msg, 'OBX')).toBe(false);
  });
});

describe('get()', () => {
  it('retrieves PID.5.1 (patient family name)', () => {
    const msg = parse(adtRaw);
    expect(get(msg, 'PID', 5, 1)).toBe('Doe');
  });

  it('retrieves PID.5.2 (patient given name)', () => {
    const msg = parse(adtRaw);
    expect(get(msg, 'PID', 5, 2)).toBe('John');
  });

  it('retrieves PID.8 (sex)', () => {
    const msg = parse(adtRaw);
    expect(get(msg, 'PID', 8)).toBe('M');
  });

  it('returns empty string for missing field', () => {
    const msg = parse(adtRaw);
    expect(get(msg, 'PID', 99)).toBe('');
  });

  it('returns empty string for missing component', () => {
    const msg = parse(adtRaw);
    expect(get(msg, 'PID', 5, 99)).toBe('');
  });

  it('decodes escape sequences when decode: true', () => {
    const raw = 'MSH|^~\\&|SEND|FAC|RECV|FAC2|20240315||ADT^A01|001|P|2.5\rPID|1||MRN1||Test\\S\\Name||19800101|M';
    const msg = parse(raw);
    expect(get(msg, 'PID', 5, 1, 1, { decode: true })).toBe('Test^Name');
  });

  it('does not decode by default', () => {
    const raw = 'MSH|^~\\&|SEND|FAC|RECV|FAC2|20240315||ADT^A01|001|P|2.5\rPID|1||MRN1||Test\\S\\Name||19800101|M';
    const msg = parse(raw);
    expect(get(msg, 'PID', 5, 1)).toBe('Test\\S\\Name');
  });

  it('retrieves specific repetition with repetition option', () => {
    const raw = 'MSH|^~\\&|SEND|FAC|RECV|FAC2|20240315||ADT^A01|001|P|2.5\rPID|1||ID1^^^A~ID2^^^B||Doe^John||19800101|M';
    const msg = parse(raw);
    expect(get(msg, 'PID', 3, 1, 1, { repetition: 2 })).toBe('ID2');
  });
});

describe('getFromSegment()', () => {
  it('retrieves field from a pre-fetched segment', () => {
    const msg = parse(adtRaw);
    const pid = segment(msg, 'PID');
    expect(getFromSegment(pid, msg, 5, 1)).toBe('Doe');
    expect(getFromSegment(pid, msg, 5, 2)).toBe('John');
  });

  it('is useful when iterating repeating segment groups', () => {
    const msg = parse(oruRaw);
    const obxList = segments(msg, 'OBX');
    const values = obxList.map(s => getFromSegment(s, msg, 5, 1));
    expect(values).toHaveLength(8);
    expect(values[0]).toBe('13.5');
  });
});

describe('getRepetitions()', () => {
  it('returns single repetition as array of length 1', () => {
    const msg = parse(adtRaw);
    const reps = getRepetitions(msg, 'PID', 8);
    expect(reps).toHaveLength(1);
    expect(reps[0]?.[0]?.[0]).toBe('M');
  });

  it('returns all repetitions of a repeating field as string[][][]', () => {
    const raw = 'MSH|^~\\&|SEND|FAC|RECV|FAC2|20240315||ADT^A01|001|P|2.5\rPID|1||ID1^^^A~ID2^^^B~ID3^^^C||Doe^John||19800101|M';
    const msg = parse(raw);
    const reps = getRepetitions(msg, 'PID', 3);
    expect(reps).toHaveLength(3);
    expect(reps[0]?.[0]?.[0]).toBe('ID1');
    expect(reps[1]?.[0]?.[0]).toBe('ID2');
    expect(reps[2]?.[0]?.[0]).toBe('ID3');
    // assigning authority is component 4 (0-indexed: 3)
    expect(reps[0]?.[3]?.[0]).toBe('A');
  });

  it('returns empty array for missing segment', () => {
    const msg = parse(adtRaw);
    expect(getRepetitions(msg, 'ZZZ', 1)).toEqual([]);
  });
});
