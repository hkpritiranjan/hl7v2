/**
 * The five special characters that govern HL7 v2 encoding.
 * Defined in MSH.1 and MSH.2 of every message.
 * Default values follow the HL7 v2 standard.
 */
export interface EncodingChars {
  /** Separates fields within a segment. Default: `|` */
  readonly field: string;
  /** Separates components within a field. Default: `^` */
  readonly component: string;
  /** Separates repetitions of a field. Default: `~` */
  readonly repetition: string;
  /** Introduces escape sequences. Default: `\` */
  readonly escape: string;
  /** Separates sub-components. Default: `&` */
  readonly subComponent: string;
}

/** HL7 v2 standard encoding characters. */
export const DEFAULT_ENCODING: EncodingChars = {
  field: '|',
  component: '^',
  repetition: '~',
  escape: '\\',
  subComponent: '&',
} as const;

/**
 * A single HL7 v2 field value modelled as a 3-dimensional array.
 *
 * Dimensions (all 0-indexed internally):
 *   `value[repetition][component][subComponent]`
 *
 * Most fields are simple strings: `[[['value']]]`
 * Composite fields: `[[['family', 'given', 'middle']]]`
 * Repeated fields: `[[['home phone']], [['work phone']]]`
 */
export type HL7Field = string[][][];

/**
 * A single HL7 v2 segment — one line of a message.
 *
 * @example
 * // PID|1||MRN123^^^HOSP^MR||DOE^JOHN^A
 * segment.id      // 'PID'
 * segment.fields  // [[...], [...], ...]
 */
export interface HL7Segment {
  /** Three-letter segment identifier (e.g., `'MSH'`, `'PID'`, `'OBX'`). */
  readonly id: string;
  /**
   * Segment fields, 0-indexed.
   * `fields[n]` corresponds to field number `n+1` in the HL7 spec.
   *
   * MSH is special: `fields[0]` = MSH.1 (the field separator char itself).
   */
  readonly fields: HL7Field[];
  /** The original unparsed segment string — preserved for round-trip fidelity. */
  readonly raw: string;
}

/** Parsed message type and trigger event from MSH.9. */
export interface MessageType {
  /** Message type code (e.g., `'ADT'`, `'ORU'`, `'ORM'`). */
  readonly type: string;
  /** Trigger event code (e.g., `'A01'`, `'R01'`, `'O01'`). */
  readonly event: string;
  /** Optional message structure (e.g., `'ADT_A01'`). */
  readonly structure: string | undefined;
}

/** Processing ID — indicates the environment the message was sent from. */
export type ProcessingId = 'P' | 'D' | 'T' | string;

/**
 * A fully parsed HL7 v2.x message.
 *
 * @example
 * const msg = parse(raw);
 * msg.version          // '2.5.1'
 * msg.messageType      // { type: 'ADT', event: 'A01', structure: 'ADT_A01' }
 * msg.messageControlId // 'MSG000001'
 * msg.segments         // HL7Segment[]
 */
export interface HL7Message {
  /** HL7 version string extracted from MSH.12 (e.g., `'2.5'`, `'2.5.1'`). */
  readonly version: string;
  /** Message type and trigger event parsed from MSH.9. */
  readonly messageType: MessageType;
  /** Unique message control ID from MSH.10. Used for acknowledgement correlation. */
  readonly messageControlId: string;
  /** Message creation timestamp from MSH.7. `undefined` if absent or unparseable. */
  readonly timestamp: Date | undefined;
  /** Sending application name from MSH.3. */
  readonly sendingApplication: string;
  /** Sending facility name from MSH.4. */
  readonly sendingFacility: string;
  /** Receiving application name from MSH.5. */
  readonly receivingApplication: string;
  /** Receiving facility name from MSH.6. */
  readonly receivingFacility: string;
  /** Processing ID from MSH.11. `'P'` = Production, `'D'` = Debugging, `'T'` = Training. */
  readonly processingId: ProcessingId;
  /** All segments in document order. */
  readonly segments: HL7Segment[];
  /** Encoding characters extracted from MSH.1 and MSH.2. */
  readonly encoding: EncodingChars;
  /** The original raw input string — preserved without modification. */
  readonly raw: string;
  /**
   * The line ending character(s) detected from the original input.
   * Used by `encode()` to restore byte-identical output.
   * `'\r'` (canonical HL7), `'\n'` (Unix), or `'\r\n'` (Windows).
   */
  readonly lineEnding: '\r' | '\n' | '\r\n';
}
