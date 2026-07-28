import type { EncodingChars, HL7Segment } from '../schema.js';
import { TypedSegment } from './base.js';

/**
 * EVN.4 — Event Reason Codes (HL7 table 0062).
 * Indicates why the triggering event was initiated.
 */
export type EventReasonCode =
  | '01'  // Patient request
  | '02'  // Physician / health practitioner order
  | '03'  // Census management
  | '04'  // Other
  | '05'  // Birth
  | '06'  // Clinical Information Disc.
  | string;

/**
 * Typed accessor for the EVN (Event Type) segment.
 *
 * EVN always accompanies ADT messages and records meta-information
 * about the triggering event — when it was entered, why it occurred,
 * and who initiated it.
 *
 * @example
 * import { parse, segment } from '@pritiranjan/hl7v2';
 * import { EVN } from '@pritiranjan/hl7v2/segments';
 *
 * const msg = parse(raw);
 * const evn = new EVN(segment(msg, 'EVN'), msg.encoding);
 *
 * evn.eventTypeCode()     // 'A01'
 * evn.recordedDateTime()  // Date | undefined
 * evn.eventOccurred()     // Date | undefined
 */
export class EVN extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** EVN.1 — Event Type Code (mirrors MSH.9.2, e.g., `'A01'`, `'A03'`, `'A08'`). */
  eventTypeCode(): string { return this.str(1); }

  /**
   * EVN.2 — Recorded Date/Time.
   * When the event was entered into the system (may differ from when it occurred).
   */
  recordedDateTime(): Date | undefined { return this.date(2); }

  /**
   * EVN.3 — Date/Time Planned Event.
   * The scheduled date/time for a planned event (e.g., an expected discharge).
   */
  plannedEventDateTime(): Date | undefined { return this.date(3); }

  /**
   * EVN.4 — Event Reason Code (HL7 table 0062).
   * `'01'` = Patient request · `'02'` = Physician order · `'03'` = Census management
   */
  eventReasonCode(): EventReasonCode { return this.str(4); }

  /**
   * EVN.5 — Operator ID.
   * The person who entered or triggered the event in the sending system.
   * Returns the first repetition's first component (operator ID).
   */
  operatorId(): string { return this.str(5, 1); }

  /**
   * EVN.6 — Event Occurred.
   * The actual date/time of the clinical event (e.g., the real admission time).
   * May differ from EVN.2 (the system-recorded time).
   */
  eventOccurred(): Date | undefined { return this.date(6); }

  /** EVN.7 — Event Facility (where the event took place). */
  eventFacility(): string { return this.str(7, 1); }
}
