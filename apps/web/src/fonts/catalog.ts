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
import cormorantItalic from '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-italic.woff2?url';
import cormorantNormal from '@fontsource-variable/cormorant-garamond/files/cormorant-garamond-latin-wght-normal.woff2?url';
import dmSansItalic from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-italic.woff2?url';
import dmSansNormal from '@fontsource-variable/dm-sans/files/dm-sans-latin-wght-normal.woff2?url';
import ebGaramondItalic from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-italic.woff2?url';
import ebGaramondNormal from '@fontsource-variable/eb-garamond/files/eb-garamond-latin-wght-normal.woff2?url';
import figtreeItalic from '@fontsource-variable/figtree/files/figtree-latin-wght-italic.woff2?url';
import figtreeNormal from '@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2?url';
import frauncesItalic from '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url';
import frauncesNormal from '@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url';
import interItalic from '@fontsource-variable/inter/files/inter-latin-wght-italic.woff2?url';
import interNormal from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import karlaItalic from '@fontsource-variable/karla/files/karla-latin-wght-italic.woff2?url';
import karlaNormal from '@fontsource-variable/karla/files/karla-latin-wght-normal.woff2?url';
import loraItalic from '@fontsource-variable/lora/files/lora-latin-wght-italic.woff2?url';
import loraNormal from '@fontsource-variable/lora/files/lora-latin-wght-normal.woff2?url';
import manropeNormal from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2?url';
import merriweatherItalic from '@fontsource-variable/merriweather/files/merriweather-latin-wght-italic.woff2?url';
import merriweatherNormal from '@fontsource-variable/merriweather/files/merriweather-latin-wght-normal.woff2?url';
import montserratItalic from '@fontsource-variable/montserrat/files/montserrat-latin-wght-italic.woff2?url';
import montserratNormal from '@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2?url';
import nunitoItalic from '@fontsource-variable/nunito/files/nunito-latin-wght-italic.woff2?url';
import nunitoNormal from '@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2?url';
import openSansItalic from '@fontsource-variable/open-sans/files/open-sans-latin-wght-italic.woff2?url';
import openSansNormal from '@fontsource-variable/open-sans/files/open-sans-latin-wght-normal.woff2?url';
import oswaldNormal from '@fontsource-variable/oswald/files/oswald-latin-wght-normal.woff2?url';
import outfitNormal from '@fontsource-variable/outfit/files/outfit-latin-wght-normal.woff2?url';
import playfairItalic from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-italic.woff2?url';
import playfairNormal from '@fontsource-variable/playfair-display/files/playfair-display-latin-wght-normal.woff2?url';
import robotoItalic from '@fontsource-variable/roboto/files/roboto-latin-wght-italic.woff2?url';
import robotoNormal from '@fontsource-variable/roboto/files/roboto-latin-wght-normal.woff2?url';
import rubikItalic from '@fontsource-variable/rubik/files/rubik-latin-wght-italic.woff2?url';
import rubikNormal from '@fontsource-variable/rubik/files/rubik-latin-wght-normal.woff2?url';
import soraNormal from '@fontsource-variable/sora/files/sora-latin-wght-normal.woff2?url';
import spaceGroteskNormal from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2?url';
import workSansItalic from '@fontsource-variable/work-sans/files/work-sans-latin-wght-italic.woff2?url';
import workSansNormal from '@fontsource-variable/work-sans/files/work-sans-latin-wght-normal.woff2?url';
import antonNormal from '@fontsource/anton/files/anton-latin-400-normal.woff2?url';
import bebasNeueNormal from '@fontsource/bebas-neue/files/bebas-neue-latin-400-normal.woff2?url';
import dancingScript400 from '@fontsource/dancing-script/files/dancing-script-latin-400-normal.woff2?url';
import dancingScript500 from '@fontsource/dancing-script/files/dancing-script-latin-500-normal.woff2?url';
import dancingScript600 from '@fontsource/dancing-script/files/dancing-script-latin-600-normal.woff2?url';
import dancingScript700 from '@fontsource/dancing-script/files/dancing-script-latin-700-normal.woff2?url';
import dmSerifItalic from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2?url';
import dmSerifNormal from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import instrumentSerifItalic from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import instrumentSerifNormal from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import lato400Italic from '@fontsource/lato/files/lato-latin-400-italic.woff2?url';
import lato400Normal from '@fontsource/lato/files/lato-latin-400-normal.woff2?url';
import lato700Italic from '@fontsource/lato/files/lato-latin-700-italic.woff2?url';
import lato700Normal from '@fontsource/lato/files/lato-latin-700-normal.woff2?url';
import lato900Normal from '@fontsource/lato/files/lato-latin-900-normal.woff2?url';
import libreBaskerville400Italic from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-italic.woff2?url';
import libreBaskerville400Normal from '@fontsource/libre-baskerville/files/libre-baskerville-latin-400-normal.woff2?url';
import libreBaskerville700Italic from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-italic.woff2?url';
import libreBaskerville700Normal from '@fontsource/libre-baskerville/files/libre-baskerville-latin-700-normal.woff2?url';
import pacificoNormal from '@fontsource/pacifico/files/pacifico-latin-400-normal.woff2?url';
import poppins400Italic from '@fontsource/poppins/files/poppins-latin-400-italic.woff2?url';
import poppins400Normal from '@fontsource/poppins/files/poppins-latin-400-normal.woff2?url';
import poppins500Normal from '@fontsource/poppins/files/poppins-latin-500-normal.woff2?url';
import poppins600Normal from '@fontsource/poppins/files/poppins-latin-600-normal.woff2?url';
import poppins700Normal from '@fontsource/poppins/files/poppins-latin-700-normal.woff2?url';
import poppins800Normal from '@fontsource/poppins/files/poppins-latin-800-normal.woff2?url';

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
    family: 'Montserrat',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: montserratNormal,
    italic: montserratItalic,
  }),
  variableFont({
    family: 'Roboto',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: robotoNormal,
    italic: robotoItalic,
  }),
  variableFont({
    family: 'Open Sans',
    category: 'Sans serif',
    min: 300,
    max: 800,
    normal: openSansNormal,
    italic: openSansItalic,
  }),
  variableFont({
    family: 'Work Sans',
    category: 'Sans serif',
    min: 100,
    max: 900,
    normal: workSansNormal,
    italic: workSansItalic,
  }),
  variableFont({
    family: 'Nunito',
    category: 'Sans serif',
    min: 200,
    max: 1000,
    normal: nunitoNormal,
    italic: nunitoItalic,
  }),
  variableFont({
    family: 'Rubik',
    category: 'Sans serif',
    min: 300,
    max: 900,
    normal: rubikNormal,
    italic: rubikItalic,
  }),
  variableFont({
    family: 'Karla',
    category: 'Sans serif',
    min: 200,
    max: 800,
    normal: karlaNormal,
    italic: karlaItalic,
  }),
  variableFont({
    family: 'Figtree',
    category: 'Sans serif',
    min: 300,
    max: 900,
    normal: figtreeNormal,
    italic: figtreeItalic,
  }),
  staticFont('Poppins', 'Sans serif', [
    { weight: 400, normal: poppins400Normal, italic: poppins400Italic },
    { weight: 500, normal: poppins500Normal },
    { weight: 600, normal: poppins600Normal },
    { weight: 700, normal: poppins700Normal },
    { weight: 800, normal: poppins800Normal },
  ]),
  staticFont('Lato', 'Sans serif', [
    { weight: 400, normal: lato400Normal, italic: lato400Italic },
    { weight: 700, normal: lato700Normal, italic: lato700Italic },
    { weight: 900, normal: lato900Normal },
  ]),
  staticFont('Bebas Neue', 'Sans serif', [{ weight: 400, normal: bebasNeueNormal }]),
  staticFont('Anton', 'Sans serif', [{ weight: 400, normal: antonNormal }]),
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
    family: 'Merriweather',
    category: 'Serif',
    min: 300,
    max: 900,
    normal: merriweatherNormal,
    italic: merriweatherItalic,
  }),
  variableFont({
    family: 'Lora',
    category: 'Serif',
    min: 400,
    max: 700,
    normal: loraNormal,
    italic: loraItalic,
  }),
  variableFont({
    family: 'EB Garamond',
    category: 'Serif',
    min: 400,
    max: 800,
    normal: ebGaramondNormal,
    italic: ebGaramondItalic,
  }),
  variableFont({
    family: 'Cormorant Garamond',
    category: 'Serif',
    min: 300,
    max: 700,
    normal: cormorantNormal,
    italic: cormorantItalic,
  }),
  variableFont({
    family: 'Caveat',
    category: 'Handwriting',
    min: 400,
    max: 700,
    normal: caveatNormal,
  }),
  staticFont('Pacifico', 'Handwriting', [{ weight: 400, normal: pacificoNormal }]),
  staticFont('Dancing Script', 'Handwriting', [
    { weight: 400, normal: dancingScript400 },
    { weight: 500, normal: dancingScript500 },
    { weight: 600, normal: dancingScript600 },
    { weight: 700, normal: dancingScript700 },
  ]),
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
