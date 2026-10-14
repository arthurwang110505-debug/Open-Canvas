/**
 * Bitmaps shown in place of an image while its asset loads or when loading failed. They
 * are tiny canvases stretched over the element box, so the user sees the element's
 * footprint immediately and the object can be selected, moved and resized meanwhile.
 */
export const PLACEHOLDER_SIZE = 64;

export type PlaceholderKind = 'loading' | 'error';

const COLORS: Record<PlaceholderKind, { fill: string; stroke: string }> = {
  loading: { fill: '#e5e7eb', stroke: '#9ca3af' },
  error: { fill: '#fee2e2', stroke: '#ef4444' },
};

export function createPlaceholderBitmap(kind: PlaceholderKind): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = PLACEHOLDER_SIZE;
  canvas.height = PLACEHOLDER_SIZE;
  const context = canvas.getContext('2d');
  if (context) {
    const { fill, stroke } = COLORS[kind];
    context.fillStyle = fill;
    context.fillRect(0, 0, PLACEHOLDER_SIZE, PLACEHOLDER_SIZE);
    context.strokeStyle = stroke;
    context.lineWidth = 2;
    context.strokeRect(1, 1, PLACEHOLDER_SIZE - 2, PLACEHOLDER_SIZE - 2);
    if (kind === 'error') {
      const inset = PLACEHOLDER_SIZE * 0.3;
      context.beginPath();
      context.moveTo(inset, inset);
      context.lineTo(PLACEHOLDER_SIZE - inset, PLACEHOLDER_SIZE - inset);
      context.moveTo(PLACEHOLDER_SIZE - inset, inset);
      context.lineTo(inset, PLACEHOLDER_SIZE - inset);
      context.stroke();
    } else {
      // Simple "picture" glyph: a frame with a mountain line.
      const inset = PLACEHOLDER_SIZE * 0.25;
      context.beginPath();
      context.moveTo(inset, PLACEHOLDER_SIZE - inset);
      context.lineTo(PLACEHOLDER_SIZE * 0.42, PLACEHOLDER_SIZE * 0.5);
      context.lineTo(PLACEHOLDER_SIZE * 0.55, PLACEHOLDER_SIZE * 0.64);
      context.lineTo(PLACEHOLDER_SIZE * 0.66, PLACEHOLDER_SIZE * 0.52);
      context.lineTo(PLACEHOLDER_SIZE - inset, PLACEHOLDER_SIZE - inset);
      context.stroke();
    }
  }
  return canvas;
}
