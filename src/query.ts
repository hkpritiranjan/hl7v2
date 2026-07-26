import { SegmentNotFoundError } from './errors.js';
import { decodeEscapes } from './escape.js';
import type { HL7Field, HL7Message, HL7Segment } from './schema.js';

// ---------------------------------------------------------------------------
// Segment access
// ---------------------------------------------------------------------------

/**
 * Return the first segment with the given identifier.
 *
 * When a message contains multiple segments with the same identifier (e.g.
 * repeating OBX groups), pass `{ segmentIndex: N }` (1-based) to select which
 * occurrence to return. Defaults to the first occurrence (`segmentIndex: 1`).
 *
 * @throws {SegmentNotFoundError} When no segment with `id` exists at the given index.
 *
 * @example
 * const pid  = segment(msg, 'PID');
 * const obx1 = segment(msg, 'OBX', { segmentIndex: 1 });  // first OBX
 * const obx2 = segment(msg, 'OBX', { segmentIndex: 2 });  // second OBX
 */
export function segment(
  msg: HL7Message,
  id: string,
  options: { segmentIndex?: number } = {},
): HL7Segment {
  const upper = id.toUpperCase();
  const idx = (options.segmentIndex ?? 1) - 1; // convert 1-based to 0-based
  const matches = msg.segments.filter(s => s.id === upper);
  const found = matches[idx];
  if (!found) throw new SegmentNotFoundError(upper);
  return found;
}

/**
 * Return all segments with the given identifier.
 * Returns an empty array (never throws) when none are found.
 *
 * Useful for repeating segments such as OBX (lab results), NTE (notes),
 * or DG1 (diagnoses).
 *
 * @example
 * const allOBX = segments(msg, 'OBX');
 * for (const obx of allOBX) {
 *   console.log(get(msg, obx, 5)); // OBX.5 — observation value
 * }
 */
export function segments(msg: HL7Message, id: string): HL7Segment[] {
  return msg.segments.filter(s => s.id === id.toUpperCase());
}

/**
 * Return `true` if the message contains at least one segment with the given identifier.
 *
 * @example
 * if (hasSegment(msg, 'PV1')) {
 *   const pv1 = segment(msg, 'PV1');
 * }
 */
export function hasSegment(msg: HL7Message, id: string): boolean {
  return msg.segments.some(s => s.id === id.toUpperCase());
}

// ---------------------------------------------------------------------------
// Field value access
// ---------------------------------------------------------------------------

export interface GetOptions {
  /**
   * 1-based repetition number. Defaults to `1` (first repetition).
   *
   * @example
   * // PID.3 can repeat — get the second identifier
   * get(msg, 'PID', 3, undefined, undefined, { repetition: 2 });
   */
  repetition?: number;
  /**
   * When `true`, decode HL7 escape sequences in the returned value.
   * Defaults to `false`.
   */
  decode?: boolean;
  /**
   * 1-based index when the message contains multiple segments with the same
   * identifier. Defaults to `1` (first occurrence).
   *
   * @example
   * // Get OBX.5 from the third OBX segment
   * get(msg, 'OBX', 5, undefined, undefined, { segmentIndex: 3 });
   */
  segmentIndex?: number;
}

/**
 * Extract a scalar string value from a message field using 1-based HL7 addressing.
 *
 * Returns an empty string `''` rather than throwing when the field, component,
 * or sub-component does not exist — reflecting HL7's rule that absent elements
 * are equivalent to empty strings.
 *
 * HL7 addressing reference (1-based throughout):
 * - `get(msg, 'PID', 3)`          → PID.3       (first component, first repetition)
 * - `get(msg, 'PID', 5, 1)`       → PID.5.1     (family name component)
 * - `get(msg, 'PID', 5, 2)`       → PID.5.2     (given name component)
 * - `get(msg, 'PID', 11, 1, 1)`   → PID.11.1.1  (sub-component)
 * - `get(msg, 'OBX', 5, 1, 1, { repetition: 2 })` → OBX.5[2].1.1 (second repetition)
 *
 * @param msg        - Parsed HL7 message
 * @param segmentId  - Three-letter segment identifier (case-insensitive)
 * @param field      - 1-based field number
 * @param component  - 1-based component number (defaults to 1)
 * @param subComponent - 1-based sub-component number (defaults to 1)
 * @param options    - See {@link GetOptions}
 *
 * @example
 * import { parse, get } from 'hl7v2';
 *
 * const msg       = parse(raw);
 * const mrn       = get(msg, 'PID', 3);       // PID.3 — medical record number
 * const lastName  = get(msg, 'PID', 5, 1);    // PID.5.1 — family name
 * const firstName = get(msg, 'PID', 5, 2);    // PID.5.2 — given name
 */
