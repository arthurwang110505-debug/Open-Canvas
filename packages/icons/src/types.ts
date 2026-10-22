/**
 * Icon geometry. Lucide (and most icon sets) describe a 24×24 grid with primitive shapes rather
 * than path strings, so an icon is stored that way too: it survives scaling, stroking and
 * recolouring, and both renderers (Fabric and SVG/PDF) can consume it without a parser.
 */
export type IconShapeTag = 'path' | 'circle' | 'rect' | 'line' | 'ellipse' | 'polyline' | 'polygon';

/** Attribute name → value, exactly as the source set spells it (SVG attribute casing). */
export type IconShape = readonly [tag: IconShapeTag, attributes: Readonly<Record<string, string>>];

/** The grid every bundled icon is drawn on; scaling to a box is `width / ICON_VIEWBOX`. */
export const ICON_VIEWBOX = 24;
