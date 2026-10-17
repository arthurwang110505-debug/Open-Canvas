import { createSvgRasterizer, type TextMeasurer } from '@opencanvas/export';

import { downloadBlob } from '../../download';
import type { ExportServices } from './ExportServices';

/**
 * Measures text with a 2D canvas so exported line breaks match the canvas rendering. Returns
 * `undefined` when the browser gives no context (jsdom, unusual privacy modes): exports then
 * keep hard line breaks only instead of guessing at metrics.
 */
export function createCanvasTextMeasurer(): TextMeasurer | undefined {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return undefined;

  return (text, style) => {
    context.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`;
    const measured = context.measureText(text).width;
    // Canvas `measureText` ignores letter-spacing in several engines, so add it explicitly.
    return measured + style.letterSpacing * Math.max(0, [...text].length - 1);
  };
}

export function createBrowserExportServices(): ExportServices {
  const measureText = createCanvasTextMeasurer();
  return {
    rasterize: createSvgRasterizer(),
    ...(measureText ? { measureText } : {}),
    download: downloadBlob,
  };
}
