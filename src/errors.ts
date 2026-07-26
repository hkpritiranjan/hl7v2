/**
 * Thrown when an HL7 v2 message string cannot be parsed.
 *
 * The `line` and `segmentId` properties help pinpoint the exact failure location
 * when debugging multi-segment messages from production systems.
 */
export class HL7ParseError extends Error {
  /** 1-based line number in the source string where the error occurred. */
  readonly line: number | undefined;
  /** Segment identifier that was being parsed when the error occurred. */
  readonly segmentId: string | undefined;

  constructor(
    message: string,
    options?: { line?: number; segmentId?: string; cause?: unknown },
  ) {
    super(message);
    this.name = 'HL7ParseError';
    this.line = options?.line;
    this.segmentId = options?.segmentId;
    if (options?.cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        value: options.cause,
        writable: true,
        configurable: true,
      });
    }
  }
}

/**
 * Thrown when a required segment is not present in the message.
 *
 * @example
 * // Thrown by segment() when the segment is not found
 * const pid = segment(msg, 'PID'); // throws if no PID segment
 */
export class SegmentNotFoundError extends Error {
  readonly segmentId: string;

  constructor(segmentId: string) {
    super(
      `Segment '${segmentId}' not found in message. ` +
        `Use hasSegment() to check before calling segment(), ` +
        `or segments() to get an empty array when absent.`,
    );
    this.name = 'SegmentNotFoundError';
    this.segmentId = segmentId;
  }
}

/**
 * Thrown when an HL7 message cannot be identified as valid HL7 v2.
 * Usually means the input is empty, truncated, or a completely different format.
 */
export class InvalidHL7Error extends Error {
  constructor(reason: string) {
    super(`Input is not a valid HL7 v2 message: ${reason}`);
    this.name = 'InvalidHL7Error';
  }
}
