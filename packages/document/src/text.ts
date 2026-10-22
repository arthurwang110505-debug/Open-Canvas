import type { ListStyle, TextTransform } from './schema';

/**
 * Space a list needs in front of its text, in ems. Canvas and export both wrap at
 * `width - fontSize * LIST_INDENT_EM` so a marker never pushes a line past the box.
 */
export const LIST_INDENT_EM = 1.5;

/**
 * Applies a display casing to text. Renderers call this on their way to the screen; the element
 * keeps the characters the author typed, so switching back to `none` restores them exactly.
 *
 * `capitalize` follows CSS: the first letter of each word is uppercased and the rest of the word
 * is left alone — typing in mixed case must not be silently rewritten.
 */
export function applyTextTransform(text: string, transform: TextTransform): string {
  switch (transform) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'capitalize':
      return text.replace(
        /(^|\s)(\p{L})/gu,
        (_match, prefix: string, letter: string) => prefix + letter.toUpperCase(),
      );
    case 'none':
      return text;
  }
}

/** The marker drawn before list item `index` (1-based); text itself is never prefixed. */
export function listMarker(style: Exclude<ListStyle, 'none'>, index: number): string {
  return style === 'bullet' ? '•' : `${index}.`;
}

/** The prefix (marker plus space) for list item `index` (1-based); empty when there is no list. */
export function listPrefix(style: ListStyle, index: number): string {
  if (style === 'none') return '';
  return `${listMarker(style, index)} `;
}

/**
 * Decorates rendered lines with list markers. Line breaks stay where the layout put them, so a
 * wrapped paragraph gets a marker on every visual line, exactly like a Canva text box. Blank
 * lines are left alone and do not consume a number.
 */
export function applyListMarkers(lines: readonly string[], style: ListStyle): string[] {
  if (style === 'none') return [...lines];
  let number = 0;
  return lines.map((line) => {
    if (line.trim().length === 0) return line;
    number += 1;
    return `${listPrefix(style, number)}${line}`;
  });
}
