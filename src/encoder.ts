import type { EncodingChars, HL7Field, HL7Message, HL7Segment } from './schema.js';

export interface EncodeOptions {
  /**
   * Line ending to use between segments.
   * HL7 v2 canonical is `'\r'`. Some systems expect `'\r\n'` or `'\n'`.
   * @default '\r'
   */
  lineEnding?: '\r' | '\n' | '\r\n';
  /**
   * When `true`, a trailing line ending is appended after the last segment.
   * @default false
   */
  trailingNewline?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function encodeField(field: HL7Field, enc: EncodingChars): string {
  return field
    .map(rep =>
      rep
        .map(comp => comp.join(enc.subComponent))
        .join(enc.component),
    )
    .join(enc.repetition);
}

function encodeMSHSegment(seg: HL7Segment, enc: EncodingChars): string {
  // Reconstruct MSH verbatim from its fields:
  // MSH + field_sep + encoding_chars + field_sep + MSH.3 + ...
  const encodingCharsStr =
    enc.component + enc.repetition + enc.escape + enc.subComponent;

  // fields[0] = MSH.1 (field sep, skip — already in prefix)
  // fields[1] = MSH.2 (encoding chars, always output verbatim)
  // fields[2..] = MSH.3 onwards
  const rest = seg.fields
    .slice(2)
    .map(f => encodeField(f, enc))
    .join(enc.field);

  return `MSH${enc.field}${encodingCharsStr}${enc.field}${rest}`;
}

function encodeSegment(seg: HL7Segment, enc: EncodingChars): string {
  if (seg.id === 'MSH') return encodeMSHSegment(seg, enc);
  const fields = seg.fields.map(f => encodeField(f, enc)).join(enc.field);
  return `${seg.id}${enc.field}${fields}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Encode an {@link HL7Message} back into a raw HL7 v2 string.
 *
 * ### Round-trip guarantee
 * When called on a message produced by `parse(raw)` with default options
 * (i.e., `decodeEscapes` was **not** set to `true`), this function produces
 * output that is byte-identical to the original input, modulo line endings.
 *
 * ### Encoding characters
 * The message's own `encoding` field is used. Override via `options.encoding`
 * if you need to re-encode to a different separator set (rare).
 *
 * @param msg     - The message to encode
 * @param options - Optional output configuration
 *
 * @example
 * import { parse, encode } from 'hl7v2';
 *
 * const msg   = parse(rawString);
 * const back  = encode(msg);   // byte-identical to rawString (modulo line endings)
 *
 * // Modify a field and re-encode
 * const mutable = structuredClone(msg) as HL7Message;
 * // ... set fields ...
 * const updated = encode(mutable);
 */
export function encode(msg: HL7Message, options: EncodeOptions = {}): string {
  const lineEnding = options.lineEnding ?? msg.lineEnding;
  const enc = msg.encoding;

  const lines = msg.segments.map(seg => encodeSegment(seg, enc));
  const result = lines.join(lineEnding);
  return options.trailingNewline === true ? result + lineEnding : result;
}

/**
 * Encode a single {@link HL7Segment} to a string using the given encoding characters.
 *
 * Useful when constructing ACK messages or individual segments programmatically.
 *
 * @example
 * import { encodeSegment } from 'hl7v2';
 *
 * const mshString = encodeSegment(msg.segments[0], msg.encoding);
 */
export { encodeSegment };
