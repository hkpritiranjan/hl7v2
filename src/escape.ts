import type { EncodingChars } from './schema.js';

/** Escape a string for use in a regex character class. */
function escRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Decode HL7 v2 escape sequences within a field value.
 *
 * Handles all standard sequences defined in the HL7 v2.x specification:
 * - `\F\`   → field separator
 * - `\S\`   → component separator
 * - `\T\`   → sub-component separator
 * - `\R\`   → repetition separator
 * - `\E\`   → escape character
 * - `\H\`   → start highlighting (stripped — presentation concern)
 * - `\N\`   → normal text / end highlighting (stripped)
 * - `\.br\` → carriage return / line break → `\n`
 * - `\Xhh…\` → hex-encoded bytes → UTF-8 string
 *
 * Unknown or locally-defined sequences (`\Zxxx\`) are preserved as-is.
 *
 * @param value - Raw field value that may contain escape sequences
 * @param enc   - Encoding characters from the message's MSH segment
 */
export function decodeEscapes(value: string, enc: EncodingChars): string {
  const esc = enc.escape;
  if (!value.includes(esc)) return value;

  const pattern = new RegExp(`${escRx(esc)}([^${escRx(esc)}]*)${escRx(esc)}`, 'g');

  return value.replace(pattern, (match: string, seq: string): string => {
    switch (seq) {
      case 'F':   return enc.field;
      case 'S':   return enc.component;
      case 'T':   return enc.subComponent;
      case 'R':   return enc.repetition;
      case 'E':   return enc.escape;
      case 'H':   return '\x1b[1m';
      case 'N':   return '\x1b[0m';
      case '.br': return '\n';
      default: {
        if (seq.startsWith('X') && seq.length > 1) {
          try {
            const hex = seq.slice(1);
            const bytes = new Uint8Array(hex.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) ?? []);
            return new TextDecoder().decode(bytes);
          } catch {
            return match;
          }
        }
        // Preserve unknown / locally-defined sequences unchanged
        return match;
      }
    }
  });
}

/**
 * Encode a plain string value for safe inclusion in an HL7 v2 field,
 * escaping any characters that have special meaning in the given encoding.
 *
 * Characters are escaped in this order to avoid double-escaping:
 * 1. Escape character itself (`\E\`)
 * 2. Field separator     (`\F\`)
 * 3. Component separator (`\S\`)
 * 4. Repetition separator(`\R\`)
 * 5. Sub-component sep   (`\T\`)
 *
 * @param value - Plain string to encode
 * @param enc   - Encoding characters from the target message
 */
export function encodeEscapes(value: string, enc: EncodingChars): string {
  const esc = enc.escape;
  // Escape the escape character first to avoid double-escaping
  return value
    .replace(new RegExp(escRx(esc), 'g'), `${esc}E${esc}`)
    .replace(new RegExp(escRx(enc.field), 'g'), `${esc}F${esc}`)
    .replace(new RegExp(escRx(enc.component), 'g'), `${esc}S${esc}`)
    .replace(new RegExp(escRx(enc.repetition), 'g'), `${esc}R${esc}`)
    .replace(new RegExp(escRx(enc.subComponent), 'g'), `${esc}T${esc}`);
}
