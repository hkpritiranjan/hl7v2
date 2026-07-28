import type { HL7Message } from './schema.js';

/**
 * HL7 v2 application-level acknowledgement codes (MSA.1).
 * - `'AA'` — Application Accept: message processed successfully
 * - `'AE'` — Application Error: message received, but processing failed
 * - `'AR'` — Application Reject: message rejected; structural or content error
 */
export type AckCode = 'AA' | 'AE' | 'AR';

export interface AckOptions {
  /** Free-text description placed in MSA.3. Omit to leave MSA.3 empty. */
  text?: string;
  /**
   * Explicit message control ID for MSH.10 of the ACK.
   * Defaults to `ACK` + current timestamp (e.g. `ACK20240315143022`).
   */
  messageControlId?: string;
}

/**
 * Generate a minimal HL7 v2 acknowledgement (ACK) for the given inbound message.
 *
 * Produces a two-segment message:
 * - **MSH** — sender/receiver swapped from the original; message type set to `ACK`
 * - **MSA** — acknowledgement code and the original message control ID
 *
 * Line ending, encoding characters, version, and processing ID are all
 * mirrored from the inbound message to ensure compatibility.
 *
 * @param inbound - The parsed HL7 message being acknowledged.
 * @param code    - Acknowledgement result code.
 * @param options - Optional text note and/or explicit control ID.
 *
 * @example
 * const msg = parse(rawMessage);
 * const ack = createAck(msg, 'AA');
 * // MSH|^~\&|RecvApp|RecvFac|SendApp|SendFac|20240315143022||ACK|ACK20240315143022|P|2.5.1
 * // MSA|AA|MSG000001
 *
 * @example
 * // Surface the error reason in MSA.3
 * const ack = createAck(msg, 'AE', { text: 'Required field PID.5 is missing' });
 */
export function createAck(
  inbound: HL7Message,
  code: AckCode,
  options: AckOptions = {},
): string {
  const { encoding: enc } = inbound;
  const fs = enc.field;
  const encodingChars = enc.component + enc.repetition + enc.escape + enc.subComponent;

  const now = new Date();
  const datetime = formatHL7Timestamp(now);
  const ctrlId = options.messageControlId ?? `ACK${datetime}`;

  // Build MSH: sender and receiver are swapped so the ACK returns to the originator.
  const mshBody = [
    inbound.receivingApplication, // MSH.3 — was receiver, now becomes sender
    inbound.receivingFacility,    // MSH.4
    inbound.sendingApplication,   // MSH.5 — was sender, now becomes receiver
    inbound.sendingFacility,      // MSH.6
    datetime,                     // MSH.7 — current timestamp
    '',                           // MSH.8 — security (blank)
    'ACK',                        // MSH.9 — message type
    ctrlId,                       // MSH.10
    inbound.processingId,         // MSH.11
    inbound.version,              // MSH.12
  ].join(fs);

  // MSH.1 and MSH.2 require special construction: no separator between name and MSH.1
  const mshLine = `MSH${fs}${encodingChars}${fs}${mshBody}`;

  const msaValues = options.text
    ? [code, inbound.messageControlId, options.text]
    : [code, inbound.messageControlId];
  const msaLine = `MSA${fs}${msaValues.join(fs)}`;

  return `${mshLine}${inbound.lineEnding}${msaLine}`;
}

function formatHL7Timestamp(date: Date): string {
  const y  = String(date.getFullYear());
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  const h  = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s  = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}
