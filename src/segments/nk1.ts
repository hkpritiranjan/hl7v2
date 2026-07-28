import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';
import type { PersonName, Address, AdministrativeSex } from './pid.js';

/** A coded relationship between the patient and the next of kin / associated party. */
export interface NK1Relationship {
  /**
   * Relationship code (HL7 table 0063).
   * Common codes: `'SPO'` Spouse · `'PAR'` Parent · `'CHD'` Child ·
   * `'SIB'` Sibling · `'FND'` Friend · `'EME'` Employer · `'FCO'` Foster child.
   */
  code: string;
  /** Human-readable relationship description. */
  description: string;
}

/**
 * Typed accessor for the NK1 (Next of Kin / Associated Parties) segment.
 *
 * NK1 records emergency contacts, family members, guarantors, and employers
 * associated with a patient. A message may contain multiple NK1 segments,
 * one per person, ordered by NK1.1 (Set ID).
 *
 * @example
 * import { parse, segments } from '@pritiranjan/hl7v2';
 * import { NK1 } from '@pritiranjan/hl7v2/segments';
 *
 * const msg = parse(raw);
 * const contacts = segments(msg, 'NK1').map(s => new NK1(s, msg.encoding));
 *
 * for (const nk of contacts) {
 *   console.log(nk.name());         // { family: 'Doe', given: 'Jane', ... }
 *   console.log(nk.relationship()); // { code: 'SPO', description: 'Spouse' }
 *   console.log(nk.phoneNumber());  // '555-987-6543'
 * }
 */
export class NK1 extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** NK1.1 — Set ID (1 for the first NK1, incrementing for additional contacts). */
  setId(): number | undefined { return this.num(1); }

  /**
   * NK1.2 — Next of Kin / Associated Party's Name (XPN data type).
   */
  name(): PersonName {
    return {
      family: this.str(2, 1),
      given:  this.str(2, 2),
      middle: this.str(2, 3),
      suffix: this.str(2, 4),
      prefix: this.str(2, 5),
      degree: this.str(2, 6),
    };
  }

  /**
   * NK1.3 — Relationship (HL7 table 0063).
   * The relationship between the patient and this person.
   */
  relationship(): NK1Relationship {
    return {
      code:        this.str(3, 1),
      description: this.str(3, 2),
    };
  }

  /**
   * NK1.4 — Address (XAD data type).
   */
  address(): Address {
    return {
      streetAddress:    this.str(4, 1),
      otherDesignation: this.str(4, 2),
      city:             this.str(4, 3),
      state:            this.str(4, 4),
      postalCode:       this.str(4, 5),
      country:          this.str(4, 6),
      addressType:      this.str(4, 7),
    };
  }

  /** NK1.5 — Phone Number (XTN data type, first repetition). */
  phoneNumber(): string { return this.str(5, 1); }

  /** NK1.6 — Business Phone Number. */
  businessPhoneNumber(): string { return this.str(6, 1); }

  /**
   * NK1.7 — Contact Role (HL7 table 0131).
   * Common codes: `'EC'` Emergency contact · `'E'` Employer · `'F'` Federal agency ·
   * `'I'` Insurance company · `'N'` Next of kin · `'S'` State agency.
   */
  contactRole(): string { return this.str(7, 1); }

  /** NK1.8 — Start Date of the relationship or employment. */
  startDate(): Date | undefined { return this.date(8); }

  /** NK1.9 — End Date of the relationship or employment. */
  endDate(): Date | undefined { return this.date(9); }

  /** NK1.15 — Administrative Sex. */
  sex(): AdministrativeSex | string { return this.str(15); }

  /** NK1.16 — Date of Birth. */
  dateOfBirth(): Date | undefined { return this.date(16); }

  /** NK1.20 — Primary Language. */
  primaryLanguage(): string { return this.str(20, 2) || this.str(20, 1); }

  /** NK1.30 — Contact Person's Name (if different from NK1.2). */
  contactPersonName(): PersonName {
    return {
      family: this.str(30, 1),
      given:  this.str(30, 2),
      middle: this.str(30, 3),
      suffix: this.str(30, 4),
      prefix: this.str(30, 5),
      degree: this.str(30, 6),
    };
  }

  /** NK1.31 — Contact Person's Telephone Number. */
  contactPersonPhoneNumber(): string { return this.str(31, 1); }
}
