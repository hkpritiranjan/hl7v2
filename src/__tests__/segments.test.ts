import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser.js';
import { segment, segments } from '../query.js';
import { MSH, PID, OBX, PV1 } from '../segments/index.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(__dir, '../../fixtures');

const adtRaw = readFileSync(resolve(fixturesDir, 'adt-a01.hl7'), 'utf-8');
const oruRaw = readFileSync(resolve(fixturesDir, 'oru-r01.hl7'), 'utf-8');

describe('MSH typed segment', () => {
  let msh: MSH;

  beforeAll(() => {
    const msg = parse(adtRaw);
    msh = new MSH(segment(msg, 'MSH'), msg.encoding);
  });

  it('sendingApplication()', () => expect(msh.sendingApplication()).toBe('HOSPITAL_ADT'));
  it('sendingFacility()',    () => expect(msh.sendingFacility()).toBe('HOSPITAL'));
  it('receivingApplication()', () => expect(msh.receivingApplication()).toBe('EHR_SYSTEM'));
  it('receivingFacility()', () => expect(msh.receivingFacility()).toBe('REGIONAL_HEALTH'));
  it('version()',           () => expect(msh.version()).toBe('2.5.1'));
  it('messageControlId()',  () => expect(msh.messageControlId()).toBe('MSG000001'));
  it('processingId()',      () => expect(msh.processingId()).toBe('P'));

  it('messageType()', () => {
    const mt = msh.messageType();
    expect(mt.type).toBe('ADT');
    expect(mt.event).toBe('A01');
    expect(mt.structure).toBe('ADT_A01');
  });

  it('dateTimeOfMessage()', () => {
    const d = msh.dateTimeOfMessage();
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2024);
  });

  it('raw property returns the underlying segment', () => {
    expect(msh.raw.id).toBe('MSH');
  });
});

describe('PID typed segment', () => {
  let pid: PID;

  beforeAll(() => {
    const msg = parse(adtRaw);
    pid = new PID(segment(msg, 'PID'), msg.encoding);
  });

  it('setId()', () => expect(pid.setId()).toBe(1));

  it('patientName()', () => {
    const name = pid.patientName();
    expect(name.family).toBe('Doe');
    expect(name.given).toBe('John');
    expect(name.middle).toBe('Allen');
    expect(name.suffix).toBe('Jr');
    expect(name.prefix).toBe('Mr');
    expect(name.degree).toBe('MD');
  });

  it('sex()', () => expect(pid.sex()).toBe('M'));

  it('dateOfBirth()', () => {
    const dob = pid.dateOfBirth();
    expect(dob).toBeInstanceOf(Date);
    expect(dob?.getUTCFullYear()).toBe(1980);
    expect(dob?.getUTCMonth()).toBe(2);  // March
    expect(dob?.getUTCDate()).toBe(5);
  });

  it('address()', () => {
    const addr = pid.address();
    expect(addr.streetAddress).toBe('123 Main Street');
    expect(addr.otherDesignation).toBe('Apt 4B');
    expect(addr.city).toBe('Boston');
    expect(addr.state).toBe('MA');
    expect(addr.postalCode).toBe('02101');
    expect(addr.country).toBe('USA');
    expect(addr.addressType).toBe('H');
  });

  it('homePhone()', () => expect(pid.homePhone()).toBe('617-555-0100'));
  it('accountNumber()', () => expect(pid.accountNumber()).toBe('VN1001001'));
  it('ssn()', () => expect(pid.ssn()).toBe('123-45-6789'));
  it('deathIndicator()', () => expect(pid.deathIndicator()).toBe('N'));

  it('patientIdentifiers()', () => {
    const ids = pid.patientIdentifiers();
    expect(ids.length).toBeGreaterThanOrEqual(1);
    expect(ids[0]?.id).toBe('MRN123456');
    expect(ids[0]?.identifierTypeCode).toBe('MR');
  });
});

