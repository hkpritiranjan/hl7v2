import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';

/**
 * DG1.6 — Diagnosis Type Codes (HL7 table 0052).
 */
export type DiagnosisType =
  | 'A'  // Admitting
  | 'W'  // Working
  | 'F'  // Final
  | string;

/**
 * A structured diagnosis code (ICD-10, SNOMED, or local).
 */
export interface DiagnosisCode {
  /**
   * Diagnosis code identifier (e.g., `'J18.9'` for ICD-10 pneumonia).
   */
  code: string;
  /** Human-readable description (e.g., `'Pneumonia, unspecified organism'`). */
  description: string;
  /**
   * Coding system (e.g., `'I10'` = ICD-10-CM, `'SCT'` = SNOMED CT,
   * `'I9CDX'` = ICD-9-CM Diagnosis).
   */
  codingSystem: string;
}

/**
 * Typed accessor for the DG1 (Diagnosis) segment.
 *
 * DG1 carries one diagnosis associated with a patient encounter.
 * Messages frequently contain multiple DG1 segments — one per diagnosis,
 * sequenced by DG1.1 (Set ID) and prioritised by DG1.15.
 *
 * @example
 * import { parse, segments } from '@pritiranjan/hl7v2';
 * import { DG1 } from '@pritiranjan/hl7v2/segments';
 *
 * const msg = parse(raw);
 * const diagnoses = segments(msg, 'DG1').map(s => new DG1(s, msg.encoding));
 *
 * for (const dg of diagnoses) {
 *   console.log(dg.diagnosisCode());    // { code: 'J18.9', description: '...', codingSystem: 'I10' }
 *   console.log(dg.diagnosisType());    // 'F' (Final)
 *   console.log(dg.isPrincipal());      // true / false
 * }
 */
export class DG1 extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** DG1.1 — Set ID (sequence number across multiple DG1 segments). */
  setId(): number | undefined { return this.num(1); }

  /**
   * DG1.3 — Diagnosis Code (CWE data type in v2.7+, CE in earlier versions).
   *
   * @example
   * dg1.diagnosisCode()
   * // { code: 'J18.9', description: 'Pneumonia, unspecified organism', codingSystem: 'I10' }
   */
  diagnosisCode(): DiagnosisCode {
    return {
      code:         this.str(3, 1),
      description:  this.str(3, 2),
      codingSystem: this.str(3, 3),
    };
  }

  /**
   * DG1.4 — Diagnosis Description.
   * Deprecated in v2.7+ (description is in DG1.3.2). Included for compatibility.
   */
  diagnosisDescription(): string { return this.str(4); }

  /** DG1.5 — Diagnosis Date/Time — when the diagnosis was made. */
  diagnosisDateTime(): Date | undefined { return this.date(5); }

  /**
   * DG1.6 — Diagnosis Type (HL7 table 0052).
   * `'A'` Admitting · `'W'` Working · `'F'` Final
   */
  diagnosisType(): DiagnosisType { return this.str(6); }

  /**
   * DG1.15 — Diagnosis Priority.
   * `1` = principal diagnosis; higher numbers indicate secondary diagnoses.
   * `0` = not included in the summary list.
   */
  diagnosisPriority(): number | undefined { return this.num(15); }

  /** DG1.16 — Diagnosing Clinician (first repetition). */
  diagnosingClinician(): string {
    const family = this.str(16, 2);
    const given  = this.str(16, 3);
    if (!family && !given) return this.str(16, 1);
    return given ? `${family}, ${given}` : family;
  }

  /**
   * Convenience: `true` if this is the principal/admitting diagnosis.
   * Checks `diagnosisPriority() === 1` or `diagnosisType() === 'A'`.
   */
  isPrincipal(): boolean {
    return this.str(6) === 'A' || this.num(15) === 1;
  }

  /** Convenience: `true` if this is a final (confirmed) diagnosis. */
  isFinal(): boolean { return this.str(6) === 'F'; }
}
