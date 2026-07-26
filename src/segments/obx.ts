import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';

/** OBX.2 — Value type codes from HL7 v2 table 0125. */
export type ObservationValueType =
  | 'NM'   // Numeric
  | 'ST'   // String
  | 'TX'   // Text
  | 'FT'   // Formatted text
  | 'CWE'  // Coded with Exceptions
  | 'CE'   // Coded Element (deprecated in v2.7+)
  | 'DT'   // Date
  | 'TM'   // Time
  | 'TS'   // Time Stamp (deprecated in v2.7+)
  | 'DTM'  // Date/Time (v2.7+)
  | 'SN'   // Structured Numeric
  | 'RP'   // Reference Pointer (e.g., image URL)
  | 'ED'   // Encapsulated Data
  | string;

/** OBX.11 — Observation Result Status codes from HL7 v2 table 0085. */
export type ResultStatus =
  | 'F'  // Final
  | 'P'  // Preliminary
  | 'C'  // Correction
  | 'X'  // Result cannot be obtained
  | 'I'  // Specimen in lab — results pending
  | 'R'  // Results entered — not yet verified
  | 'S'  // Partial results
  | 'D'  // Deletes the OBX record
  | 'N'  // Not asked — not reported
  | 'W'  // Post original as wrong (in error)
  | string;

/** Abnormal flags from HL7 v2 table 0078. */
export type AbnormalFlag =
  | 'H'   // Above high normal
  | 'HH'  // Above upper panic limits
  | 'L'   // Below low normal
  | 'LL'  // Below lower panic limits
  | 'A'   // Abnormal (generic)
  | 'AA'  // Very abnormal
  | 'N'   // Normal
  | 'IND' // Indeterminate
  | 'NEG' // Negative
  | 'POS' // Positive
  | string;

/** A coded observation identifier (LOINC, SNOMED, local). */
export interface ObservationIdentifier {
  /** Identifier code (e.g., LOINC code `'718-7'`). */
  code: string;
  /** Human-readable description (e.g., `'Hemoglobin'`). */
  description: string;
  /** Coding system (e.g., `'LN'` for LOINC, `'SCT'` for SNOMED CT). */
  codingSystem: string;
}

/**
 * Typed accessor for the OBX (Observation/Result) segment.
 *
 * OBX carries a single clinical observation — a lab result, vital sign,
 * pathology finding, or any structured clinical measurement. A message
 * typically contains multiple OBX segments, one per result.
 *
 * @example
 * import { parse, segments } from 'hl7v2';
 * import { OBX } from 'hl7v2/segments';
 *
 * const msg  = parse(raw);
 * const obxs = segments(msg, 'OBX').map(s => new OBX(s, msg.encoding));
 *
 * for (const obx of obxs) {
 *   console.log(obx.observationIdentifier().description); // 'Hemoglobin'
 *   console.log(obx.numericValue());                      // 13.5
 *   console.log(obx.units());                             // 'g/dL'
 *   console.log(obx.referenceRange());                    // '13.5-17.5'
 *   console.log(obx.abnormalFlags());                     // ['H']
 *   console.log(obx.resultStatus());                      // 'F'
 * }
 */
export class OBX extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** OBX.1 — Set ID (sequence number within the message, 1-based). */
  setId(): number | undefined { return this.num(1); }

  /**
   * OBX.2 — Value Type.
   * Indicates the data type of the observation value in OBX.5.
   * Common values: `'NM'` (numeric), `'ST'` (string), `'CWE'` (coded).
   */
  valueType(): ObservationValueType { return this.str(2); }

  /**
   * OBX.3 — Observation Identifier.
   * Typically a LOINC code identifying what was measured.
   *
   * @example
   * obx.observationIdentifier()
   * // { code: '718-7', description: 'Hemoglobin [Mass/volume] in Blood', codingSystem: 'LN' }
   */
  observationIdentifier(): ObservationIdentifier {
    return {
      code:         this.str(3, 1),
      description:  this.str(3, 2),
      codingSystem: this.str(3, 3),
    };
  }

  /** OBX.4 — Observation Sub-ID (groups related OBX segments). */
  observationSubId(): string { return this.str(4); }

  /**
   * OBX.5 — Observation Value (raw string).
   *
   * The interpretation depends on OBX.2 (value type).
   * Use {@link numericValue} for `NM`, {@link codedValue} for `CWE`/`CE`.
   */
  observationValue(): string { return this.str(5); }

  /**
   * OBX.5 — Observation value interpreted as a number.
   * Returns `undefined` if the value type is not `NM` or the value is absent.
   *
   * For structured numerics (SN type like `'>10.5'`), use {@link observationValue}.
   */
  numericValue(): number | undefined {
    if (this.str(2) !== 'NM') return undefined;
    return this.num(5);
  }

  /**
   * OBX.5 — Observation value as a coded element (CWE/CE value type).
   * Returns `{ code, description, codingSystem }`.
   */
  codedValue(): ObservationIdentifier {
    return {
      code:         this.str(5, 1),
      description:  this.str(5, 2),
      codingSystem: this.str(5, 3),
    };
  }

  /**
   * OBX.6 — Units (CWE data type).
   * Returns the unit code (e.g., `'g/dL'`, `'10*3/uL'`, `'mmHg'`).
   */
  units(): string { return this.str(6, 1); }

  /**
   * OBX.7 — References Range.
   * The normal range as a string (e.g., `'3.5-5.0'`, `'<200'`).
   */
  referenceRange(): string { return this.str(7); }

  /**
   * OBX.8 — Interpretation Codes (formerly Abnormal Flags).
   * Returns all flags for this result (a field can have multiple repetitions).
   *
   * Common values: `'H'` high, `'L'` low, `'HH'` critical high, `'LL'` critical low,
   * `'N'` normal, `'A'` abnormal, `'POS'` positive, `'NEG'` negative.
   */
  abnormalFlags(): AbnormalFlag[] {
    return this.repetitions(8);
  }

  /**
   * OBX.8 — Primary interpretation code (first flag).
   * Returns `''` if the result has no flags (i.e., it is normal / in-range).
   */
  primaryAbnormalFlag(): AbnormalFlag { return this.str(8); }

  /** OBX.11 — Observation Result Status (HL7 table 0085). */
  resultStatus(): ResultStatus { return this.str(11); }

  /** OBX.14 — Date/Time of Observation. */
  observationDateTime(): Date | undefined { return this.date(14); }

  /** OBX.15 — Producer's ID (the lab or device that produced the result). */
  producerId(): string { return this.str(15, 1); }

  /** OBX.16 — Responsible Observer (clinician who verified the result). */
  responsibleObserver(): string { return this.str(16, 1); }

  /** OBX.19 — Date/Time of Analysis. */
  analysisDateTime(): Date | undefined { return this.date(19); }

  /**
   * Convenience: return `true` if this result has a critical abnormal flag
   * (`'HH'` or `'LL'`).
   */
  isCritical(): boolean {
    const flags = this.abnormalFlags();
    return flags.includes('HH') || flags.includes('LL');
  }

  /**
   * Convenience: return `true` if the result is finalised (`resultStatus() === 'F'`).
   */
  isFinal(): boolean { return this.str(11) === 'F'; }
}
