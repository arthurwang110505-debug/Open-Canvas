import { err, ok, type DesignDocument, type Result } from '@opencanvas/document';
import { jsPDF } from 'jspdf';

import { renderPageToSvg, type SvgPageOptions } from './svg';
import { describeCause, type ExportError } from './types';
import type { SvgRasterizer } from './raster';

export interface PdfOptions {
  /** Renders each page's SVG to a PNG data URL (browser implementation: `createSvgRasterizer`). */
  rasterize: SvgRasterizer;
  /** Raster resolution multiplier; 2 keeps text crisp at typical zoom. Default 2. */
  scale?: number;
  /** Defaults to every page, in document order. */
  pageIds?: readonly string[];
  /** Passed through to the SVG renderer (image resolution, text measuring, background). */
  svgOptions?: Omit<SvgPageOptions, 'pageId' | 'scale'>;
}

/**
 * Assembles a PDF from the document model: each page is rendered to SVG, rasterized, and placed
 * on a PDF page with the document's pixel size (jsPDF `px` unit = 1/96 inch). The result is a
 * raster PDF: text is drawn from the page's embedded fonts (see `SvgPageOptions.fontFaces`), so
 * it keeps the document's typefaces without shipping a second font pipeline.
 */
export async function renderDocumentToPdf(
  document: DesignDocument,
  options: PdfOptions,
): Promise<Result<Uint8Array<ArrayBuffer>, ExportError>> {
  const pageIds = options.pageIds ?? document.pages.map((page) => page.id);
  if (pageIds.length === 0) {
    return err({ code: 'page-not-found', message: 'The document has no pages to export.' });
  }

  const { width, height } = document.size;
  const orientation = width >= height ? 'landscape' : 'portrait';
  let pdf: jsPDF | null = null;

  try {
    for (const [index, pageId] of pageIds.entries()) {
      const svg = await renderPageToSvg(document, { ...options.svgOptions, pageId });
      if (!svg.ok) return svg;
      const raster = await options.rasterize(svg.value, { width, height }, options.scale ?? 2);
      if (!raster.ok) return raster;

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
          compress: true,
        });
      } else {
        pdf.addPage([width, height], orientation);
      }
      pdf.addImage(raster.value, 'PNG', 0, 0, width, height, `page-${String(index)}`, 'FAST');
    }
  } catch (cause) {
    return err({
      code: 'pdf-failed',
      message: `The PDF could not be assembled: ${describeCause(cause)}`,
      cause,
    });
  }

  if (!pdf) {
    return err({ code: 'pdf-failed', message: 'No page was rendered.' });
  }
  return ok(new Uint8Array(pdf.output('arraybuffer')));
}
