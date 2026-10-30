import {
  flattenElements,
  type DesignElement,
  type Fill,
  type Page,
  type TextElement,
} from '@opencanvas/document';

/**
 * A brand kit is the small set of colors and fonts a user reaches for in every design. It is
 * deliberately stored outside documents (see `brandStore.ts`): a kit belongs to the person,
 * not to one design, and keeping it out of the document schema means it can evolve freely.
 */
export interface BrandKit {
  /** `#rrggbb` colors, most important first. */
  colors: string[];
  headingFont: string;
  bodyFont: string;
}

export const BRAND_KIT_STORAGE_KEY = 'opencanvas:brand-kit:v1';
export const MAX_BRAND_COLORS = 12;

export const DEFAULT_BRAND_KIT: BrandKit = {
  colors: ['#6d45e8', '#1f2430', '#ff6b5e', '#f59e0b', '#0ea5a4', '#ffffff'],
  headingFont: 'Playfair Display',
  bodyFont: 'Inter',
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

/** Normalizes `#rgb`/`#rrggbb` input to lowercase `#rrggbb`; anything else is not a color. */
export function normalizeBrandColor(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!HEX_COLOR.test(trimmed)) return null;
  if (trimmed.length === 4) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return trimmed;
}

function sanitizeKit(candidate: unknown): BrandKit {
  if (typeof candidate !== 'object' || candidate === null) return DEFAULT_BRAND_KIT;
  const record = candidate as { colors?: unknown; headingFont?: unknown; bodyFont?: unknown };
  const colors: string[] = [];
  if (Array.isArray(record.colors)) {
    for (const entry of record.colors) {
      if (typeof entry !== 'string') continue;
      const color = normalizeBrandColor(entry);
      if (color && !colors.includes(color)) colors.push(color);
      if (colors.length >= MAX_BRAND_COLORS) break;
    }
  }
  return {
    colors,
    headingFont:
      typeof record.headingFont === 'string' && record.headingFont.length > 0
        ? record.headingFont
        : DEFAULT_BRAND_KIT.headingFont,
    bodyFont:
      typeof record.bodyFont === 'string' && record.bodyFont.length > 0
        ? record.bodyFont
        : DEFAULT_BRAND_KIT.bodyFont,
  };
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Reads the saved kit. Corrupt or unavailable storage degrades to the default kit. */
export function loadBrandKit(storage: Storage | null = defaultStorage()): BrandKit {
  if (!storage) return DEFAULT_BRAND_KIT;
  try {
    const raw = storage.getItem(BRAND_KIT_STORAGE_KEY);
    if (!raw) return DEFAULT_BRAND_KIT;
    return sanitizeKit(JSON.parse(raw));
  } catch {
    return DEFAULT_BRAND_KIT;
  }
}

/** Persists the kit. Storage failures (private mode, quota) are silent: the kit still works for the session. */
export function saveBrandKit(kit: BrandKit, storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(BRAND_KIT_STORAGE_KEY, JSON.stringify(kit));
  } catch {
    // The in-memory kit remains authoritative for this session.
  }
}

function fillColors(fill: Fill | undefined, into: string[]): void {
  if (!fill || fill.type === 'none') return;
  if (fill.type === 'solid') {
    const color = normalizeBrandColor(fill.color);
    if (color && !into.includes(color)) into.push(color);
    return;
  }
  for (const stop of fill.stops) {
    const color = normalizeBrandColor(stop.color);
    if (color && !into.includes(color)) into.push(color);
  }
}

/**
 * The distinct colors already used on a page — solid and gradient fills, text, icons, strokes,
 * and finally the page background — in first-use order. Lets a user seed a kit from a design
 * they already like instead of picking colors from scratch.
 */
export function extractPageColors(page: Page): string[] {
  const colors: string[] = [];
  for (const element of flattenElements(page.elements)) {
    if (element.type === 'text' || element.type === 'icon') {
      const color = normalizeBrandColor(element.color);
      if (color && !colors.includes(color)) colors.push(color);
    }
    if ('fill' in element) fillColors(element.fill, colors);
    if ('stroke' in element && element.stroke) {
      const color = normalizeBrandColor(element.stroke.color);
      if (color && !colors.includes(color)) colors.push(color);
    }
    if (colors.length >= MAX_BRAND_COLORS) return colors;
  }
  fillColors(page.background, colors);
  return colors.slice(0, MAX_BRAND_COLORS);
}

export interface BrandFontPlan {
  /** The page's elements with brand fonts applied (a fresh tree; the input is untouched). */
  elements: DesignElement[];
  /** Text elements assigned the heading font (largest text on the page). */
  headingCount: number;
  /** Text elements assigned the body font. */
  bodyCount: number;
  /** Text elements whose font actually changes — zero means the page already matches. */
  changedCount: number;
  textCount: number;
}

/**
 * Plans "apply brand fonts to this page" without touching the document. The largest text
 * (within 60% of the page's largest size, and at least 24px) reads as headings and takes the
 * heading font; everything else takes the body font. Grouped text is included, and the caller
 * commits the result as a single page-content replacement, so one undo restores every font.
 */
export function planBrandFontApplication(
  elements: readonly DesignElement[],
  kit: BrandKit,
): BrandFontPlan {
  const texts = flattenElements(elements).filter(
    (element): element is TextElement => element.type === 'text',
  );
  if (texts.length === 0) {
    return {
      elements: [...elements],
      headingCount: 0,
      bodyCount: 0,
      changedCount: 0,
      textCount: 0,
    };
  }
  const largest = Math.max(...texts.map((element) => element.fontSize));
  const headingThreshold = Math.max(24, largest * 0.6);
  let headingCount = 0;
  let bodyCount = 0;
  let changedCount = 0;

  const walk = (list: readonly DesignElement[]): DesignElement[] =>
    list.map((element) => {
      if (element.type === 'text') {
        const isHeading = element.fontSize >= headingThreshold;
        const fontFamily = isHeading ? kit.headingFont : kit.bodyFont;
        if (isHeading) headingCount += 1;
        else bodyCount += 1;
        if (element.fontFamily !== fontFamily) changedCount += 1;
        return element.fontFamily === fontFamily ? element : { ...element, fontFamily };
      }
      if (element.type === 'group') return { ...element, children: walk(element.children) };
      return element;
    });

  return {
    elements: walk(elements),
    headingCount,
    bodyCount,
    changedCount,
    textCount: texts.length,
  };
}
