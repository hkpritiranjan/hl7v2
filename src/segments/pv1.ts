import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';

/** Patient class codes from HL7 v2 table 0004. */
export type PatientClass =
  | 'E'  // Emergency
  | 'I'  // Inpatient
  | 'O'  // Outpatient
  | 'P'  // Preadmit
  | 'R'  // Recurring patient
  | 'B'  // Obstetrics
  | 'C'  // Commercial account
  | 'N'  // Not applicable
  | 'U'  // Unknown
  | string;

/** A structured provider/clinician name and identifier. */
export interface Provider {
  /** Provider identifier (e.g., NPI number, employee ID). */
  id: string;
  /** Family (last) name. */
  family: string;
  /** Given (first) name. */
  given: string;
  /** Middle name or initial. */
  middle: string;
  /** Credential suffix (e.g., `'MD'`, `'DO'`, `'NP'`). */
  credential: string;
}

/** A patient location — room, bed, facility. */
export interface PatientLocation {
  pointOfCare: string;
  room: string;
  bed: string;
  facility: string;
  buildingCode: string;
  floor: string;
}

/**
 * Typed accessor for the PV1 (Patient Visit) segment.
 *
 * PV1 describes the context of a patient's current or historical visit:
 * the patient class (inpatient/outpatient), assigned location, attending
 * and referring physicians, and admission/discharge timestamps.
 *
 * @example
 * import { parse, segment } from 'hl7v2';
 * import { PV1 } from 'hl7v2/segments';
 *
 * const msg = parse(raw);
 * const pv1 = new PV1(segment(msg, 'PV1'), msg.encoding);
 *
 * pv1.patientClass()         // 'I' (Inpatient)
 * pv1.assignedLocation()     // { pointOfCare: 'CARDIOLOGY', room: '4A', bed: '101', ... }
 * pv1.attendingDoctor()      // { id: '1234567', family: 'Smith', given: 'Richard', ... }
 * pv1.admitDateTime()        // Date | undefined
 */
export class PV1 extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** PV1.1 — Set ID. */
  setId(): number | undefined { return this.num(1); }

  /**
   * PV1.2 — Patient Class (HL7 table 0004).
   * `'I'` Inpatient · `'O'` Outpatient · `'E'` Emergency · `'P'` Preadmit
   */
  patientClass(): PatientClass { return this.str(2); }

  /**
   * PV1.3 — Assigned Patient Location.
   * The bed the patient is currently assigned to.
   */
  assignedLocation(): PatientLocation {
    return {
      pointOfCare: this.str(3, 1),
      room:        this.str(3, 2),
      bed:         this.str(3, 3),
      facility:    this.str(3, 4),
      buildingCode:this.str(3, 7),
      floor:       this.str(3, 8),
    };
  }

  /** PV1.4 — Admission Type (e.g., `'A'` = accident, `'E'` = emergency). */
  admissionType(): string { return this.str(4); }

  /**
   * PV1.7 — Attending Doctor.
   * The physician primarily responsible for the patient's care.
   */
  attendingDoctor(): Provider {
    return {
      id:         this.str(7, 1),
      family:     this.str(7, 2),
      given:      this.str(7, 3),
      middle:     this.str(7, 4),
      credential: this.str(7, 7),
    };
  }

  /**
   * PV1.8 — Referring Doctor.
   * The physician who referred the patient.
   */
  referringDoctor(): Provider {
    return {
      id:         this.str(8, 1),
      family:     this.str(8, 2),
      given:      this.str(8, 3),
      middle:     this.str(8, 4),
      credential: this.str(8, 7),
    };
  }

  /**
   * PV1.9 — Consulting Doctor.
   * Returns all consulting doctors (field can repeat).
   */
  consultingDoctors(): Provider[] {
    const field = this.field(9);
    if (!field) return [];
    return field.map(rep => ({
      id:         rep[0]?.[0] ?? '',
      family:     rep[1]?.[0] ?? '',
      given:      rep[2]?.[0] ?? '',
      middle:     rep[3]?.[0] ?? '',
      credential: rep[7]?.[0] ?? '',
    }));
  }

  /** PV1.10 — Hospital Service (e.g., `'MED'`, `'SUR'`, `'CAR'`). */
  hospitalService(): string { return this.str(10); }

  /** PV1.14 — Admit Source (HL7 table 0023). */
  admitSource(): string { return this.str(14); }

  /** PV1.18 — Patient Type. */
  patientType(): string { return this.str(18); }

  /** PV1.19 — Visit Number (account number for this specific visit). */
  visitNumber(): string { return this.str(19, 1); }

  /** PV1.36 — Discharge Disposition (HL7 table 0112). */
  dischargeDisposition(): string { return this.str(36); }

  /**
   * PV1.44 — Admit Date/Time.
   * When the patient was admitted to this care setting.
   */
  admitDateTime(): Date | undefined { return this.date(44); }

  /**
   * PV1.45 — Discharge Date/Time.
   * `undefined` if the patient has not yet been discharged.
   */
  dischargeDateTime(): Date | undefined { return this.date(45); }
}
