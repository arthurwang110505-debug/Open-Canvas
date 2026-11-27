import type { DesignDocument, DesignElement, Fill, TextElement } from '@opencanvas/document';

/**
 * Whether a template can actually be read.
 *
 * A gallery thumbnail hides this: a design with invisible text still looks like a tasteful
 * arrangement of shapes at 120 pixels wide, and only turns out to be broken once someone picks
 * it and wonders where the headline went. So readability is measured here rather than eyeballed
 * — the same WCAG contrast maths a browser audit would use, against the colour actually painted
 * under each line of text.
 */

/** Contrast the body of a design must reach; the WCAG AA threshold for normal text. */
export const MIN_TEXT_CONTRAST = 4.5;
/** Large text carries its own weight, so AA relaxes it. */
export const MIN_LARGE_TEXT_CONTRAST = 3;
/** Pure ornament — an outsized quote mark — is a shape, judged as a graphic. */
export const MIN_ORNAMENT_CONTRAST = 1.6;

/** px. At or above this, text counts as large even at a normal weight. */
const LARGE_TEXT_SIZE = 30;
/** px. Bold text counts as large from here. */
const LARGE_BOLD_SIZE = 24;
const BOLD_WEIGHT = 600;

function channels(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((character) => character + character)
          .join('')
      : value.slice(0, 6);
  return [
    Number.parseInt(full.slice(0, 2), 16) || 0,
    Number.parseInt(full.slice(2, 4), 16) || 0,
    Number.parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function blend(base: string, over: string, alpha: number): string {
  const from = channels(base);
  const to = channels(over);
  return toHex([
    from[0] + (to[0] - from[0]) * alpha,
    from[1] + (to[1] - from[1]) * alpha,
    from[2] + (to[2] - from[2]) * alpha,
  ]);
}

/**
 * Nudges a colour until it reads against `backdrop`, keeping as much of it as possible.
 *
 * Moving a colour straight towards black or white holds its hue, so an amber eyebrow stays
 * amber — it just stops being the amber that disappears into cream. Darkening is tried first
 * on light backdrops (and lightening on dark ones) because that is the direction a designer
 * would pick; the other direction is the fallback for a colour already at the end of its range.
 */
/**
 * How far past the legal minimum a repaired colour aims.
 *
 * Stopping the instant a colour becomes legal leaves text sitting exactly on the line, which
 * looks washed out and fails the moment a backdrop shifts by a shade. A little headroom costs
 * nothing and is what a designer would have picked anyway.
 */
const CONTRAST_HEADROOM = 1.12;

/** Below this chroma a colour carries no brand identity worth preserving. */
const ACHROMATIC_CHROMA = 0.08;

function chromaOf(colour: string): number {
  const [r, g, b] = channels(colour);
  return Math.max(r, g, b) - Math.min(r, g, b);
}

/**
 * Returns `colour` if it already reads on `backdrop`, otherwise the nearest version of it that
 * does.
 *
 * A tinted colour is slid toward black or white only as far as it must go, so a brand red stays
 * recognisably red. A grey has no hue to protect, so it jumps to the clean pole instead of
 * crawling to a muddy mid-tone that technically passes and looks like a mistake.
 */
export function readableOn(colour: string, backdrop: string, minimum: number): string {
  if (contrastRatio(colour, backdrop) >= minimum) return colour;

  // Which pole wins is decided by measurement, not by calling the backdrop light or dark: a
  // mid-tone cyan is "light" by most rules yet still reads better under black than white.
  const pole =
    contrastRatio('#000000', backdrop) >= contrastRatio('#ffffff', backdrop)
      ? '#000000'
      : '#ffffff';
  const backdropIsLight = pole === '#000000';

  if (chromaOf(colour) < ACHROMATIC_CHROMA) return pole;

  const target = minimum * CONTRAST_HEADROOM;
  const directions = backdropIsLight ? ['#000000', '#ffffff'] : ['#ffffff', '#000000'];
  let firstLegal: string | null = null;

  for (const direction of directions) {
    for (let step = 1; step <= 24; step += 1) {
      const candidate = blend(colour, direction, step / 24);
      const ratio = contrastRatio(candidate, backdrop);
      if (ratio >= minimum && firstLegal === null) firstLegal = candidate;
      if (ratio >= target) return candidate;
    }
  }
  // Comfort was out of reach; take legality if we found it, otherwise the furthest extreme.
  return firstLegal ?? pole;
}

function solidColour(fill: Fill | undefined): string | null {
  if (!fill) return null;
  if (fill.type === 'solid') return fill.color;
  if (fill.type === 'linear' || fill.type === 'radial') {
    const stops = fill.stops;
    // The middle stop stands for the gradient: judging by one end flatters a design whose text
    // sits over the other.
    return stops.length > 0 ? (stops[Math.floor(stops.length / 2)]?.color ?? null) : null;
  }
  return null;
}

function covers(element: DesignElement, x: number, y: number): boolean {
  if (x < element.x || x > element.x + element.width) return false;
  if (y < element.y || y > element.y + element.height) return false;
  if (element.type === 'ellipse' || element.type === 'frame') {
    if (element.type === 'frame' && element.shape !== 'ellipse') return true;
    const rx = element.width / 2;
    const ry = element.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (x - (element.x + rx)) / rx;
    const dy = (y - (element.y + ry)) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return true;
}

function fillOf(element: DesignElement): Fill | undefined {
  return 'fill' in element ? element.fill : undefined;
}

/** The colour painted at a point by everything below `index` in the stack. */
export function backdropAt(
  elements: readonly DesignElement[],
  index: number,
  pageBackground: string,
  x: number,
  y: number,
): string {
  let colour = pageBackground;
  for (let i = 0; i < index; i += 1) {
    const element = elements[i];
    if (!element?.visible) continue;
    if (element.type === 'text' || element.type === 'icon' || element.type === 'group') continue;
    const painted = solidColour(fillOf(element));
    if (!painted) continue;
    if (!covers(element, x, y)) continue;
    colour = element.opacity >= 1 ? painted : blend(colour, painted, element.opacity);
  }
  return colour;
}

export interface ReadabilityFinding {
  text: string;
  fontSize: number;
  colour: string;
  backdrop: string;
  ratio: number;
  required: number;
}

/** True for text that is really a graphic: one outsized punctuation mark used as decoration. */
function isOrnament(element: TextElement): boolean {
  return element.text.trim().length <= 2 && element.fontSize >= 100;
}

function requiredContrast(element: TextElement): number {
  if (isOrnament(element)) return MIN_ORNAMENT_CONTRAST;
  const large =
    element.fontSize >= LARGE_TEXT_SIZE ||
    (element.fontSize >= LARGE_BOLD_SIZE && element.fontWeight >= BOLD_WEIGHT);
  return large ? MIN_LARGE_TEXT_CONTRAST : MIN_TEXT_CONTRAST;
}

/**
 * Every line of text in a design that does not meet its contrast threshold.
 *
 * The backdrop is sampled across the first line's box rather than guessed from the page
 * background, so text on a panel is judged against the panel. The most common sample wins:
 * text that clips the corner of a shape is judged by where the glyphs actually are.
 */
export function auditReadability(document: DesignDocument): ReadabilityFinding[] {
  const findings: ReadabilityFinding[] = [];
  for (const page of document.pages) {
    const pageBackground = solidColour(page.background) ?? '#ffffff';
    page.elements.forEach((element, index) => {
      if (element.type !== 'text' || !element.visible) return;
      const band = Math.min(element.height, element.fontSize * 1.1);
      const counts = new Map<string, number>();
      for (let column = 0; column <= 6; column += 1) {
        for (let row = 0; row <= 3; row += 1) {
          const colour = backdropAt(
            page.elements,
            index,
            pageBackground,
            element.x + (element.width * column) / 6,
            element.y + (band * row) / 3,
          );
          counts.set(colour, (counts.get(colour) ?? 0) + 1);
        }
      }
      const [backdrop] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [pageBackground];
      const ratio = contrastRatio(element.color, backdrop);
      const required = requiredContrast(element);
      if (ratio < required) {
        findings.push({
          text: element.text.replace(/\n/g, ' ').slice(0, 32),
          fontSize: element.fontSize,
          colour: element.color,
          backdrop,
          ratio,
          required,
        });
      }
    });
  }
  return findings;
}
