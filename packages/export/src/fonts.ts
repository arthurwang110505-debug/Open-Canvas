import type { DesignElement } from '@opencanvas/document';

/**
 * A font file the exporting app resolved to bytes. The renderer accepts the data instead of
 * reaching for the network itself, so it stays pure and testable.
 */
export interface EmbeddedFontFace {
  /** Family name exactly as `TextElement.fontFamily` spells it. */
  family: string;
  /** CSS weight descriptor: `"700"`, or a range such as `"100 900"` for a variable font. */
  weight: string;
  style: 'normal' | 'italic';
  /** Base64-encoded font binary, without the `data:` prefix. */
  data: string;
  /** Defaults to `woff2`. */
  format?: 'woff2' | 'woff' | 'truetype' | 'opentype';
}

/** A typeface the document asks for. Duplicates collapse, so it is a set in list form. */
export interface FontUsage {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
}

const SAFE_WEIGHT = /^\d{1,4}( \d{1,4})?$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const FORMATS: ReadonlySet<string> = new Set(['woff2', 'woff', 'truetype', 'opentype']);

/**
 * Fonts actually used by the given elements, including hidden ones (the caller decides what to
 * export) and nested group children. Order is stable so tests and snapshots stay readable.
 */
export function collectFontUsages(elements: readonly DesignElement[]): FontUsage[] {
  const seen = new Set<string>();
  const usages: FontUsage[] = [];
  const walk = (list: readonly DesignElement[]) => {
    for (const element of list) {
      if (element.type === 'group') {
        walk(element.children);
        continue;
      }
      if (element.type !== 'text') continue;
      const key = `${element.fontFamily}\u0000${element.fontWeight}\u0000${element.fontStyle}`;
      if (seen.has(key)) continue;
      seen.add(key);
      usages.push({
        family: element.fontFamily,
        weight: element.fontWeight,
        style: element.fontStyle,
      });
    }
  };
  walk(elements);
  return usages;
}

/** CSS-quotes a family name; quotes and backslashes cannot escape the string. */
function quoteFamily(family: string): string {
  return `"${family
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\n\r\f]/g, ' ')}"`;
}

function isFaceUsable(face: EmbeddedFontFace): boolean {
  if (face.family.trim().length === 0) return false;
  if (!SAFE_WEIGHT.test(face.weight)) return false;
  if (!FORMATS.has(face.format ?? 'woff2')) return false;
  if (face.data.length === 0 || !BASE64.test(face.data)) return false;
  return true;
}

/**
 * `@font-face` rules for the SVG's own stylesheet. Data URLs keep the file self-contained: it
 * renders identically offline, on another machine, and inside the `<img>` the PNG/PDF pipeline
 * rasterizes (where the page's fonts are not available). Faces that fail validation are dropped
 * rather than injected, so a malformed document can never emit raw CSS.
 */
export function buildFontFaceCss(faces: readonly EmbeddedFontFace[]): string {
  const rules: string[] = [];
  const seen = new Set<string>();
  for (const face of faces) {
    if (!isFaceUsable(face)) continue;
    const format = face.format ?? 'woff2';
    const key = `${face.family}\u0000${face.weight}\u0000${face.style}\u0000${format}\u0000${face.data.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push(
      `@font-face { font-family: ${quoteFamily(face.family)}; font-style: ${face.style}; ` +
        `font-weight: ${face.weight}; font-display: block; ` +
        `src: url(data:font/${format};base64,${face.data}) format("${format}"); }`,
    );
  }
  return rules.join('\n');
}
