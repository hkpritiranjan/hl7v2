import { describe, it, expect } from 'vitest';
import { parse, segment, hasSegment } from '../index.js';
import { HL7Builder } from '../builder.js';

describe('HL7Builder', () => {
  it('produces a message parseable by parse()', () => {
    const raw = new HL7Builder('ADT', 'A01').toString();
    expect(() => parse(raw)).not.toThrow();
  });

  it('build() returns a valid HL7Message', () => {
    const msg = new HL7Builder('ADT', 'A01').build();
    expect(msg.messageType.type).toBe('ADT');
    expect(msg.messageType.event).toBe('A01');
  });

  it('sets version from options', () => {
    const msg = new HL7Builder('ADT', 'A01', { version: '2.5.1' }).build();
    expect(msg.version).toBe('2.5.1');
  });

  it('defaults version to 2.5', () => {
    const msg = new HL7Builder('ADT', 'A01').build();
    expect(msg.version).toBe('2.5');
  });

  it('sets sending and receiving application', () => {
    const msg = new HL7Builder('ORU', 'R01', {
      sendingApplication:   'LAB',
      receivingApplication: 'EHR',
    }).build();
    expect(msg.sendingApplication).toBe('LAB');
    expect(msg.receivingApplication).toBe('EHR');
  });

  it('sets sending and receiving facility', () => {
    const msg = new HL7Builder('ADT', 'A01', {
      sendingFacility:   'MAIN_CAMPUS',
      receivingFacility: 'BILLING_FAC',
    }).build();
    expect(msg.sendingFacility).toBe('MAIN_CAMPUS');
    expect(msg.receivingFacility).toBe('BILLING_FAC');
  });

  it('sets processingId from options', () => {
    const msg = new HL7Builder('ADT', 'A01', { processingId: 'T' }).build();
    expect(msg.processingId).toBe('T');
  });

  it('defaults processingId to P', () => {
    const msg = new HL7Builder('ADT', 'A01').build();
    expect(msg.processingId).toBe('P');
  });

  it('uses explicit messageControlId when provided', () => {
    const msg = new HL7Builder('ADT', 'A01', { messageControlId: 'TESTMSG001' }).build();
    expect(msg.messageControlId).toBe('TESTMSG001');
  });

  it('generates a non-empty messageControlId when not provided', () => {
    const msg = new HL7Builder('ADT', 'A01').build();
    expect(msg.messageControlId.length).toBeGreaterThan(0);
  });

  it('appends extra segments via addSegment()', () => {
    const msg = new HL7Builder('ADT', 'A01')
      .addSegment('PID|1||MRN123^^^HOSP^MR||DOE^JOHN^A||19800305|M')
      .build();
    expect(hasSegment(msg, 'PID')).toBe(true);
    expect(hasSegment(msg, 'MSH')).toBe(true);
    expect(msg.segments).toHaveLength(2);
  });

  it('appends multiple segments in order', () => {
    const msg = new HL7Builder('ADT', 'A01')
      .addSegment('PID|1||MRN123|||DOE^JOHN')
      .addSegment('PV1|1|I|ICU^3^A')
      .build();
    expect(msg.segments[0]?.id).toBe('MSH');
    expect(msg.segments[1]?.id).toBe('PID');
    expect(msg.segments[2]?.id).toBe('PV1');
  });

  it('ignores blank addSegment() calls', () => {
    const msg = new HL7Builder('ADT', 'A01')
      .addSegment('   ')
      .addSegment('PID|1||MRN123|||DOE^JOHN')
      .build();
    expect(msg.segments).toHaveLength(2);
  });

  it('is chainable (addSegment returns this)', () => {
    const builder = new HL7Builder('ADT', 'A01');
    expect(builder.addSegment('PID|1')).toBe(builder);
  });

  it('toString() and build() produce consistent results', () => {
    const builder = new HL7Builder('ADT', 'A01', {
      messageControlId: 'FIXED001',
      version: '2.5.1',
    }).addSegment('PID|1||MRN123|||DOE^JOHN');

    const fromString = parse(builder.toString());
    const fromBuild  = builder.build();
    expect(fromString.messageControlId).toBe(fromBuild.messageControlId);
    expect(fromString.version).toBe(fromBuild.version);
  });

  it('preserves custom lineEnding in toString()', () => {
    const raw = new HL7Builder('ADT', 'A01', { lineEnding: '\n' })
      .addSegment('PID|1||MRN123')
      .toString();
    expect(raw).toContain('\n');
    expect(raw).not.toContain('\r');
  });

  it('works without a trigger event', () => {
    const msg = new HL7Builder('ACK', '').build();
    expect(msg.messageType.type).toBe('ACK');
  });

  it('builds an ORU R01 lab result message', () => {
    const msg = new HL7Builder('ORU', 'R01', {
      sendingApplication: 'LAB',
      receivingApplication: 'EHR',
      version: '2.5.1',
    })
      .addSegment('PID|1||MRN456^^^HOSP^MR||SMITH^JANE')
      .addSegment('OBR|1|ORD-001|FILL-001|718-7^Hemoglobin^LN|||20240315140000')
      .addSegment('OBX|1|NM|718-7^Hemoglobin^LN||13.5|g/dL|13.5-17.5|N|||F')
      .build();

    expect(msg.messageType.type).toBe('ORU');
    expect(msg.messageType.event).toBe('R01');
    expect(hasSegment(msg, 'OBX')).toBe(true);

    const msh = segment(msg, 'MSH');
    expect(msh).toBeDefined();
  });
});
