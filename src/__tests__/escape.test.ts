import { describe, it, expect } from 'vitest';
import { decodeEscapes, encodeEscapes } from '../escape.js';
import { DEFAULT_ENCODING } from '../schema.js';

const enc = DEFAULT_ENCODING;

describe('decodeEscapes', () => {
  it('returns plain string unchanged', () => {
    expect(decodeEscapes('hello world', enc)).toBe('hello world');
  });

  it('decodes \\F\\ to field separator', () => {
    expect(decodeEscapes('a\\F\\b', enc)).toBe('a|b');
  });

  it('decodes \\S\\ to component separator', () => {
    expect(decodeEscapes('a\\S\\b', enc)).toBe('a^b');
  });

  it('decodes \\T\\ to sub-component separator', () => {
    expect(decodeEscapes('a\\T\\b', enc)).toBe('a&b');
  });

  it('decodes \\R\\ to repetition separator', () => {
    expect(decodeEscapes('a\\R\\b', enc)).toBe('a~b');
  });

  it('decodes \\E\\ to escape character', () => {
    expect(decodeEscapes('a\\E\\b', enc)).toBe('a\\b');
  });

  it('decodes \\H\\ to start of highlighting', () => {
    expect(decodeEscapes('a\\H\\b', enc)).toBe('a\x1b[1mb');
  });

  it('decodes \\N\\ to end of highlighting', () => {
    expect(decodeEscapes('a\\N\\b', enc)).toBe('a\x1b[0mb');
  });

  it('decodes \\.br\\ to newline', () => {
    expect(decodeEscapes('line1\\.br\\line2', enc)).toBe('line1\nline2');
  });

  it('decodes hex escape \\X41\\ to character A', () => {
    expect(decodeEscapes('\\X41\\', enc)).toBe('A');
  });

  it('decodes multiple hex bytes \\X48656c6c6f\\ to Hello', () => {
    expect(decodeEscapes('\\X48656c6c6f\\', enc)).toBe('Hello');
  });

  it('decodes multiple escape sequences in one string', () => {
    expect(decodeEscapes('Dr\\S\\Smith\\F\\MD', enc)).toBe('Dr^Smith|MD');
  });

  it('leaves unknown escape sequences as-is', () => {
    expect(decodeEscapes('a\\Z\\b', enc)).toBe('a\\Z\\b');
  });

  it('handles empty string', () => {
    expect(decodeEscapes('', enc)).toBe('');
  });

  it('handles string with no escape sequences', () => {
    const s = 'John Doe 1234567890';
    expect(decodeEscapes(s, enc)).toBe(s);
  });
});

describe('encodeEscapes', () => {
  it('returns plain string unchanged', () => {
    expect(encodeEscapes('hello world', enc)).toBe('hello world');
  });

  it('encodes field separator', () => {
    expect(encodeEscapes('a|b', enc)).toBe('a\\F\\b');
  });

  it('encodes component separator', () => {
    expect(encodeEscapes('a^b', enc)).toBe('a\\S\\b');
  });

  it('encodes repetition separator', () => {
    expect(encodeEscapes('a~b', enc)).toBe('a\\R\\b');
  });

  it('encodes sub-component separator', () => {
    expect(encodeEscapes('a&b', enc)).toBe('a\\T\\b');
  });

  it('encodes escape character first to avoid double-encoding', () => {
    expect(encodeEscapes('a\\b', enc)).toBe('a\\E\\b');
  });

  it('encodes escape before other separators in mixed string', () => {
    expect(encodeEscapes('a\\|b', enc)).toBe('a\\E\\\\F\\b');
  });

  it('handles empty string', () => {
    expect(encodeEscapes('', enc)).toBe('');
  });

  describe('round-trip', () => {
    it('encode → decode is identity for plain text', () => {
      const s = 'Dr. Jane Smith, M.D.';
      expect(decodeEscapes(encodeEscapes(s, enc), enc)).toBe(s);
    });

    it('encode → decode is identity for text with separators', () => {
      const s = 'value|with^all~separators&here\\and\\escapes';
      expect(decodeEscapes(encodeEscapes(s, enc), enc)).toBe(s);
    });
  });
});
