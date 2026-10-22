import type { EmbeddedFontFace, FontUsage } from '@opencanvas/export';

import { fontFacesFor, type BundledFontFace } from './catalog';

/** Reads a bundled font file. Injectable so tests do not need `fetch` or real assets. */
export type FontFileLoader = (url: string) => Promise<Uint8Array>;

async function fetchFontFile(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`the font file was not served (HTTP ${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Base64 for a byte array, chunked so large fonts cannot overflow the argument limit. */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (const byte of chunk) binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function weightRange(descriptor: string): [number, number] {
  const [first = 400, second = first] = descriptor.split(/\s+/).map(Number);
  const min = Number.isFinite(first) ? first : 400;
  const max = Number.isFinite(second) ? second : min;
  return [Math.min(min, max), Math.max(min, max)];
}

/** The bundled face that renders `weight` most faithfully, preferring the requested style. */
function pickFace(
  faces: readonly BundledFontFace[],
  weight: number,
  style: 'normal' | 'italic',
): BundledFontFace | undefined {
  const styled = faces.filter((face) => face.style === style);
  // A family without an italic file still renders italic text: the browser slants the upright
  // face, so embed that rather than dropping the family.
  const pool = styled.length > 0 ? styled : faces.filter((face) => face.style === 'normal');
  let best: BundledFontFace | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const face of pool) {
    const [min, max] = weightRange(face.weight);
    const distance = weight < min ? min - weight : weight > max ? weight - max : 0;
    if (distance < bestDistance) {
      best = face;
      bestDistance = distance;
    }
  }
  return best;
}

const byteCache = new Map<string, Promise<Uint8Array>>();

function loadBytes(url: string, load: FontFileLoader): Promise<Uint8Array> {
  const cached = byteCache.get(url);
  if (cached) return cached;
  const pending = load(url);
  byteCache.set(url, pending);
  // A failed read must not poison later exports.
  pending.catch(() => byteCache.delete(url));
  return pending;
}

/**
 * Turns the fonts a document uses into embeddable faces. Families OpenCanvas does not bundle
 * (a legacy document may still name a system font) are skipped: they cannot be embedded, and
 * the SVG keeps asking for them by name so the viewer substitutes its own.
 *
 * A bundled family that cannot be read is an error rather than a silent fallback: exporting a
 * design in the wrong typeface is worse than telling the user to try again.
 */
export async function resolveFontFaces(
  usages: readonly FontUsage[],
  load: FontFileLoader = fetchFontFile,
): Promise<EmbeddedFontFace[]> {
  const resolved = new Map<string, EmbeddedFontFace>();
  for (const usage of usages) {
    const face = pickFace(fontFacesFor(usage.family), usage.weight, usage.style);
    if (!face) continue;
    const key = `${usage.family}\u0000${face.style}\u0000${face.weight}\u0000${face.url}`;
    if (resolved.has(key)) continue;
    let bytes: Uint8Array;
    try {
      bytes = await loadBytes(face.url, load);
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`The font "${usage.family}" could not be embedded: ${reason}`, { cause });
    }
    resolved.set(key, {
      family: usage.family,
      weight: face.weight,
      style: face.style,
      data: bytesToBase64(bytes),
    });
  }
  return [...resolved.values()];
}

/**
 * Waits for the bundled fonts a page uses, so measured line breaks match what the canvas shows
 * (measurement before the font arrives would use the fallback metrics).
 */
export async function ensureFontsLoaded(usages: readonly FontUsage[]): Promise<void> {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts || typeof fonts.load !== 'function') return;
  await Promise.all(
    usages.map((usage) =>
      fonts.load(`${usage.style} ${usage.weight} 16px "${usage.family}"`).catch(() => []),
    ),
  );
}