export function get(
  msg: HL7Message,
  segmentId: string,
  field: number,
  component?: number,
  subComponent?: number,
  options: GetOptions = {},
): string {
  const segIdx   = (options.segmentIndex ?? 1) - 1; // convert 1-based to 0-based
  const repIdx   = (options.repetition   ?? 1) - 1; // convert 1-based to 0-based
  const compIdx  = (component            ?? 1) - 1;
  const subIdx   = (subComponent         ?? 1) - 1;

  const segs = msg.segments.filter(s => s.id === segmentId.toUpperCase());
  const seg  = segs[segIdx];
  if (!seg) return '';

  // fields are 0-indexed, HL7 field numbers are 1-based
  const fieldValue: HL7Field | undefined = seg.fields[field - 1];
  if (!fieldValue) return '';

  const raw = fieldValue[repIdx]?.[compIdx]?.[subIdx] ?? '';
  return options.decode === true ? decodeEscapes(raw, msg.encoding) : raw;
}

/**
 * Extract a field value from a known segment reference (returned by {@link segment}
 * or {@link segments}).
 *
 * Equivalent to {@link get} but accepts an `HL7Segment` directly — useful when
 * iterating over repeating segments.
 *
 * @example
 * for (const obx of segments(msg, 'OBX')) {
 *   const value = getFromSegment(obx, msg, 5);  // OBX.5 for each OBX segment
 * }
 */
export function getFromSegment(
  seg: HL7Segment,
  msg: HL7Message,
  field: number,
  component?: number,
  subComponent?: number,
  options: Omit<GetOptions, 'segmentIndex'> = {},
): string {
  const repIdx  = (options.repetition ?? 1) - 1;
  const compIdx = (component          ?? 1) - 1;
  const subIdx  = (subComponent       ?? 1) - 1;

  const fieldValue: HL7Field | undefined = seg.fields[field - 1];
  if (!fieldValue) return '';

  const raw = fieldValue[repIdx]?.[compIdx]?.[subIdx] ?? '';
  return options.decode === true ? decodeEscapes(raw, msg.encoding) : raw;
}

/**
 * Return all repetitions of a field as a `string[][][]` structure (one entry
 * per repetition, preserving the `[component][subComponent]` shape).
 *
 * Useful for fields like PID.3 (patient identifier list) that carry multiple
 * typed identifiers — each with its own components — across repetitions.
 *
 * @example
 * const ids = getRepetitions(msg, 'PID', 3);
 * ids[0]?.[0]?.[0]  // → first identifier value  (PID.3[1].1)
 * ids[0]?.[3]?.[0]  // → first identifier's assigning authority (PID.3[1].4)
 * ids[1]?.[0]?.[0]  // → second identifier value (PID.3[2].1)
 */
export function getRepetitions(
  msg: HL7Message,
  segmentId: string,
  field: number,
  options: Omit<GetOptions, 'repetition'> = {},
): string[][][] {
  const segIdx = (options.segmentIndex ?? 1) - 1;

  const segs = msg.segments.filter(s => s.id === segmentId.toUpperCase());
  const seg  = segs[segIdx];
  if (!seg) return [];

  const fieldValue: HL7Field | undefined = seg.fields[field - 1];
  if (!fieldValue) return [];

  if (options.decode !== true) return fieldValue;

  return fieldValue.map(rep =>
    rep.map(comp =>
      comp.map(sub => decodeEscapes(sub, msg.encoding)),
    ),
  );
}
