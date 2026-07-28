import { describe, it, expect } from 'vitest';
import { parse, segment, segments } from '../index.js';
import { EVN } from '../segments/evn.js';
import { MSA } from '../segments/msa.js';
import { ORC } from '../segments/orc.js';
import { OBR } from '../segments/obr.js';
import { DG1 } from '../segments/dg1.js';
import { NK1 } from '../segments/nk1.js';

// ─── EVN ─────────────────────────────────────────────────────────────────────

const ADT_WITH_EVN =
  'MSH|^~\\&|HOSP|FAC|RECV|RFAC|20240315143022||ADT^A01^ADT_A01|MSG001|P|2.5.1\r' +
  'EVN|A01|20240315143022|20240315150000|01|OP123^SMITH^JOHN|20240315143000\r' +
  'PID|1||MRN123^^^HOSP^MR||DOE^JOHN^A||19800305|M';

describe('EVN', () => {
  it('returns the event type code', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    expect(evn.eventTypeCode()).toBe('A01');
  });

  it('returns recorded date/time', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    const dt = evn.recordedDateTime();
    expect(dt).toBeInstanceOf(Date);
    expect(dt?.getUTCFullYear()).toBe(2024);
  });

  it('returns planned event date/time', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    expect(evn.plannedEventDateTime()).toBeInstanceOf(Date);
  });

  it('returns the event reason code', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    expect(evn.eventReasonCode()).toBe('01');
  });

  it('returns operator ID', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    expect(evn.operatorId()).toBe('OP123');
  });

  it('returns event occurred date/time', () => {
    const msg = parse(ADT_WITH_EVN);
    const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
    expect(evn.eventOccurred()).toBeInstanceOf(Date);
  });
});

// ─── MSA ─────────────────────────────────────────────────────────────────────

const ACK_RAW =
  'MSH|^~\\&|RECV|RFAC|HOSP|FAC|20240315143023||ACK|ACK001|P|2.5.1\r' +
  'MSA|AA|MSG001|Message processed successfully';

const ACK_ERROR_RAW =
  'MSH|^~\\&|RECV|RFAC|HOSP|FAC|20240315143023||ACK|ACK002|P|2.5.1\r' +
  'MSA|AE|MSG002|Segment PID is missing required field 5';

describe('MSA', () => {
  it('returns acknowledgement code AA', () => {
    const msg = parse(ACK_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.acknowledgementCode()).toBe('AA');
  });

  it('returns the original message control ID', () => {
    const msg = parse(ACK_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.messageControlId()).toBe('MSG001');
  });

  it('returns text message', () => {
    const msg = parse(ACK_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.textMessage()).toBe('Message processed successfully');
  });

  it('isAccepted() returns true for AA', () => {
    const msg = parse(ACK_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.isAccepted()).toBe(true);
    expect(msa.isError()).toBe(false);
  });

  it('isError() returns true for AE', () => {
    const msg = parse(ACK_ERROR_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.isError()).toBe(true);
    expect(msa.isAccepted()).toBe(false);
  });

  it('returns error message text', () => {
    const msg = parse(ACK_ERROR_RAW);
    const msa = new MSA(segment(msg, 'MSA'), msg.encoding);
    expect(msa.textMessage()).toContain('missing required field');
  });
});

// ─── ORC ─────────────────────────────────────────────────────────────────────

// ORC field map (all 1-based):
//  .1=NW  .2=ORD-2024-00123  .3=FILL-456  .4=(empty)  .5=IP
//  .6-.8=(empty)  .9=20240315140000  .10=entered-by  .11=(empty)
//  .12=ordering-provider  .13=(empty)  .14=555-1234  .15=20240315150000
const ORM_RAW =
  'MSH|^~\\&|EHR|HOSP|LAB|LAB_FAC|20240315140000||ORM^O01|ORD001|P|2.5.1\r' +
  'ORC|NW|ORD-2024-00123|FILL-456||IP||||20240315140000|TECH01^JONES^MARY||1234567^PATEL^ANITA||555-1234|20240315150000\r' +
  'OBR|1|ORD-2024-00123|FILL-456|718-7^Hemoglobin^LN|||20240315140000';

describe('ORC', () => {
  it('returns order control code', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    expect(orc.orderControl()).toBe('NW');
  });

  it('returns placer order number', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    expect(orc.placerOrderNumber()).toBe('ORD-2024-00123');
  });

  it('returns filler order number', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    expect(orc.fillerOrderNumber()).toBe('FILL-456');
  });

  it('returns order status', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    expect(orc.orderStatus()).toBe('IP');
  });

  it('returns ordering provider name', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    const provider = orc.orderingProvider();
    expect(provider.id).toBe('1234567');
    expect(provider.family).toBe('PATEL');
    expect(provider.given).toBe('ANITA');
  });

  it('returns call back phone number', () => {
    const msg = parse(ORM_RAW);
    const orc = new ORC(segment(msg, 'ORC'), msg.encoding);
    expect(orc.callBackPhoneNumber()).toBe('555-1234');
  });
});

// ─── OBR ─────────────────────────────────────────────────────────────────────

// OBR field map (all 1-based, uses (m-n) pipes between fields m and n):
//  .1=1  .2=ORD-001  .3=FILL-001  .4=24323-8^...  .7=20240315140000
//  .16=1234567^PATEL^ANITA  .24=CH  .25=F
const ORU_RAW =
  'MSH|^~\\&|LAB|HOSP|EHR|EHR_FAC|20240315143000||ORU^R01|RSLT001|P|2.5.1\r' +
  'PID|1||MRN789^^^HOSP^MR||WONG^ALICE\r' +
  'OBR|1|ORD-001|FILL-001|24323-8^Comprehensive metabolic panel^LN|||20240315140000|||||||||1234567^PATEL^ANITA||||||||CH|F\r' +
  'OBX|1|NM|2823-3^Potassium^LN||4.1|mmol/L|3.5-5.0|N|||F';

