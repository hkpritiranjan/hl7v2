import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';

/** Administrative sex codes from HL7 v2 table 0001. */
export type AdministrativeSex = 'M' | 'F' | 'O' | 'U' | 'A' | 'N' | 'C';

/** A structured patient name following HL7 XPN (Extended Person Name). */
export interface PersonName {
  /** Family (last) name. */
  family: string;
  /** Given (first) name. */
  given: string;
  /** Middle name or initial. */
  middle: string;
  /** Name suffix (e.g., `'JR'`, `'SR'`, `'III'`). */
  suffix: string;
  /** Name prefix (e.g., `'DR'`, `'MR'`, `'MS'`). */
  prefix: string;
  /** Degree (e.g., `'MD'`, `'PHD'`). */
  degree: string;
}

/** A structured address following HL7 XAD (Extended Address). */
export interface Address {
  streetAddress: string;
  otherDesignation: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressType: string;
}

/** A patient identifier from PID.3 (Patient Identifier List). */
export interface PatientIdentifier {
  /** The identifier value (e.g., MRN, SSN). */
  id: string;
  /** Check digit. */
  checkDigit: string;
  /** Assigning authority (e.g., `'HOSPITAL'`). */
  assigningAuthority: string;
  /** Identifier type code (e.g., `'MR'` = Medical Record, `'PI'` = Patient Internal). */
  identifierTypeCode: string;
}

/**
 * Typed accessor for the PID (Patient Identification) segment.
 *
 * PID carries all core patient demographic information and appears in
 * virtually every HL7 v2 message type (ADT, ORU, ORM, SIU, etc.).
 *
 * @example
 * import { parse, segment } from 'hl7v2';
 * import { PID } from 'hl7v2/segments';
 *
 * const msg = parse(raw);
 * const pid = new PID(segment(msg, 'PID'), msg.encoding);
 *
 * pid.patientName()        // { family: 'Doe', given: 'John', middle: 'A', ... }
 * pid.dateOfBirth()        // Date | undefined
 * pid.sex()                // 'M' | 'F' | ...
 * pid.patientIdentifiers() // PatientIdentifier[]
 */
export class PID extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** PID.1 — Set ID (1-based sequence number within the message). */
  setId(): number | undefined { return this.num(1); }

  /**
   * PID.3 — Patient Identifier List.
   *
   * Returns all patient identifiers (MRN, SSN, national ID, etc.).
   * Each identifier has its own type code and assigning authority.
   *
   * @example
   * pid.patientIdentifiers()
   * // [{ id: 'MRN123', assigningAuthority: 'HOSPITAL', identifierTypeCode: 'MR' }]
   */
  patientIdentifiers(): PatientIdentifier[] {
    const field = this.field(3);
    if (!field) return [];
    return field.map(rep => ({
      id:                  rep[0]?.[0] ?? '',
      checkDigit:          rep[1]?.[0] ?? '',
      assigningAuthority:  rep[3]?.[0] ?? '',
      identifierTypeCode:  rep[4]?.[0] ?? '',
    }));
  }

  /**
   * PID.3 — Primary patient identifier (first in the list).
   * Returns the raw identifier string (e.g., `'MRN123'`).
   */
  patientId(): string { return this.str(3, 1); }

  /**
   * PID.5 — Patient Name (first/primary name).
   *
   * Patient names follow the XPN (Extended Person Name) data type.
   * Components: family ^ given ^ middle ^ suffix ^ prefix ^ degree
   */
  patientName(): PersonName {
    return {
      family: this.str(5, 1),
      given:  this.str(5, 2),
      middle: this.str(5, 3),
      suffix: this.str(5, 4),
      prefix: this.str(5, 5),
      degree: this.str(5, 6),
    };
  }

  /**
   * PID.5 — All patient names (legal, alias, display, etc.).
   * Most messages contain a single name; some include aliases or prior names.
   */
  allPatientNames(): PersonName[] {
    const field = this.field(5);
    if (!field) return [];
    return field.map(rep => ({
      family: rep[0]?.[0] ?? '',
      given:  rep[1]?.[0] ?? '',
      middle: rep[2]?.[0] ?? '',
      suffix: rep[3]?.[0] ?? '',
      prefix: rep[4]?.[0] ?? '',
      degree: rep[5]?.[0] ?? '',
    }));
  }

  /**
   * PID.7 — Date/Time of Birth.
   * Returns `undefined` if absent or unparseable.
   */
  dateOfBirth(): Date | undefined { return this.date(7); }

  /**
   * PID.8 — Administrative Sex (HL7 table 0001).
   * `'M'` Male · `'F'` Female · `'O'` Other · `'U'` Unknown
   * `'A'` Ambiguous · `'N'` Not applicable · `'C'` Complex
   */
  sex(): AdministrativeSex | string { return this.str(8); }

  /**
   * PID.10 — Race (HL7 table 0005, CWE data type).
   * Returns the race code (first component).
   */
  race(): string { return this.str(10, 1); }

  /**
   * PID.11 — Patient Address (first address).
   * Addresses follow the XAD (Extended Address) data type.
   */
  address(): Address {
    return {
      streetAddress:    this.str(11, 1),
      otherDesignation: this.str(11, 2),
      city:             this.str(11, 3),
      state:            this.str(11, 4),
      postalCode:       this.str(11, 5),
      country:          this.str(11, 6),
      addressType:      this.str(11, 7),
    };
  }

  /** PID.13 — Phone Number - Home (first number, XTN data type). */
  homePhone(): string { return this.str(13, 1); }

  /** PID.14 — Phone Number - Business (first number, XTN data type). */
  workPhone(): string { return this.str(14, 1); }

  /**
   * PID.15 — Primary Language (CE data type).
   * Returns the language code (e.g., `'ENG'`, `'SPA'`).
   */
  primaryLanguage(): string { return this.str(15, 1); }

  /** PID.16 — Marital Status (HL7 table 0002). */
  maritalStatus(): string { return this.str(16, 1); }

  /** PID.17 — Religion (HL7 table 0006). */
  religion(): string { return this.str(17, 1); }

  /**
   * PID.18 — Patient Account Number.
   * The billing/visit account number (distinct from the medical record number).
   */
  accountNumber(): string { return this.str(18, 1); }

  /** PID.19 — SSN Number - Patient (US Social Security Number). */
  ssn(): string { return this.str(19); }

  /** PID.22 — Ethnic Group (HL7 table 0189, CWE data type). */
  ethnicGroup(): string { return this.str(22, 1); }

  /** PID.29 — Patient Death Date and Time. `undefined` if patient is not deceased. */
  deathDateTime(): Date | undefined { return this.date(29); }

  /**
   * PID.30 — Patient Death Indicator.
   * `'Y'` = deceased, `'N'` = not deceased.
   */
  deathIndicator(): 'Y' | 'N' | string { return this.str(30); }
}
