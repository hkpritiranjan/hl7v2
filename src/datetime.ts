import { HL7ParseError } from './errors.js';

/**
 * Parse an HL7 v2 Date/Time string into a JavaScript `Date`.
 *
 * Supported formats (per HL7 v2 spec section 2.8.21):
 * - `YYYY`
 * - `YYYYMM`
 * - `YYYYMMDD`
 * - `YYYYMMDDHHMM`
 * - `YYYYMMDDHHMMSS`
 * - `YYYYMMDDHHMMSS.S[SSS]`
 * - Any of the above with `+HHMM` or `-HHMM` timezone offset suffix
 *
 * @returns A `Date` object in UTC, or `undefined` if the value is empty.
 * @throws {HL7ParseError} If the string is non-empty but unparseable.
 */
export function parseHL7DateTime(raw: string): Date | undefined {
  const s = raw.trim();
  if (!s) return undefined;

  // Minimum valid length is 4 (year only)
  if (s.length < 4) {
    throw new HL7ParseError(`Cannot parse HL7 date/time: "${s}" — minimum format is YYYY`);
  }

  // Extract optional timezone offset: +HHMM or -HHMM at end
  let base = s;
  let offsetMin = 0;

  const tzMatch = /([+-])(\d{2})(\d{2})$/.exec(s);
  if (tzMatch) {
    const sign = tzMatch[1] === '+' ? 1 : -1;
    const tzHours = parseInt(tzMatch[2] ?? '0', 10);
    const tzMins  = parseInt(tzMatch[3] ?? '0', 10);
    offsetMin = sign * (tzHours * 60 + tzMins);
    base = s.slice(0, s.length - 5);
  }

  // Parse fractional seconds: YYYYMMDDHHMMSS.SSSS
  let fracMs = 0;
  const dotIdx = base.indexOf('.');
  if (dotIdx !== -1) {
    const fracStr = base.slice(dotIdx);
    fracMs = Math.round(parseFloat(fracStr) * 1000);
    base = base.slice(0, dotIdx);
  }

  const year  = parseInt(base.slice(0, 4),  10);
  const month = parseInt(base.slice(4, 6)  || '01', 10) - 1; // 0-indexed
  const day   = parseInt(base.slice(6, 8)  || '01', 10);
  const hour  = parseInt(base.slice(8, 10) || '00', 10);
  const min   = parseInt(base.slice(10, 12)|| '00', 10);
  const sec   = parseInt(base.slice(12, 14)|| '00', 10);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new HL7ParseError(`Cannot parse HL7 date/time: "${s}"`);
  }

  // Build UTC epoch, then subtract the timezone offset to normalise to UTC
  const utcMs = Date.UTC(year, month, day, hour, min, sec, fracMs) - offsetMin * 60_000;
  const result = new Date(utcMs);

  if (isNaN(result.getTime())) {
    throw new HL7ParseError(`Cannot parse HL7 date/time: "${s}"`);
  }

  return result;
}

/**
 * Format a JavaScript `Date` as an HL7 v2 timestamp string in UTC.
 * Output format: `YYYYMMDDHHMMSS`
 */
export function formatHL7DateTime(date: Date): string {
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds())
  );
}

/**
 * Format a JavaScript `Date` as an HL7 v2 date-only string in UTC.
 * Output format: `YYYYMMDD`
 */
export function formatHL7Date(date: Date): string {
  const pad = (n: number, len = 2): string => String(n).padStart(len, '0');
  return (
    pad(date.getUTCFullYear(), 4) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate())
  );
}
