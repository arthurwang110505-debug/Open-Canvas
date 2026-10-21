import {
  createBlankDocument,
  createImageAsset,
  createImageElement,
  createRectElement,
  createTextElement,
  err,
  ok,
  type DesignDocument,
} from '@opencanvas/document';
import type { EmbeddedFontFace, ExportError } from '@opencanvas/export';
import { MemoryAssetBlobStore } from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import type { ExportServices } from './export/ExportServices';

const fixedDate = new Date('2026-05-06T07:08:09.000Z');

/** A real 1×1 transparent PNG so the PDF assembler receives something it can parse. */
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Opens the Download menu and picks a format, like a user would. */
async function exportFormat(
  user: ReturnType<typeof userEvent.setup>,
  format: 'PNG' | 'SVG' | 'PDF',
) {
  await user.click(screen.getByRole('button', { name: 'Download' }));
  await user.click(screen.getByRole('menuitem', { name: `Export ${format}` }));
}

/** One fake face is enough: the embedder has its own tests, exports only pass it through. */
const EMBEDDED_INTER: EmbeddedFontFace = {
  family: 'Inter',
  weight: '100 900',
  style: 'normal',
  data: 'QUFB',
};

interface Harness {
  user: ReturnType<typeof userEvent.setup>;
  downloads: { blob: Blob; filename: string }[];
  rasterize: ReturnType<typeof vi.fn>;
  resolveFontFaces: ReturnType<typeof vi.fn>;
}

function renderEditor(
  document: DesignDocument,
  options: {
    rasterizeResult?: 'ok' | 'failed';
    blobStore?: MemoryAssetBlobStore;
    fontFailure?: boolean;
  } = {},
): Harness {
  const downloads: { blob: Blob; filename: string }[] = [];
  const failure: ExportError = { code: 'raster-failed', message: 'No 2D context in this browser.' };
  const rasterize = vi.fn(() =>
    Promise.resolve(options.rasterizeResult === 'failed' ? err(failure) : ok(ONE_PIXEL_PNG)),
  );
  const resolveFontFaces = vi.fn(() =>
    options.fontFailure
      ? Promise.reject(new Error('The font "Inter" could not be embedded: HTTP 404'))
      : Promise.resolve([EMBEDDED_INTER]),
  );
  const services: Partial<ExportServices> = {
    rasterize,
    download: (blob, filename) => downloads.push({ blob, filename }),
    resolveFontFaces,
  };
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage
        document={document}
        exportServices={services}
        assetServices={options.blobStore ? { blobStore: options.blobStore } : undefined}
      />
    </TooltipProvider>,
  );
  return { user, downloads, rasterize, resolveFontFaces };
}

function designWithRectangle(): DesignDocument {
  const document = createBlankDocument({ id: 'doc_export', name: 'Poster', now: fixedDate });
  document.pages[0]?.elements.push(
    createRectElement({ id: 'r1', x: 40, y: 50, width: 200, height: 100 }),
  );
  return document;
}

