export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

/** Preset stops used by the zoom in/out controls (fractions, 1 = 100%). */
export const ZOOM_STOPS: readonly number[] = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4, 8];

const EPSILON = 1e-6;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function nextZoomIn(zoom: number): number {
  return ZOOM_STOPS.find((stop) => stop > zoom + EPSILON) ?? MAX_ZOOM;
}

export function nextZoomOut(zoom: number): number {
  for (let i = ZOOM_STOPS.length - 1; i >= 0; i -= 1) {
    const stop = ZOOM_STOPS[i];
    if (stop !== undefined && stop < zoom - EPSILON) return stop;
  }
  return MIN_ZOOM;
}

export interface Size {
  width: number;
  height: number;
}

/** Zoom level at which `page` fits inside `viewport` with `padding` pixels on every side. */
export function fitZoom(viewport: Size, page: Size, padding = 48): number {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  return clampZoom(Math.min(availableWidth / page.width, availableHeight / page.height));
}

export function formatZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}
