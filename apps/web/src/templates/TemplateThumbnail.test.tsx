import {
  createBlankDocument,
  createTextElement,
  type DesignDocument,
  type Result,
} from '@opencanvas/document';
import type { ExportError, SvgPageOptions } from '@opencanvas/export';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { TemplateThumbnail } from './TemplateThumbnail';

const fonts = vi.hoisted(() => ({
  ensureFontsLoaded: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
const exporter = vi.hoisted(() => ({
  renderPageToSvg:
    vi.fn<
      (document: DesignDocument, options?: SvgPageOptions) => Promise<Result<string, ExportError>>
    >(),
}));
vi.mock('../fonts/embed', () => fonts);
vi.mock('@opencanvas/export', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  renderPageToSvg: exporter.renderPageToSvg,
}));

describe('TemplateThumbnail', () => {
  it('waits for document fonts and renders the shared exporter with browser measurement', async () => {
    const document = createBlankDocument({ id: 'thumbnail-fonts', name: 'Font preview' });
    document.pages[0]!.elements.push(
      createTextElement({ id: 'headline', text: 'A measured headline', fontFamily: 'Oswald' }),
    );
    exporter.renderPageToSvg.mockResolvedValue({
      ok: true,
      value: '<svg viewBox="0 0 1080 1080"><rect width="1080" height="1080" /></svg>',
    });
    const { container } = render(<TemplateThumbnail document={document} />);
    expect(screen.getByLabelText('Loading template preview')).toHaveStyle({ aspectRatio: '1' });
    await waitFor(() => expect(container.querySelector('svg')).not.toBeNull());
    expect(fonts.ensureFontsLoaded).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ family: 'Oswald' })]),
    );
    const options = exporter.renderPageToSvg.mock.calls.at(-1)?.[1];
    expect(options?.pageId).toBe(document.pages[0]!.id);
    expect(typeof options?.measureText).toBe('function');
    expect(container.querySelector('[aria-hidden="true"] svg')).not.toBeNull();
  });

  it('keeps a failed preview in its original aspect ratio without nesting a retry button in the card', async () => {
    const document = createBlankDocument({ id: 'thumbnail-error', name: 'Error preview' });
    document.size = { width: 1920, height: 1080 };
    exporter.renderPageToSvg.mockResolvedValue({
      ok: false,
      error: { code: 'raster-failed', message: 'Render failed' },
    });
    render(<TemplateThumbnail document={document} />);
    expect(await screen.findByText('Preview unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Preview unavailable').parentElement).toHaveStyle({
      aspectRatio: String(1920 / 1080),
    });
  });
});
