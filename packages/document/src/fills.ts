import type { GradientStop, LinearGradientFill, RadialGradientFill, SolidFill } from './schema';

/** Evenly spaced stops for `colors`; two or more colours make a gradient. */
export function gradientStops(colors: readonly string[]): GradientStop[] {
  if (colors.length < 2) throw new Error('A gradient needs at least two colours.');
  const last = colors.length - 1;
  return colors.map((color, index) => ({
    offset: Math.round((index / last) * 1000) / 1000,
    color,
  }));
}

/** A linear gradient over `colors`, with a CSS-style angle (0 = up, 90 = right, 180 = down). */
export function linearFill(angle: number, colors: readonly string[]): LinearGradientFill {
  return { type: 'linear', angle, stops: gradientStops(colors) };
}

/** A radial gradient centred on the shape, from the first colour outwards. */
export function radialFill(colors: readonly string[]): RadialGradientFill {
  return { type: 'radial', stops: gradientStops(colors) };
}

export function solidFill(color: string): SolidFill {
  return { type: 'solid', color };
}
