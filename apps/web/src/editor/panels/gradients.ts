import type { GradientFill } from '@opencanvas/document';

/**
 * Curated gradients, named the way a designer would ask for them. Hand-picked rather than
 * generated: two colours and a believable angle beat three hundred algorithmic combinations,
 * and every entry has to look right behind the text a template will put on it.
 */
export interface GradientPreset {
  id: string;
  label: string;
  /** CSS-style angle: 0 = top, 90 = right, 180 = bottom. Radials ignore it. */
  angle: number;
  stops: readonly string[];
  type: 'linear' | 'radial';
}

export const GRADIENT_PRESETS: readonly GradientPreset[] = [
  { id: 'sunrise', label: 'Sunrise', type: 'linear', angle: 160, stops: ['#fde68a', '#fb7185'] },
  { id: 'peach', label: 'Peach', type: 'linear', angle: 140, stops: ['#ffedd5', '#fdba74'] },
  { id: 'coral', label: 'Coral', type: 'linear', angle: 200, stops: ['#fecdd3', '#f43f5e'] },
  { id: 'rose', label: 'Rose', type: 'linear', angle: 135, stops: ['#fdf2f8', '#e879a6'] },
  { id: 'lavender', label: 'Lavender', type: 'linear', angle: 180, stops: ['#f5f3ff', '#a78bfa'] },
  { id: 'violet', label: 'Violet', type: 'linear', angle: 145, stops: ['#ede9fe', '#7c3aed'] },
  { id: 'indigo', label: 'Indigo', type: 'linear', angle: 210, stops: ['#c7d2fe', '#4338ca'] },
  { id: 'ocean', label: 'Ocean', type: 'linear', angle: 165, stops: ['#e0f2fe', '#0284c7'] },
  { id: 'aqua', label: 'Aqua', type: 'linear', angle: 120, stops: ['#ecfeff', '#06b6d4'] },
  { id: 'mint', label: 'Mint', type: 'linear', angle: 150, stops: ['#f0fdf4', '#34d399'] },
  { id: 'forest', label: 'Forest', type: 'linear', angle: 195, stops: ['#dcfce7', '#15803d'] },
  { id: 'sand', label: 'Sand', type: 'linear', angle: 135, stops: ['#fefce8', '#d6b47a'] },
  { id: 'amber', label: 'Amber', type: 'linear', angle: 180, stops: ['#fffbeb', '#f59e0b'] },
  { id: 'ember', label: 'Ember', type: 'linear', angle: 200, stops: ['#fed7aa', '#b45309'] },
  { id: 'slate', label: 'Slate', type: 'linear', angle: 160, stops: ['#f8fafc', '#64748b'] },
  { id: 'graphite', label: 'Graphite', type: 'linear', angle: 180, stops: ['#e5e7eb', '#374151'] },
  { id: 'ink', label: 'Ink', type: 'linear', angle: 145, stops: ['#334155', '#0f172a'] },
  { id: 'midnight', label: 'Midnight', type: 'linear', angle: 165, stops: ['#1e293b', '#020617'] },
  { id: 'dusk', label: 'Dusk', type: 'linear', angle: 135, stops: ['#312e81', '#db2777'] },
  { id: 'aurora', label: 'Aurora', type: 'linear', angle: 120, stops: ['#22d3ee', '#a855f7'] },
  {
    id: 'lime-fizz',
    label: 'Lime fizz',
    type: 'linear',
    angle: 150,
    stops: ['#ecfccb', '#84cc16'],
  },
  { id: 'glow', label: 'Glow', type: 'radial', angle: 0, stops: ['#fef9c3', '#f59e0b'] },
  { id: 'halo', label: 'Halo', type: 'radial', angle: 0, stops: ['#ffffff', '#c7d2fe'] },
  { id: 'spotlight', label: 'Spotlight', type: 'radial', angle: 0, stops: ['#a5f3fc', '#0e7490'] },
];

/** The fill for a preset, with an optional override angle (radials ignore it). */
export function presetFill(preset: GradientPreset, angle = preset.angle): GradientFill {
  const last = preset.stops.length - 1;
  const stops = preset.stops.map((color, index) => ({
    offset: last === 0 ? 0 : Math.round((index / last) * 1000) / 1000,
    color,
  }));
  return preset.type === 'radial'
    ? { type: 'radial', stops }
    : { type: 'linear', angle: Math.min(360, Math.max(0, Math.round(angle))), stops };
}

/** A CSS background for swatches and previews — the same numbers the canvas and exports use. */
export function presetCss(preset: GradientPreset): string {
  const stops = preset.stops.join(', ');
  return preset.type === 'radial'
    ? `radial-gradient(circle, ${stops})`
    : `linear-gradient(${preset.angle}deg, ${stops})`;
}
