export { parse, isHL7 } from './parser.js';
export type { ParseOptions } from './parser.js';

export { encode, encodeSegment } from './encoder.js';
export type { EncodeOptions } from './encoder.js';

export {
  segment,
  segments,
  hasSegment,
  get,
  getFromSegment,
  getRepetitions,
} from './query.js';
export type { GetOptions } from './query.js';

export { decodeEscapes, encodeEscapes } from './escape.js';
export { parseHL7DateTime, formatHL7DateTime, formatHL7Date } from './datetime.js';

export type {
  EncodingChars,
  HL7Field,
  HL7Segment,
  MessageType,
  HL7Message,
} from './schema.js';

export { DEFAULT_ENCODING } from './schema.js';

export {
  HL7ParseError,
  SegmentNotFoundError,
  InvalidHL7Error,
} from './errors.js';
