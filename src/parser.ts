import { InvalidHL7Error, HL7ParseError } from './errors.js';
import { parseHL7DateTime } from './datetime.js';
import { decodeEscapes } from './escape.js';
import type { EncodingChars, HL7Field, HL7Message, HL7Segment, MessageType } from './schema.js';
import { DEFAULT_ENCODING } from './schema.js';

export interface ParseOptions {
  /**
   * When `true`, HL7 escape sequences within field values are decoded to their
   * plain-text equivalents (e.g. `\F\` → `|`).
   *
   * Defaults to `false` so that `encode(parse(raw))` is byte-identical
   * to the original input — essential for ACK generation and message forwarding.
   */
  decodeEscapes?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function parseEncodingChars(mshLine: string): EncodingChars {
  const field        = mshLine[3];
  const component    = mshLine[4];
  const repetition   = mshLine[5];
  const escape       = mshLine[6];
  const subComponent = mshLine[7];

  if (!field || !component || !repetition || !escape || !subComponent) {
    throw new InvalidHL7Error(
      `MSH encoding characters are incomplete — ` +
      `expected 5 chars at positions 3-7, got: "${mshLine.slice(3, 8)}"`,
    );
  }

  return { field, component, repetition, escape, subComponent };
}

/**
 * Parse a raw field string into the canonical 3-D HL7Field structure:
 * `value[repetition][component][subComponent]`
 */
function parseField(raw: string, enc: EncodingChars): HL7Field {
  return raw.split(enc.repetition).map(rep =>
    rep.split(enc.component).map(comp =>
      comp.split(enc.subComponent),
    ),
  );
}

function parseMSHSegment(line: string, enc: EncodingChars): HL7Segment {
  const parts = line.split(enc.field);
  const fields: HL7Field[] = [
    // MSH.1 — the field separator character itself
    [[[enc.field]]],
    // MSH.2 — encoding characters verbatim; must NOT be split on component separator
    [[[parts[1] ?? '']]],
    // MSH.3 onwards — normal fields
    ...parts.slice(2).map(f => parseField(f, enc)),
  ];
  return { id: 'MSH', fields, raw: line };
}

function parseGenericSegment(line: string, enc: EncodingChars, lineNum: number): HL7Segment {
  const sepIdx = line.indexOf(enc.field);
  const id     = sepIdx === -1 ? line : line.slice(0, sepIdx);

  if (!/^[A-Z][A-Z0-9]{2}$/.test(id)) {
    throw new HL7ParseError(
      `Invalid segment identifier "${id}" at line ${String(lineNum)} — ` +
      `expected 3 alphanumeric characters (A-Z, 0-9) starting with a letter`,
      { line: lineNum, segmentId: id },
    );
  }

  const fieldStrings = sepIdx === -1 ? [] : line.slice(sepIdx + 1).split(enc.field);
  return { id, fields: fieldStrings.map(f => parseField(f, enc)), raw: line };
}

/** Extract a simple scalar value from an MSH field by 1-based field number. */
function mshValue(seg: HL7Segment, fieldNum: number): string {
  return seg.fields[fieldNum - 1]?.[0]?.[0]?.[0] ?? '';
}

function parseMessageType(field: HL7Field): MessageType {
  const firstRep = field[0] ?? [];
  const struct   = firstRep[2]?.[0];
  return {
    type:      firstRep[0]?.[0] ?? '',
    event:     firstRep[1]?.[0] ?? '',
    structure: struct !== undefined && struct !== '' ? struct : undefined,
  };
}

function detectLineEnding(raw: string): '\r' | '\n' | '\r\n' {
  if (raw.includes('\r\n')) return '\r\n';
  if (raw.includes('\r'))   return '\r';
  return '\n';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse an HL7 v2.x message string into a structured {@link HL7Message}.
 *
 * ### Supported inputs
 * - HL7 versions 2.1 – 2.8
 * - Line endings: `\r` (canonical), `\n`, or `\r\n` — all normalised to `\r`
 * - Custom encoding characters (non-default separators)
 * - Messages with blank lines (skipped silently)
 *
 * ### Round-trip fidelity
 * By default (`decodeEscapes: false`), field values retain their raw HL7
 * escape sequences, making `encode(parse(raw)) === raw` hold true.
 * Use `decodeEscapes: true` only when you need to display or process the
 * human-readable values and do not intend to re-encode the message.
 *
 * @throws {InvalidHL7Error} When the input is empty or does not start with MSH
 * @throws {HL7ParseError}   When a segment identifier or field structure is invalid
 *
 * @example
 * import { parse } from 'hl7v2';
 *
 * const msg = parse(rawString);
 * console.log(msg.messageType); // { type: 'ADT', event: 'A01', structure: 'ADT_A01' }
 * console.log(msg.version);     // '2.5.1'
 */
export function parse(raw: string, options: ParseOptions = {}): HL7Message {
  if (!raw || !raw.trim()) {
    throw new InvalidHL7Error('Input is empty');
  }

  // Normalise all line ending variants to the HL7 canonical segment terminator \r
  const normalised = raw.replace(/\r\n/g, '\r').replace(/\n/g, '\r');
  const lines = normalised.split('\r').filter(l => l.trim().length > 0);

  const firstLine = lines[0];
  if (!firstLine?.startsWith('MSH')) {
    throw new InvalidHL7Error(
      `First non-blank line must be an MSH segment, got: "${(firstLine ?? '').slice(0, 30)}"`,
    );
  }
  if (firstLine.length < 8) {
    throw new InvalidHL7Error(
      'MSH segment is too short to contain encoding characters (minimum length: 8)',
    );
  }

  const encoding = parseEncodingChars(firstLine);

  const segments: HL7Segment[] = lines.map((line, idx) => {
    if (line.startsWith('MSH')) return parseMSHSegment(line, encoding);
    return parseGenericSegment(line, encoding, idx + 1);
  });

  const msh = segments[0];
  if (!msh) throw new InvalidHL7Error('No MSH segment could be parsed');

  const shouldDecode = options.decodeEscapes === true;
  const decode = (v: string): string =>
    shouldDecode ? decodeEscapes(v, encoding) : v;

  // MSH.9 is at fields[8] (0-based). Pass the full HL7Field so all components
  // of the composite "MSG_TYPE^TRIGGER_EVENT^MSG_STRUCTURE" are accessible.
  const msgTypeField = msh.fields[8] ?? [];

  return {
    version:              decode(mshValue(msh, 12)),
    messageType:          parseMessageType(msgTypeField),
    messageControlId:     decode(mshValue(msh, 10)),
    timestamp:            parseHL7DateTime(mshValue(msh, 7)),
    sendingApplication:   decode(mshValue(msh, 3)),
    sendingFacility:      decode(mshValue(msh, 4)),
    receivingApplication: decode(mshValue(msh, 5)),
    receivingFacility:    decode(mshValue(msh, 6)),
    processingId:         mshValue(msh, 11),
    segments,
    encoding,
    raw: raw.trim(),
    lineEnding: detectLineEnding(raw),
  };
}

/**
 * Return `true` if the input looks like an HL7 v2 message.
 * This is a fast heuristic check — it does not fully parse the message.
 */
export function isHL7(input: string): boolean {
  return /^MSH[^A-Za-z0-9]/.test(input.trimStart());
}

// Re-export DEFAULT_ENCODING for convenience
export { DEFAULT_ENCODING };
