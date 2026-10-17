import { createBlankDocument, createPage, createRectElement, err, ok } from '@opencanvas/document';
import { describe, expect, it, vi } from 'vitest';

import { renderDocumentToPdf } from './pdf';
import type { ExportError } from './types';

/** A real 1×1 transparent PNG so jsPDF's image parser has something valid to embed. */
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function twoPageDocument() {
  const document = createBlankDocument({ id: 'doc_pdf', name: 'Deck', width: 400, height: 200 });
  document.pages = [
    document.pages[0] ?? createPage({ id: 'page_1' }),
    createPage({ id: 'page_2' }),
  ];
  document.pages[0]?.elements.push(createRectElement({ id: 'r1' }));
  return document;
}

describe('renderDocumentToPdf', () => {
  it('assembles one PDF page per document page', async () => {
    const rasterize = vi.fn().mockResolvedValue(ok(ONE_PIXEL_PNG));
    const result = await renderDocumentToPdf(twoPageDocument(), { rasterize, scale: 1 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const bytes = result.value;
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
    expect(bytes.length).toBeGreaterThan(500);
    expect(rasterize).toHaveBeenCalledTimes(2);
    // jsPDF page objects are numbered "/Type /Page" entries; count them in the raw bytes.
    const raw = new TextDecoder('latin1').decode(bytes);
    expect(raw.match(/\/Type \/Page[^s]/g)).toHaveLength(2);
  });

  it('renders each page from the document model at the requested resolution', async () => {
    const svgByPage: string[] = [];
    const rasterize = vi.fn(
      (svg: string, size: { width: number; height: number }, scale?: number) => {
        svgByPage.push(svg);
        expect(size).toEqual({ width: 400, height: 200 });
        expect(scale).toBe(3);
        return Promise.resolve(ok(ONE_PIXEL_PNG));
      },
    );

    const result = await renderDocumentToPdf(twoPageDocument(), { rasterize, scale: 3 });
    expect(result.ok).toBe(true);
    expect(svgByPage).toHaveLength(2);
    expect(svgByPage[0]).toContain('viewBox="0 0 400 200"');
    expect(svgByPage[0]).toContain('<rect width="400" height="200"');
  });

  it('forwards a rendering failure', async () => {
    const failure: ExportError = { code: 'image-failed', message: 'no bytes' };
    const document = twoPageDocument();
    const result = await renderDocumentToPdf(document, {
      rasterize: vi.fn().mockResolvedValue(err(failure)),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toEqual(failure);
  });

  it('reports a document without pages', async () => {
    const document = twoPageDocument();
    document.pages = [];
    const result = await renderDocumentToPdf(document, { rasterize: vi.fn() });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('page-not-found');
  });

  it('reports an unexpected rasterizer crash instead of throwing', async () => {
    const result = await renderDocumentToPdf(twoPageDocument(), {
      rasterize: vi.fn().mockRejectedValue(new Error('canvas exploded')),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('pdf-failed');
    expect(result.error.message).toContain('canvas exploded');
  });
});
