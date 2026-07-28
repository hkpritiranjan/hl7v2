import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';
import type { Provider } from './pv1.js';
import type { ObservationIdentifier, ResultStatus } from './obx.js';

/**
 * Typed accessor for the OBR (Observation Request) segment.
 *
 * OBR describes a single ordered observation or diagnostic test.
 * It carries the ordered test identity, timing, specimen details,
 * the ordering provider, and the result status. In ORU messages,
 * an OBR precedes the group of OBX segments that carry its results.
 *
 * @example
 * import { parse, segment } from '@pritiranjan/hl7v2';
 * import { OBR } from '@pritiranjan/hl7v2/segments';
 *
 * const msg = parse(raw);
 * const obr = new OBR(segment(msg, 'OBR'), msg.encoding);
 *
 * obr.universalServiceIdentifier()
 * // { code: '24323-8', description: 'Comprehensive metabolic panel', codingSystem: 'LN' }
 *
 * obr.resultStatus()     // 'F'
 * obr.isFinal()          // true
 * obr.orderingProvider() // { id: '9876', family: 'Patel', given: 'Anita', ... }
 */
export class OBR extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** OBR.1 — Set ID (sequence number for multiple OBR segments in one message). */
  setId(): number | undefined { return this.num(1); }

  /** OBR.2 — Placer Order Number (from the ordering system). */
  placerOrderNumber(): string { return this.str(2, 1); }

  /** OBR.3 — Filler Order Number (from the lab or diagnostic service). */
  fillerOrderNumber(): string { return this.str(3, 1); }

  /**
   * OBR.4 — Universal Service Identifier.
   * The ordered test or panel, typically coded with LOINC.
   *
   * @example
   * obr.universalServiceIdentifier()
   * // { code: '718-7', description: 'Hemoglobin [Mass/volume] in Blood', codingSystem: 'LN' }
   */
  universalServiceIdentifier(): ObservationIdentifier {
    return {
      code:         this.str(4, 1),
      description:  this.str(4, 2),
      codingSystem: this.str(4, 3),
    };
  }

  /**
   * OBR.7 — Observation Date/Time.
   * When the specimen was collected or the observation was made.
   */
  observationDateTime(): Date | undefined { return this.date(7); }

  /** OBR.8 — Observation End Date/Time (for observations spanning a period). */
  observationEndDateTime(): Date | undefined { return this.date(8); }

  /**
   * OBR.14 — Specimen Received Date/Time.
   * When the specimen arrived at the lab (may differ from collection time).
   */
  specimenReceivedDateTime(): Date | undefined { return this.date(14); }

  /**
   * OBR.15 — Specimen Source.
   * The source of the specimen (e.g., `'BLDV'` venous blood, `'URINE'`).
   */
  specimenSource(): string { return this.str(15, 1); }

  /** OBR.16 — Ordering Provider. */
  orderingProvider(): Provider {
    return {
      id:         this.str(16, 1),
      family:     this.str(16, 2),
      given:      this.str(16, 3),
      middle:     this.str(16, 4),
      credential: this.str(16, 7),
    };
  }

  /** OBR.17 — Order Callback Phone Number. */
  orderCallbackPhoneNumber(): string { return this.str(17, 1); }

  /**
   * OBR.22 — Results Rpt/Status Change — Date/Time.
   * When the result status last changed (e.g., from preliminary to final).
   */
  resultStatusChangeDateTime(): Date | undefined { return this.date(22); }

  /**
   * OBR.24 — Diagnostic Service Section ID.
   * The lab section that performed the test.
   * Common codes: `'HM'` Hematology · `'CH'` Chemistry · `'MB'` Microbiology ·
   * `'RAD'` Radiology · `'PATH'` Pathology.
   */
  diagnosticServiceSectionId(): string { return this.str(24); }

  /**
   * OBR.25 — Result Status (HL7 table 0123).
   * Common: `'F'` Final · `'P'` Preliminary · `'C'` Correction · `'I'` Pending.
   */
  resultStatus(): ResultStatus { return this.str(25); }

  /** OBR.26 — Parent Result (links this OBR to a parent OBX for reflex orders). */
  parentResult(): string { return this.str(26, 1); }

  /**
   * OBR.32 — Principal Result Interpreter.
   * The clinician who reviewed and released the result.
   */
  principalResultInterpreter(): Provider {
    return {
      id:         this.str(32, 1),
      family:     this.str(32, 2),
      given:      this.str(32, 3),
      middle:     this.str(32, 4),
      credential: this.str(32, 7),
    };
  }

  /** Convenience: `true` if results have been finalised (`resultStatus() === 'F'`). */
  isFinal(): boolean { return this.str(25) === 'F'; }

  /**
   * Convenience: `true` if results are preliminary and not yet finalized.
   */
  isPreliminary(): boolean { return this.str(25) === 'P'; }
}
