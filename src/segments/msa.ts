import type { EncodingChars, HL7Segment } from '../schema.js';
import type { AckCode } from '../ack.js';
import { TypedSegment } from './base.js';

/**
 * Typed accessor for the MSA (Message Acknowledgement) segment.
 *
 * MSA appears in ACK messages and informs the original sender whether
 * their message was accepted, rejected, or caused an error. Use this
 * class when parsing an ACK response to extract the result code and
 * error details.
 *
 * @example
 * import { parse, segment } from '@pritiranjan/hl7v2';
 * import { MSA } from '@pritiranjan/hl7v2/segments';
 *
 * const ackMsg = parse(rawAck);
 * const msa = new MSA(segment(ackMsg, 'MSA'), ackMsg.encoding);
 *
 * msa.acknowledgementCode()  // 'AA'
 * msa.messageControlId()     // 'MSG000001'
 * msa.isAccepted()           // true
 */
export class MSA extends TypedSegment {
  constructor(seg: HL7Segment, enc: EncodingChars) {
    super(seg, enc);
  }

  /**
   * MSA.1 — Acknowledgement Code.
   * - `'AA'` Application Accept — message processed successfully
   * - `'AE'` Application Error — message received but processing failed
   * - `'AR'` Application Reject — message structurally rejected
   */
  acknowledgementCode(): AckCode | string { return this.str(1); }

  /**
   * MSA.2 — Message Control ID.
   * The MSH.10 value from the original message being acknowledged.
   * Use this to correlate ACKs back to the original send.
   */
  messageControlId(): string { return this.str(2); }

  /**
   * MSA.3 — Text Message.
   * Human-readable description of the acknowledgement result.
   * Typically populated on error (`AE` / `AR`) to describe the failure.
   */
  textMessage(): string { return this.str(3); }

  /**
   * MSA.4 — Expected Sequence Number.
   * Used in batch or continuous query scenarios.
   */
  expectedSequenceNumber(): number | undefined { return this.num(4); }

  /** Convenience: `true` when the sending system accepted the message (`'AA'`). */
  isAccepted(): boolean { return this.str(1) === 'AA'; }

  /**
   * Convenience: `true` when the sending system returned an error or rejected
   * the message (`'AE'` or `'AR'`).
   */
  isError(): boolean {
    const code = this.str(1);
    return code === 'AE' || code === 'AR';
  }
}
