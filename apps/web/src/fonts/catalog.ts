/**
 * The typefaces that ship with OpenCanvas.
 *
 * Every family here is an OFL font served from the app itself (via @fontsource), so a document
 * looks the same offline and needs no account, CDN or Google Fonts request. The same URLs feed
 * both the editor (an `@font-face` stylesheet, see `install.ts`) and exports (base64 bytes inside
 * the SVG, see `embed.ts`), which is what keeps a download matching the canvas.
 */
import archivoItalic from '@fontsource-variable/archivo/files/archivo-latin-wght-italic.woff2?url';
import archivoNormal from '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2?url';
import bricolageNormal from '@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2?url';
import caveatNormal from '@fontsource-variable/caveat/files/caveat-latin-wght-normal.woff2?url';
import dmSansItalic from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2?url';
import dmSansNormal from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import frauncesItalic from '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url';
import frauncesNormal from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url';
import interItalic from '@fontsource-variable/inter/files/inter-latin-wght-italic.woff2?url';
import interNormal from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import manropeNormal from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import oswaldNormal from '@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url';
import outfitNormal from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url';
import playfairItalic from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2?url';
import playfairNormal from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url';
import soraNormal from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';
import spaceGroteskNormal from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
import dmSerifItalic from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2?url';
import dmSerifNormal from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import instrumentSerifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import instrumentSerifNormal from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import libreBaskerville400Italic from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2?url';
import libreBaskerville400Normal from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url';
import libreBaskerville700Italic from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-italic.woff2?url';
import libreBaskerville700Normal from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url';

export type FontCategory = 'Sans serif' | 'Serif' | 'Handwriting';

export interface BundledFontFace {
  /** CSS weight descriptor for the file: a single weight, or a range for a variable font. */
  weight: string;
  style: 'normal' | 'italic';
  url: string;
}

export interface BundledFontFamily {
  family: string;
  category: FontCategory;
  /** Weights offered in the editor; the font picker never offers a weight the face lacks. */
  weights: readonly number[];
  faces: readonly BundledFontFace[];
}

const FONT_WEIGHT_STEPS: readonly number[] = [100, 200, 300, 400, 500, 600, 700, 800, 900];

interface VariableSpec {
  family: string;
  category: FontCategory;
  min: number;
  max: number;
  normal: string;
  italic?: string;
}

function variableFont(spec: VariableSpec): BundledFontFamily {
  const weight = `${spec.min} ${spec.max}`;
  return {
    family: spec.family,
    category: spec.category,
    weights: FONT_WEIGHT_STEPS.filter((step) => step >= spec.min && step <= spec.max),
    faces: [
      { weight, style: 'normal', url: spec.normal },
      ...(spec.italic ? [{ weight, style: 'italic' as const, url: spec.italic }] : []),
    ],
  };
}

function staticFont(
  family: string,
  category: FontCategory,
  files: readonly { weight: number; normal: string; italic?: string }[],
): BundledFontFamily {
  return {
    family,
    category,
    weights: files.map((file) => file.weight),
    faces: files.flatMap((file) => [
      { weight: String(file.weight), style: 'normal' as const, url: file.normal },
      ...(file.italic
        ? [{ weight: String(file.weight), style: 'italic' as const, url: file.italic }]
        : []),
    ]),
  };
}

export const FONT_FAMILIES: readonly BundledFontFamily[] = [
  variableFont({
    family: 'Inter',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: interNormal,
    italic: interItalic,
  }),
  variableFont({
    family: 'DM Sans',
    category: 'Sans serif',
    min: 100,
    max: 1000,
    normal: dmSansNormal,
    italic: dmSansItalic,
  }),
  variableFont({
    family: 'Manrope',
    category: 'Sans serif',
    min: 200,
    max: 800,
    normal: manropeNormal,
  }),
  variableFont({
    family: 'Space Grotesk',
    category: 'Sans serif',
    min: 300,
    max: 700,
    normal: spaceGroteskNormal,
  }),
  variableFont({ family: 'Sora', category: 'Sans serif', min: 100, max: 800, normal: soraNormal }),
  variableFont({
    family: 'Archivo',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: archivoNormal,
    italic: archivoItalic,
  }),
  variableFont({
    family: 'Outfit',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: outfitNormal,
  }),
  variableFont({
    family: 'Bricolage Grotesque',
    category: 'Sans serif',
    min: 200,
    max: 800,
    normal: bricolageNormal,
  }),
  variableFont({
    family: 'Oswald',
    category: 'Sans serif',
    min: 200,
    max: 700,
    normal: oswaldNormal,
  }),
  variableFont({
    family: 'Playfair Display',
    category: 'Serif',
    min: 400,
    max: 900,
    normal: playfairNormal,
    italic: playfairItalic,
  }),
  variableFont({
    family: 'Fraunces',
    category: 'Serif',
    min: 100,
    max: 900,
    normal: frauncesNormal,
    italic: frauncesItalic,
  }),
  staticFont('DM Serif Display', 'Serif', [
    { weight: 400, normal: dmSerifNormal, italic: dmSerifItalic },
  ]),
  staticFont('Instrument Serif', 'Serif', [
    { weight: 400, normal: instrumentSerifNormal, italic: instrumentSerifItalic },
  ]),
  staticFont('Libre Baskerville', 'Serif', [
    {
      weight: 400,
      normal: libreBaskerville400Normal,
      italic: libreBaskerville400Italic,
    },
    {
      weight: 700,
      normal: libreBaskerville700Normal,
      italic: libreBaskerville700Italic,
    },
  ]),
  variableFont({
    family: 'Caveat',
    category: 'Handwriting',
    min: 400,
    max: 700,
    normal: caveatNormal,
  }),
];

/** Families in picker order, grouped for `<optgroup>`. */
export const FONT_CATEGORIES: readonly { label: FontCategory; families: BundledFontFamily[] }[] = (
  ['Sans serif', 'Serif', 'Handwriting'] as const
).map((label) => ({
  label,
  families: FONT_FAMILIES.filter((font) => font.category === label),
}));

export const FONT_FAMILY_NAMES: readonly string[] = FONT_FAMILIES.map((font) => font.family);

export function findFontFamily(family: string): BundledFontFamily | undefined {
  return FONT_FAMILIES.find((font) => font.family === family);
}

/** Weights a picker should offer for `family`, keeping a document value that is out of range. */
export function fontWeightsFor(family: string, current?: number): readonly number[] {
  const weights = findFontFamily(family)?.weights ?? FONT_WEIGHT_STEPS;
  if (current === undefined || weights.includes(current)) return weights;
  return [...weights, current].sort((a, b) => a - b);
}

/** The bundled faces for a family; empty for any other family (e.g. a legacy system font). */
export function fontFacesFor(family: string): readonly BundledFontFace[] {
  return findFontFamily(family)?.faces ?? [];
}
