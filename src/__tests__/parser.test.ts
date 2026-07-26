import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, isHL7 } from '../parser.js';
import { InvalidHL7Error } from '../errors.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dir, '../../fixtures');

const adtRaw  = readFileSync(resolve(fixturesDir, 'adt-a01.hl7'), 'utf-8');
const oruRaw  = readFileSync(resolve(fixturesDir, 'oru-r01.hl7'), 'utf-8');
const ormRaw  = readFileSync(resolve(fixturesDir, 'orm-o01.hl7'), 'utf-8');

describe('isHL7', () => {
  it('returns true for a well-formed HL7 message', () => {
    expect(isHL7(adtRaw)).toBe(true);
  });

  it('returns false for plain text', () => {
    expect(isHL7('this is not HL7')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isHL7('')).toBe(false);
  });

  it('returns false for XML', () => {
    expect(isHL7('<root><child/></root>')).toBe(false);
  });
});

describe('parse — ADT A01 (patient admission)', () => {
  let msg: ReturnType<typeof parse>;

  beforeAll(() => { msg = parse(adtRaw); });

  it('parses version correctly', () => {
    expect(msg.version).toBe('2.5.1');
  });

  it('parses message type', () => {
    expect(msg.messageType.type).toBe('ADT');
    expect(msg.messageType.event).toBe('A01');
    expect(msg.messageType.structure).toBe('ADT_A01');
  });

  it('parses message control ID', () => {
    expect(msg.messageControlId).toBe('MSG000001');
  });

  it('parses sending application and facility', () => {
    expect(msg.sendingApplication).toBe('HOSPITAL_ADT');
    expect(msg.sendingFacility).toBe('HOSPITAL');
  });

  it('parses receiving application and facility', () => {
    expect(msg.receivingApplication).toBe('EHR_SYSTEM');
    expect(msg.receivingFacility).toBe('REGIONAL_HEALTH');
  });

  it('parses processing ID', () => {
    expect(msg.processingId).toBe('P');
  });

  it('parses timestamp', () => {
    expect(msg.timestamp).toBeInstanceOf(Date);
    expect(msg.timestamp?.getUTCFullYear()).toBe(2024);
    expect(msg.timestamp?.getUTCMonth()).toBe(2); // March = index 2
    expect(msg.timestamp?.getUTCDate()).toBe(15);
  });

  it('preserves encoding characters', () => {
    expect(msg.encoding.field).toBe('|');
    expect(msg.encoding.component).toBe('^');
    expect(msg.encoding.repetition).toBe('~');
    expect(msg.encoding.escape).toBe('\\');
    expect(msg.encoding.subComponent).toBe('&');
  });

  it('stores all segments', () => {
    const ids = msg.segments.map(s => s.id);
    expect(ids).toContain('MSH');
    expect(ids).toContain('EVN');
    expect(ids).toContain('PID');
    expect(ids).toContain('PV1');
    expect(ids).toContain('PV2');
    expect(ids).toContain('DG1');
  });

  it('MSH.1 field contains the field separator', () => {
    const msh = msg.segments.find(s => s.id === 'MSH')!;
    expect(msh.fields[0]?.[0]?.[0]?.[0]).toBe('|');
  });

  it('MSH.2 field contains encoding chars verbatim (not parsed as components)', () => {
    const msh = msg.segments.find(s => s.id === 'MSH')!;
    expect(msh.fields[1]?.[0]?.[0]?.[0]).toBe('^~\\&');
  });

  it('PID segment is parsed correctly', () => {
    const pid = msg.segments.find(s => s.id === 'PID')!;
    // PID.5.1 = family name
    expect(pid.fields[4]?.[0]?.[0]?.[0]).toBe('Doe');
    // PID.5.2 = given name
    expect(pid.fields[4]?.[0]?.[1]?.[0]).toBe('John');
    // PID.8 = sex
    expect(pid.fields[7]?.[0]?.[0]?.[0]).toBe('M');
  });

  it('stores raw string on each segment', () => {
    const pid = msg.segments.find(s => s.id === 'PID')!;
    expect(pid.raw).toMatch(/^PID\|/);
  });

  it('stores the raw message on msg.raw', () => {
    expect(msg.raw).toBe(adtRaw.trim());
  });
});

describe('parse — ORU R01 (lab results)', () => {
  let msg: ReturnType<typeof parse>;

  beforeAll(() => { msg = parse(oruRaw); });

  it('parses message type', () => {
    expect(msg.messageType.type).toBe('ORU');
    expect(msg.messageType.event).toBe('R01');
  });

  it('parses multiple OBX segments', () => {
    const obxSegments = msg.segments.filter(s => s.id === 'OBX');
    expect(obxSegments.length).toBe(8);
  });

  it('first OBX has correct LOINC code', () => {
    const obx = msg.segments.filter(s => s.id === 'OBX')[0]!;
    // OBX.3.1 = observation identifier code
    expect(obx.fields[2]?.[0]?.[0]?.[0]).toBe('718-7');
    // OBX.3.2 = description
    expect(obx.fields[2]?.[0]?.[1]?.[0]).toBe('Hemoglobin [Mass/volume] in Blood');
    // OBX.3.3 = coding system
    expect(obx.fields[2]?.[0]?.[2]?.[0]).toBe('LN');
  });

  it('OBX numeric value is parsed', () => {
    const obx = msg.segments.filter(s => s.id === 'OBX')[0]!;
    // OBX.5 = value
    expect(obx.fields[4]?.[0]?.[0]?.[0]).toBe('13.5');
  });

  it('OBX abnormal flag H is present on high WBC', () => {
    const obx = msg.segments.filter(s => s.id === 'OBX')[2]!; // WBC
    expect(obx.fields[7]?.[0]?.[0]?.[0]).toBe('H');
  });

  it('OBX abnormal flag HH present on critically high LDL', () => {
    const obx = msg.segments.filter(s => s.id === 'OBX')[5]!; // LDL
    expect(obx.fields[7]?.[0]?.[0]?.[0]).toBe('HH');
  });
});

describe('parse — ORM O01 (lab order)', () => {
  let msg: ReturnType<typeof parse>;

  beforeAll(() => { msg = parse(ormRaw); });

  it('parses message type', () => {
    expect(msg.messageType.type).toBe('ORM');
    expect(msg.messageType.event).toBe('O01');
  });

  it('parses multiple ORC segments', () => {
    const orcSegs = msg.segments.filter(s => s.id === 'ORC');
    expect(orcSegs.length).toBe(2);
  });
});

describe('parse — error handling', () => {
  it('throws InvalidHL7Error for message with no MSH segment', () => {
    expect(() => parse('EVN|A01|20240315')).toThrow(InvalidHL7Error);
  });

  it('handles Windows-style CRLF line endings', () => {
    const crlfMsg = adtRaw.replace(/\n/g, '\r\n');
    const msg = parse(crlfMsg);
    expect(msg.version).toBe('2.5.1');
  });

  it('handles trailing newline', () => {
    const msg = parse(adtRaw + '\n');
    expect(msg.version).toBe('2.5.1');
  });
});

describe('parse — decodeEscapes option', () => {
  it('does not decode escapes by default (raw values preserved)', () => {
    const raw = 'MSH|^~\\&|SEND|FAC|RECV|FAC2|20240315||ADT^A01|001|P|2.5\rPID|1||MRN1||Test\\F\\Name||19800101|M';
    const msg = parse(raw);
    const pid = msg.segments.find(s => s.id === 'PID')!;
    // family name contains raw escape sequence
    expect(pid.fields[4]?.[0]?.[0]?.[0]).toBe('Test\\F\\Name');
  });
});