describe('OBX typed segment', () => {
  let obxList: OBX[];

  beforeAll(() => {
    const msg = parse(oruRaw);
    obxList = segments(msg, 'OBX').map(s => new OBX(s, msg.encoding));
  });

  it('finds 8 OBX segments', () => {
    expect(obxList).toHaveLength(8);
  });

  describe('first OBX — Hemoglobin', () => {
    let obx: OBX;
    beforeAll(() => { obx = obxList[0]!; });

    it('setId()', () => expect(obx.setId()).toBe(1));
    it('valueType()', () => expect(obx.valueType()).toBe('NM'));
    it('observationIdentifier()', () => {
      const id = obx.observationIdentifier();
      expect(id.code).toBe('718-7');
      expect(id.description).toBe('Hemoglobin [Mass/volume] in Blood');
      expect(id.codingSystem).toBe('LN');
    });
    it('numericValue()', () => expect(obx.numericValue()).toBe(13.5));
    it('units()', () => expect(obx.units()).toBe('g/dL'));
    it('referenceRange()', () => expect(obx.referenceRange()).toBe('13.5-17.5'));
    it('resultStatus()', () => expect(obx.resultStatus()).toBe('F'));
    it('isFinal()', () => expect(obx.isFinal()).toBe(true));
    it('isCritical()', () => expect(obx.isCritical()).toBe(false));
    it('abnormalFlags() is empty for normal result', () => expect(obx.abnormalFlags()).not.toContain('H'));
  });

  describe('third OBX — WBC (high)', () => {
    let obx: OBX;
    beforeAll(() => { obx = obxList[2]!; });

    it('primaryAbnormalFlag() is H', () => expect(obx.primaryAbnormalFlag()).toBe('H'));
    it('isCritical() is false for H (only HH/LL are critical)', () => expect(obx.isCritical()).toBe(false));
  });

  describe('sixth OBX — LDL (critically high)', () => {
    let obx: OBX;
    beforeAll(() => { obx = obxList[5]!; });

    it('primaryAbnormalFlag() is HH', () => expect(obx.primaryAbnormalFlag()).toBe('HH'));
    it('isCritical() is true', () => expect(obx.isCritical()).toBe(true));
    it('numericValue()', () => expect(obx.numericValue()).toBe(148));
  });
});

describe('PV1 typed segment', () => {
  let pv1: PV1;

  beforeAll(() => {
    const msg = parse(adtRaw);
    pv1 = new PV1(segment(msg, 'PV1'), msg.encoding);
  });

  it('patientClass()', () => expect(pv1.patientClass()).toBe('I'));

  it('assignedLocation()', () => {
    const loc = pv1.assignedLocation();
    expect(loc.pointOfCare).toBe('CARDIOLOGY');
    expect(loc.room).toBe('4A');
    expect(loc.bed).toBe('101');
    expect(loc.facility).toBe('HOSPITAL');
  });

  it('attendingDoctor()', () => {
    const doc = pv1.attendingDoctor();
    expect(doc.id).toBe('1234567');
    expect(doc.family).toBe('Smith');
    expect(doc.given).toBe('Richard');
    expect(doc.credential).toBe('MD');
  });

  it('referringDoctor()', () => {
    const doc = pv1.referringDoctor();
    expect(doc.id).toBe('9876543');
    expect(doc.family).toBe('Jones');
  });

  it('hospitalService()', () => expect(pv1.hospitalService()).toBe('CAR'));
  it('visitNumber()', () => expect(pv1.visitNumber()).toBe('VN1001001'));

  it('admitDateTime()', () => {
    const d = pv1.admitDateTime();
    expect(d).toBeInstanceOf(Date);
    expect(d?.getUTCFullYear()).toBe(2024);
    expect(d?.getUTCMonth()).toBe(2);
    expect(d?.getUTCDate()).toBe(15);
  });

  it('dischargeDateTime() returns undefined for active admission', () => {
    expect(pv1.dischargeDateTime()).toBeUndefined();
  });
});
