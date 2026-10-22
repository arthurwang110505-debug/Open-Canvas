import type { TextTransform } from '@opencanvas/document';

/**
 * The text styles offered in the Text panel.
 *
 * Each row is a real style, not a label: the sample copy on the button is drawn with the same
 * weight, tracking and casing the inserted element gets, so the panel shows what the user will
 * see. Sizes assume a 1080px side and scale with the design.
 */
export type TextPreset = 'heading' | 'subheading' | 'body' | 'eyebrow' | 'quote';

export interface TextPresetSpec {
  /** Sample copy, and the text the inserted element starts with. */
  text: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800;
  /** Tracking in px at preset size. */
  letterSpacing: number;
  textTransform: TextTransform;
  fontStyle: 'normal' | 'italic';
  /** Width as a fraction of the canvas width. */
  widthRatio: number;
  /** Font size used to draw the panel row, independent of the design size. */
  previewSize: number;
}

export const TEXT_PRESETS: Record<TextPreset, TextPresetSpec> = {
  heading: {
    text: 'Add a heading',
    fontSize: 96,
    fontWeight: 800,
    letterSpacing: 0,
    textTransform: 'none',
    fontStyle: 'normal',
    widthRatio: 0.8,
    previewSize: 22,
  },
  subheading: {
    text: 'Add a subheading',
    fontSize: 56,
    fontWeight: 600,
    letterSpacing: 0,
    textTransform: 'none',
    fontStyle: 'normal',
    widthRatio: 0.7,
    previewSize: 17,
  },
  body: {
    text: 'Add a little bit of body text',
    fontSize: 32,
    fontWeight: 400,
    letterSpacing: 0,
    textTransform: 'none',
    fontStyle: 'normal',
    widthRatio: 0.6,
    previewSize: 14,
  },
  eyebrow: {
    text: 'Add a label',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: 4,
    textTransform: 'uppercase',
    fontStyle: 'normal',
    widthRatio: 0.4,
    previewSize: 12,
  },
  quote: {
    text: 'Say something worth reading.',
    fontSize: 48,
    fontWeight: 500,
    letterSpacing: 0,
    textTransform: 'none',
    fontStyle: 'italic',
    widthRatio: 0.7,
    previewSize: 16,
  },
};

/** Heading + body combinations: the font pairing decides hierarchy without a second font pick. */
export interface FontPairing {
  id: string;
  label: string;
  headingFamily: string;
  headingWeight: 600 | 700 | 800;
  bodyFamily: string;
}

export const FONT_PAIRINGS: readonly FontPairing[] = [
  {
    id: 'editorial',
    label: 'Editorial',
    headingFamily: 'Playfair Display',
    headingWeight: 700,
    bodyFamily: 'Inter',
  },
  {
    id: 'bold-poster',
    label: 'Bold poster',
    headingFamily: 'Outfit',
    headingWeight: 800,
    bodyFamily: 'DM Sans',
  },
  {
    id: 'soft-serif',
    label: 'Soft serif',
    headingFamily: 'Fraunces',
    headingWeight: 600,
    bodyFamily: 'Manrope',
  },
];
