import type { EncodingChars, HL7Message, ProcessingId } from './schema.js';
import { DEFAULT_ENCODING } from './schema.js';
import { parse } from './parser.js';

export interface HL7BuilderOptions {
  /** MSH.3 — Sending application name. */
  sendingApplication?: string;
  /** MSH.4 — Sending facility name. */
  sendingFacility?: string;
  /** MSH.5 — Receiving application name. */
  receivingApplication?: string;
  /** MSH.6 — Receiving facility name. */
  receivingFacility?: string;
  /**
   * MSH.12 — HL7 version string (e.g., `'2.5'`, `'2.5.1'`, `'2.7'`).
   * Default: `'2.5'`.
   */
  version?: string;
  /**
   * MSH.11 — Processing ID.
   * `'P'` Production · `'D'` Debugging · `'T'` Training. Default: `'P'`.
   */
  processingId?: ProcessingId;
  /**
   * MSH.10 — Message control ID.
   * Auto-generated from the current timestamp if omitted.
   */
  messageControlId?: string;
  /**
   * Encoding character set. Defaults to the HL7 standard `|^~\&`.
   * Override only if interoperating with a non-standard sender.
   */
  encoding?: EncodingChars;
  /**
   * Segment separator placed between segments.
   * `'\r'` (canonical HL7) · `'\n'` (Unix) · `'\r\n'` (Windows).
   * Default: `'\r'`.
   */
  lineEnding?: '\r' | '\n' | '\r\n';
}

/**
 * Fluent builder for constructing HL7 v2 messages from scratch.
 *
 * Automatically generates a valid MSH segment from options,
 * then accepts raw segment lines that are appended in order.
 * Call {@link build} to get a fully parsed and validated {@link HL7Message},
 * or {@link toString} to get the raw HL7 string.
 *
 * ### Why raw segment strings?
 * The raw string API (rather than a field-by-field fluent API) keeps the builder
 * small, dependency-free, and immediately familiar to anyone who has worked with
 * HL7 before. For constructing complex segments, use the typed segment helpers
 * from `@pritiranjan/hl7v2/segments` to derive the correct field values.
 *
 * @example
 * import { HL7Builder } from '@pritiranjan/hl7v2'
 *
 * const msg = new HL7Builder('ADT', 'A01', {
 *   sendingApplication:   'EHR_SYSTEM',
 *   sendingFacility:      'MAIN_CAMPUS',
 *   receivingApplication: 'BILLING',
 *   receivingFacility:    'BILLING_FAC',
 *   version: '2.5.1',
 * })
 *   .addSegment('EVN|A01|20240315143022')
 *   .addSegment('PID|1||MRN123^^^HOSP^MR||DOE^JOHN^A||19800305|M')
 *   .addSegment('PV1|1|I|ICU^3^A')
 *   .build()
 *
 * msg.messageType    // { type: 'ADT', event: 'A01', structure: undefined }
 * msg.version        // '2.5.1'
 * msg.segments       // [MSH, EVN, PID, PV1]
 *
 * @example
 * // ORU R01 — lab result
 * const oru = new HL7Builder('ORU', 'R01', {
 *   sendingApplication: 'LAB_SYSTEM',
 *   receivingApplication: 'EHR',
 *   version: '2.5.1',
 * })
 *   .addSegment('PID|1||MRN456^^^HOSP^MR||SMITH^JANE')
 *   .addSegment('OBR|1|ORD-001|FILL-001|718-7^Hemoglobin^LN|||20240315140000')
 *   .addSegment('OBX|1|NM|718-7^Hemoglobin^LN||13.5|g/dL|13.5-17.5|N|||F')
 *   .build()
 */
export class HL7Builder {
  private readonly extraSegments: string[] = [];
  private readonly enc: EncodingChars;

  constructor(
    private readonly messageType: string,
    private readonly triggerEvent: string,
    private readonly options: HL7BuilderOptions = {},
  ) {
    this.enc = options.encoding ?? DEFAULT_ENCODING;
  }

  /**
   * Append a raw HL7 segment line.
   *
   * Leading and trailing whitespace is stripped automatically.
   * Returns `this` for chaining.
   *
   * @example
   * builder
   *   .addSegment('PID|1||MRN123|||DOE^JOHN')
   *   .addSegment('PV1|1|I|ICU^3^A')
   */
  addSegment(raw: string): this {
    const trimmed = raw.trim();
    if (trimmed) this.extraSegments.push(trimmed);
    return this;
  }

  /**
   * Return the complete message as a raw HL7 string.
   *
   * Useful when you want to inspect or transmit the string directly
   * rather than parsing it back into an {@link HL7Message}.
   *
   * @example
   * const packet = builder.toString()
   * // → 'MSH|^~\&|EHR||BILLING||20240315143022||ADT^A01|MSG20240315143022|P|2.5.1\rPID|1||MRN123'
   */
  toString(): string {
    const lineEnding = this.options.lineEnding ?? '\r';
    return [this.buildMSH(), ...this.extraSegments].join(lineEnding);
  }

  /**
   * Build and parse the message.
   *
   * Returns a fully structured {@link HL7Message} with all segments parsed
   * and accessible via the query API and typed segment helpers.
   *
   * @throws {InvalidHL7Error} if the constructed message has no MSH
   * @throws {HL7ParseError} if any appended segment is malformed
   *
   * @example
   * const msg = builder.build()
   * const pid = new PID(segment(msg, 'PID'), msg.encoding)
   * pid.patientName() // { family: 'Doe', given: 'John', ... }
   */
  build(): HL7Message {
    return parse(this.toString());
  }

  private buildMSH(): string {
    const fs = this.enc.field;
    const ec =
      this.enc.component +
      this.enc.repetition +
      this.enc.escape +
      this.enc.subComponent;

    const now = new Date();
    const datetime = formatTimestamp(now);
    const ctrlId = this.options.messageControlId ?? `MSG${datetime}`;
    const msgTypeField = this.triggerEvent
      ? `${this.messageType}${this.enc.component}${this.triggerEvent}`
      : this.messageType;

    const body = [
      this.options.sendingApplication  ?? '',   // MSH.3
      this.options.sendingFacility     ?? '',   // MSH.4
      this.options.receivingApplication ?? '',  // MSH.5
      this.options.receivingFacility   ?? '',   // MSH.6
      datetime,                                 // MSH.7
      '',                                       // MSH.8 — security
      msgTypeField,                             // MSH.9
      ctrlId,                                   // MSH.10
      this.options.processingId ?? 'P',         // MSH.11
      this.options.version      ?? '2.5',       // MSH.12
    ].join(fs);

    return `MSH${fs}${ec}${fs}${body}`;
  }
}

function formatTimestamp(date: Date): string {
  const y  = String(date.getFullYear());
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d  = String(date.getDate()).padStart(2, '0');
  const h  = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const s  = String(date.getSeconds()).padStart(2, '0');
  return `${y}${mo}${d}${h}${mi}${s}`;
}
