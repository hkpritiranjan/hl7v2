import { decodeEscapes } from '../escape.js';
import { parseHL7DateTime } from '../datetime.js';
import type { EncodingChars, HL7Field, HL7Segment } from '../schema.js';

/**
 * Base class for typed HL7 v2 segment accessors.
 *
 * Typed segments wrap an {@link HL7Segment} and provide strongly-typed,
 * documented accessor methods for each field — eliminating the need to
 * remember field numbers or component positions.
 *
 * @example
 * import { PID } from 'hl7v2/segments';
 * import { parse, segment } from 'hl7v2';
 *
 * const msg = parse(rawString);
 * const pid = new PID(segment(msg, 'PID'), msg.encoding);
 *
 * pid.patientName()   // { family: 'Doe', given: 'John', middle: 'A' }
 * pid.dateOfBirth()   // Date | undefined
 * pid.sex()           // 'M' | 'F' | 'O' | 'U' | undefined
 */
export abstract class TypedSegment {
  constructor(
    protected readonly seg: HL7Segment,
    protected readonly enc: EncodingChars,
  ) {}

  /** The raw underlying {@link HL7Segment}. */
  get raw(): HL7Segment {
    return this.seg;
  }

  /** Return the raw field structure at the given 1-based field number. */
  protected field(num: number): HL7Field | undefined {
    return this.seg.fields[num - 1];
  }

  /**
   * Extract a scalar string value from the segment.
   * All arguments are 1-based. Missing elements return `''`.
   * Escape sequences are decoded automatically.
   */
  protected str(
    fieldNum: number,
    component = 1,
    subComponent = 1,
    repetition = 1,
  ): string {
    const f = this.field(fieldNum);
    if (!f) return '';
    const raw = f[repetition - 1]?.[component - 1]?.[subComponent - 1] ?? '';
    return decodeEscapes(raw, this.enc);
  }

  /**
   * Extract a string value from the segment without escape decoding.
   * Useful when you need to preserve the raw HL7 encoding.
   */
  protected rawStr(
    fieldNum: number,
    component = 1,
    subComponent = 1,
    repetition = 1,
  ): string {
    const f = this.field(fieldNum);
    if (!f) return '';
    return f[repetition - 1]?.[component - 1]?.[subComponent - 1] ?? '';
  }

  /** Extract a Date from an HL7 date/time field. Returns `undefined` if empty. */
  protected date(fieldNum: number, component = 1): Date | undefined {
    const raw = this.rawStr(fieldNum, component);
    if (!raw) return undefined;
    try {
      return parseHL7DateTime(raw);
    } catch {
      return undefined;
    }
  }

  /** Extract a numeric value from a field. Returns `undefined` if empty or non-numeric. */
  protected num(fieldNum: number, component = 1): number | undefined {
    const raw = this.str(fieldNum, component);
    if (!raw) return undefined;
    const n = parseFloat(raw);
    return isNaN(n) ? undefined : n;
  }

  /** Return all repetitions of a field as an array of first-component strings. */
  protected repetitions(fieldNum: number, component = 1): string[] {
    const f = this.field(fieldNum);
    if (!f) return [];
    return f.map(rep => {
      const raw = rep[component - 1]?.[0] ?? '';
      return decodeEscapes(raw, this.enc);
    }).filter(v => v !== '');
  }
}
