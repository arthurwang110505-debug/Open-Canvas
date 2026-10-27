import type { DesignDocument, DesignElement, Fill } from '@opencanvas/document';

export type TemplateOrientation = 'portrait' | 'square' | 'landscape';
export type TemplateColorMood = 'warm' | 'cool' | 'neutral' | 'vibrant';

export function templateOrientation(document: DesignDocument): TemplateOrientation {
  const ratio = document.size.width / document.size.height;
  if (ratio < 0.92) return 'portrait';
  if (ratio > 1.08) return 'landscape';
  return 'square';
}

function fillColors(fill: Fill): string[] {
  if (fill.type === 'solid') return [fill.color];
  if (fill.type === 'none') return [];
  return fill.stops.map((stop) => stop.color);
}

function colorsInElement(element: DesignElement): string[] {
  if (element.type === 'group') return element.children.flatMap(colorsInElement);
  if (element.type === 'text' || element.type === 'icon') return [element.color];
  if (element.type === 'image') return [];
  if (element.type === 'path') return [...fillColors(element.fill), element.stroke.color];
  if (element.type === 'frame') return fillColors(element.fill);
  return [...fillColors(element.fill), ...(element.stroke ? [element.stroke.color] : [])];
}

export function templatePalette(document: DesignDocument): string[] {
  const colors = new Set<string>();
  const add = (color: string) => {
    const short = color.slice(0, 7).toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(short)) colors.add(short);
  };
  for (const page of document.pages) {
    const background = page.background;
    if (background?.type === 'solid') add(background.color);
    else if (background && background.type !== 'none')
      background.stops.forEach((stop) => add(stop.color));
    for (const element of page.elements) colorsInElement(element).forEach(add);
  }
  return [...colors].slice(0, 6);
}

function hsl(hex: string): { hue: number; saturation: number; lightness: number } | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const red = Number.parseInt(value.slice(0, 2), 16) / 255;
  const green = Number.parseInt(value.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = ((green - blue) / delta) % 6;
    else if (max === green) hue = (blue - red) / delta + 2;
    else hue = (red - green) / delta + 4;
    hue = (hue * 60 + 360) % 360;
  }
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return { hue, saturation, lightness };
}

/** Adds accessible mood filters using the actual colors in each generated preview. */
export function templateColorMoods(document: DesignDocument): TemplateColorMood[] {
  const colors = templatePalette(document)
    .map(hsl)
    .filter((color): color is NonNullable<typeof color> => color !== null);
  const chromatic = colors.filter((color) => color.saturation >= 0.18);
  if (chromatic.length === 0) return ['neutral'];

  const moods = new Set<TemplateColorMood>();
  if (chromatic.some((color) => color.hue < 72 || color.hue >= 338)) moods.add('warm');
  if (chromatic.some((color) => color.hue >= 150 && color.hue < 285)) moods.add('cool');
  if (chromatic.some((color) => color.saturation >= 0.58)) moods.add('vibrant');
  if (moods.size === 0) moods.add('neutral');
  return [...moods];
}
