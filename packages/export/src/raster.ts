import { err, LIMITS, ok, type Result } from '@opencanvas/document';

import { describeCause, type ExportError } from './types';

export interface RasterSize {
  width: number;
  height: number;
}

/** The browser steps are injected so rasterization can be tested without a DOM. */
export interface RasterDependencies {
  loadImage(href: string): Promise<HTMLImageElement>;
  createCanvas(width: number, height: number): HTMLCanvasElement;
}

export const MAX_RASTER_DIMENSION = LIMITS.maxCanvasDimension;

/** PNG data URL for a rendered SVG (what the canvas and the PDF assembler consume). */
export type SvgRasterizer = (
  svg: string,
  size: RasterSize,
  scale?: number,
) => Promise<Result<string, ExportError>>;

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const browserRasterDependencies: RasterDependencies = {
  loadImage(href) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('The rendered SVG could not be decoded.'));
      image.src = href;
    });
  },
  createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  },
};

/**
 * Rasterizes an SVG string by drawing it into a canvas. Browsers refuse to draw SVG without
 * intrinsic size, which is why the renderer always emits width/height plus a viewBox.
 */
export function createSvgRasterizer(dependencies: Partial<RasterDependencies> = {}): SvgRasterizer {
  const deps: RasterDependencies = { ...browserRasterDependencies, ...dependencies };

  return async (svg, size, scale = 1) => {
    const factor = Number.isFinite(scale) && scale > 0 ? scale : 1;
    const width = Math.max(1, Math.round(size.width * factor));
    const height = Math.max(1, Math.round(size.height * factor));
    if (width > MAX_RASTER_DIMENSION || height > MAX_RASTER_DIMENSION) {
      return err({
        code: 'raster-too-large',
        message: `A ${width}×${height} export exceeds the ${MAX_RASTER_DIMENSION} pixel canvas limit. Lower the export scale.`,
      });
    }
    try {
      const image = await deps.loadImage(svgDataUrl(svg));
      const canvas = deps.createCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) {
        return err({
          code: 'raster-failed',
          message: 'This browser refused to create a 2D drawing context for the export.',
        });
      }
      context.drawImage(image, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl.startsWith('data:image/png')) {
        return err({
          code: 'raster-failed',
          message: 'The canvas returned no PNG data (the page may be too large for this device).',
        });
      }
      return ok(dataUrl);
    } catch (cause) {
      return err({
        code: 'raster-failed',
        message: `The page could not be rasterized: ${describeCause(cause)}`,
        cause,
      });
    }
  };
}