describe('OBR', () => {
  it('returns set ID', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    expect(obr.setId()).toBe(1);
  });

  it('returns universal service identifier', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    const id = obr.universalServiceIdentifier();
    expect(id.code).toBe('24323-8');
    expect(id.description).toBe('Comprehensive metabolic panel');
    expect(id.codingSystem).toBe('LN');
  });

  it('returns observation date/time', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    const dt = obr.observationDateTime();
    expect(dt).toBeInstanceOf(Date);
    expect(dt?.getUTCHours()).toBe(14);
  });

  it('returns diagnostic service section ID', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    expect(obr.diagnosticServiceSectionId()).toBe('CH');
  });

  it('returns result status', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    expect(obr.resultStatus()).toBe('F');
  });

  it('isFinal() returns true for F status', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    expect(obr.isFinal()).toBe(true);
    expect(obr.isPreliminary()).toBe(false);
  });

  it('returns ordering provider', () => {
    const msg = parse(ORU_RAW);
    const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
    const provider = obr.orderingProvider();
    expect(provider.family).toBe('PATEL');
    expect(provider.given).toBe('ANITA');
  });
});

// ─── DG1 ─────────────────────────────────────────────────────────────────────

const ADT_WITH_DG1 =
  'MSH|^~\\&|EHR|HOSP|BILLING|BILLING_FAC|20240315||ADT^A01|MSG003|P|2.5.1\r' +
  'PID|1||MRN999^^^HOSP^MR||BROWN^JAMES\r' +
  'DG1|1|ICD10|J18.9^Pneumonia unspecified^I10||20240315|A\r' +
  'DG1|2|ICD10|E11.9^Type 2 diabetes mellitus^I10||20240310|W|||||||||2';

describe('DG1', () => {
  it('returns set ID', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1s = segments(msg, 'DG1').map(s => new DG1(s, msg.encoding));
    expect(dg1s[0]?.setId()).toBe(1);
    expect(dg1s[1]?.setId()).toBe(2);
  });

  it('returns diagnosis code', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1 = new DG1(segments(msg, 'DG1')[0]!, msg.encoding);
    const code = dg1.diagnosisCode();
    expect(code.code).toBe('J18.9');
    expect(code.description).toBe('Pneumonia unspecified');
    expect(code.codingSystem).toBe('I10');
  });

  it('returns diagnosis type', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1s = segments(msg, 'DG1').map(s => new DG1(s, msg.encoding));
    expect(dg1s[0]?.diagnosisType()).toBe('A');
    expect(dg1s[1]?.diagnosisType()).toBe('W');
  });

  it('isPrincipal() is true for type A', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1 = new DG1(segments(msg, 'DG1')[0]!, msg.encoding);
    expect(dg1.isPrincipal()).toBe(true);
  });

  it('isPrincipal() is false for type W', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1 = new DG1(segments(msg, 'DG1')[1]!, msg.encoding);
    expect(dg1.isPrincipal()).toBe(false);
  });

  it('returns diagnosis date/time', () => {
    const msg = parse(ADT_WITH_DG1);
    const dg1 = new DG1(segments(msg, 'DG1')[0]!, msg.encoding);
    expect(dg1.diagnosisDateTime()).toBeInstanceOf(Date);
  });
});

// ─── NK1 ─────────────────────────────────────────────────────────────────────

const ADT_WITH_NK1 =
  'MSH|^~\\&|EHR|HOSP|ADT|ADT_FAC|20240315||ADT^A01|MSG004|P|2.5.1\r' +
  'PID|1||MRN111^^^HOSP^MR||DOE^JOHN\r' +
  // NK1 field map: .7=EC .8=20100601(startDate) .9-.14=(empty) .15=F(sex) .16=19820215(dob)
  'NK1|1|DOE^JANE^M|SPO^Spouse|123 Elm St^^Springfield^IL^62701^USA^H|555-123-4567|555-987-6543|EC|20100601|||||||F|19820215';

describe('NK1', () => {
  it('returns set ID', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    expect(nk1.setId()).toBe(1);
  });

  it('returns name', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    const name = nk1.name();
    expect(name.family).toBe('DOE');
    expect(name.given).toBe('JANE');
    expect(name.middle).toBe('M');
  });

  it('returns relationship', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    const rel = nk1.relationship();
    expect(rel.code).toBe('SPO');
    expect(rel.description).toBe('Spouse');
  });

  it('returns address', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    const addr = nk1.address();
    expect(addr.streetAddress).toBe('123 Elm St');
    expect(addr.city).toBe('Springfield');
    expect(addr.state).toBe('IL');
    expect(addr.postalCode).toBe('62701');
  });

  it('returns phone number', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    expect(nk1.phoneNumber()).toBe('555-123-4567');
  });

  it('returns business phone number', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    expect(nk1.businessPhoneNumber()).toBe('555-987-6543');
  });

  it('returns contact role', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    expect(nk1.contactRole()).toBe('EC');
  });

  it('returns sex', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    expect(nk1.sex()).toBe('F');
  });

  it('returns date of birth', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    const dob = nk1.dateOfBirth();
    expect(dob).toBeInstanceOf(Date);
    expect(dob?.getUTCFullYear()).toBe(1982);
  });

  it('returns start date', () => {
    const msg = parse(ADT_WITH_NK1);
    const nk1 = new NK1(segment(msg, 'NK1'), msg.encoding);
    const start = nk1.startDate();
    expect(start).toBeInstanceOf(Date);
    expect(start?.getUTCFullYear()).toBe(2010);
  });
});
