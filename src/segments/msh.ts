import type { EncodingChars, HL7Segment, MessageType } from '../schema.js';
import { TypedSegment } from './base.js';

/** Processing ID values defined in HL7 v2 table 0103. */
export type ProcessingId = 'P' | 'D' | 'T';

/**
 * Typed accessor for the MSH (Message Header) segment.
 *
 * MSH is mandatory and always the first segment in any HL7 v2 message.
 * It identifies the message type, version, sender, receiver, and timestamp.
 *
 * @example
 * import { parse, segment } from 'hl7v2';
 * import { MSH } from 'hl7v2/segments';
 *
 * const msg = parse(raw);
 * const msh = new MSH(segment(msg, 'MSH'), msg.encoding);
 *
 * msh.sendingApplication()   // 'HOSPITAL_ADT'
 * msh.messageType()          // { type: 'ADT', event: 'A01', structure: 'ADT_A01' }
 * msh.messageControlId()     // 'MSG000001'
 * msh.version()              // '2.5.1'
 */
export class MSH extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /** MSH.3 — Sending Application */
  sendingApplication(): string { return this.str(3); }

  /** MSH.4 — Sending Facility */
  sendingFacility(): string { return this.str(4); }

  /** MSH.5 — Receiving Application */
  receivingApplication(): string { return this.str(5); }

  /** MSH.6 — Receiving Facility */
  receivingFacility(): string { return this.str(6); }

  /** MSH.7 — Date/Time of Message */
  dateTimeOfMessage(): Date | undefined { return this.date(7); }

  /** MSH.9 — Message Type (e.g., `{ type: 'ADT', event: 'A01', structure: 'ADT_A01' }`). */
  messageType(): MessageType {
    const field    = this.field(9);
    const firstRep = field?.[0] ?? [];
    const struct   = firstRep[2]?.[0];
    return {
      type:      firstRep[0]?.[0] ?? '',
      event:     firstRep[1]?.[0] ?? '',
      structure: struct !== undefined && struct !== '' ? struct : undefined,
    };
  }

  /** MSH.10 — Message Control ID (used for ACK correlation). */
  messageControlId(): string { return this.str(10); }

  /**
   * MSH.11 — Processing ID.
   * `'P'` = Production, `'D'` = Debugging, `'T'` = Training.
   */
  processingId(): ProcessingId | string { return this.str(11); }

  /** MSH.12 — HL7 version (e.g., `'2.5.1'`). */
  version(): string { return this.str(12); }

  /** MSH.15 — Accept Acknowledgement Type. */
  acceptAcknowledgementType(): string { return this.str(15); }

  /** MSH.16 — Application Acknowledgement Type. */
  applicationAcknowledgementType(): string { return this.str(16); }

  /** MSH.17 — Country Code (ISO 3166). */
  countryCode(): string { return this.str(17); }
}