describe('exporting a design', () => {
  it('downloads an SVG rendered from the document model', async () => {
    const { user, downloads } = renderEditor(designWithRectangle());

    await exportFormat(user, 'SVG');

    const [download] = downloads;
    expect(download?.filename).toBe('Poster.svg');
    expect(download?.blob.type).toBe('image/svg+xml;charset=utf-8');
    const svg = await download?.blob.text();
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain('<g transform="translate(40 50)">');
    expect(svg).toContain('<rect width="200" height="100"');
    expect(await screen.findByText('Poster.svg was downloaded.')).toBeInTheDocument();
  });

  it('rasterizes at 2× for PNG and hands over an image blob', async () => {
    const { user, downloads, rasterize } = renderEditor(designWithRectangle());

    await exportFormat(user, 'PNG');

    expect(rasterize).toHaveBeenCalledTimes(1);
    const [svg, size, scale] = rasterize.mock.calls[0] as [
      string,
      { width: number; height: number },
      number,
    ];
    expect(svg).toContain('<svg');
    expect(size).toEqual({ width: 1080, height: 1080 });
    expect(scale).toBe(2);

    const [download] = downloads;
    expect(download?.filename).toBe('Poster.png');
    expect(download?.blob.type).toBe('image/png');
    expect(download?.blob.size).toBeGreaterThan(0);
  });

  it('assembles a PDF from the document pages', async () => {
    const { user, downloads, rasterize } = renderEditor(designWithRectangle());

    await exportFormat(user, 'PDF');

    const [download] = downloads;
    if (!download) throw new Error('expected a download');
    expect(download.filename).toBe('Poster.pdf');
    expect(download.blob.type).toBe('application/pdf');
    const bytes = new Uint8Array(await download.blob.arrayBuffer());
    expect(String.fromCharCode(...bytes.subarray(0, 5))).toBe('%PDF-');
    expect(rasterize).toHaveBeenCalledTimes(1);
  });

  it('reports a rasterizer failure instead of downloading a broken file', async () => {
    const { user, downloads } = renderEditor(designWithRectangle(), { rasterizeResult: 'failed' });

    await exportFormat(user, 'PNG');

    expect(await screen.findByText('No 2D context in this browser.')).toBeInTheDocument();
    expect(screen.getByText('Export failed')).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('embeds the fonts the page uses so the file keeps its typeface', async () => {
    const document = createBlankDocument({ id: 'doc_font', name: 'Menu', now: fixedDate });
    document.pages[0]?.elements.push(
      createTextElement({ id: 't1', x: 20, y: 20, text: 'Dinner', fontFamily: 'Playfair Display' }),
    );
    const { user, downloads, resolveFontFaces } = renderEditor(document);

    await exportFormat(user, 'SVG');

    expect(resolveFontFaces).toHaveBeenCalledWith([
      { family: 'Playfair Display', weight: 400, style: 'normal' },
    ]);
    const svg = await downloads[0]?.blob.text();
    expect(svg).toContain('<defs>');
    expect(svg).toContain('@font-face { font-family: &quot;Inter&quot;');
    expect(svg).toContain('data:font/woff2;base64,QUFB');
  });

  it('reports a font that cannot be embedded instead of exporting a fallback', async () => {
    const { user, downloads } = renderEditor(designWithRectangle(), { fontFailure: true });

    await exportFormat(user, 'SVG');

    expect(
      await screen.findByText('The font "Inter" could not be embedded: HTTP 404'),
    ).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('embeds image assets from the blob store as data URLs', async () => {
    const document = createBlankDocument({ id: 'doc_image', name: 'Flyer', now: fixedDate });
    const asset = createImageAsset({
      id: 'asset_1',
      name: 'logo.png',
      mimeType: 'image/png',
      width: 4,
      height: 4,
      now: fixedDate,
    });
    document.assets[asset.id] = asset;
    document.pages[0]?.elements.push(
      createImageElement({ id: 'i1', assetId: asset.id, width: 100, height: 100 }),
    );
    const blobStore = new MemoryAssetBlobStore();
    await blobStore.put(asset.id, new Blob(['logo-bytes'], { type: 'image/png' }));

    const { user, downloads } = renderEditor(document, { blobStore });
    await exportFormat(user, 'SVG');

    const svg = await downloads[0]?.blob.text();
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
    expect(svg).toContain(`href="data:image/png;base64,${btoa('logo-bytes')}"`);
  });

  it('reports an image whose bytes are gone', async () => {
    const document = createBlankDocument({ id: 'doc_gone', name: 'Flyer', now: fixedDate });
    const asset = createImageAsset({
      id: 'asset_1',
      name: 'logo.png',
      mimeType: 'image/png',
      width: 4,
      height: 4,
      now: fixedDate,
    });
    document.assets[asset.id] = asset;
    document.pages[0]?.elements.push(createImageElement({ id: 'i1', assetId: asset.id }));

    const { user, downloads } = renderEditor(document, { blobStore: new MemoryAssetBlobStore() });
    await exportFormat(user, 'SVG');

    expect(
      await screen.findByText('The image "logo.png" could not be embedded: its image data', {
        exact: false,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Export failed')).toBeInTheDocument();
    expect(downloads).toEqual([]);
    expect(downloads).toEqual([]);
  });

  it('exports what is on the canvas, including elements added in this session', async () => {
    const document = createBlankDocument({ id: 'doc_live', name: 'Live', now: fixedDate });
    const { user, downloads } = renderEditor(document);

    await user.click(screen.getByRole('tab', { name: 'Shapes' }));
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    const properties = screen.getByRole('complementary', { name: 'Properties' });
    expect(within(properties).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();

    await exportFormat(user, 'SVG');
    const svg = await downloads[0]?.blob.text();
    expect(svg).toContain('<rect width="324" height="324"');
  });

  it('sanitizes the design name for the file system', async () => {
    const document = createBlankDocument({
      id: 'doc_name',
      name: 'Poster: spring/summer?',
      now: fixedDate,
    });
    const { user, downloads } = renderEditor(document);

    await exportFormat(user, 'SVG');
    expect(downloads[0]?.filename).toBe('Poster spring summer.svg');
  });
});
