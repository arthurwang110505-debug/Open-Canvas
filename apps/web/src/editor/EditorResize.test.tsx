import {
  createBlankDocument,
  createRectElement,
  createTextElement,
  ok,
  type DesignDocument,
} from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import { openPagePropertiesPanel } from './testHelpers';
import type { ResizedCopyRequest } from './EditorContext';
import type { ExportServices } from './export/ExportServices';

const fixedDate = new Date('2026-05-06T07:08:09.000Z');
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

interface Harness {
  user: ReturnType<typeof userEvent.setup>;
  downloads: { blob: Blob; filename: string }[];
}

function renderEditor(
  document: DesignDocument,
  options: { onCreateResizedCopy?: (copy: ResizedCopyRequest) => Promise<boolean> } = {},
): Harness {
  const downloads: { blob: Blob; filename: string }[] = [];
  const services: Partial<ExportServices> = {
    rasterize: vi.fn(() => Promise.resolve(ok(ONE_PIXEL_PNG))),
    download: (blob, filename) => downloads.push({ blob, filename }),
    resolveFontFaces: vi.fn(() => Promise.resolve([])),
  };
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage
        document={document}
        exportServices={services}
        onCreateResizedCopy={options.onCreateResizedCopy}
      />
    </TooltipProvider>,
  );
  return { user, downloads };
}

async function exportSvg(user: Harness['user'], downloads: Harness['downloads']): Promise<string> {
  await user.click(screen.getByRole('button', { name: 'Download' }));
  const dialog = await screen.findByRole('dialog', { name: 'Download design' });
  await user.click(within(dialog).getByRole('radio', { name: /SVG/ }));
  await user.click(within(dialog).getByRole('button', { name: 'Download SVG' }));
  const blob = downloads.at(-1)?.blob;
  return blob ? blob.text() : '';
}

function posterDocument(): DesignDocument {
  const document = createBlankDocument({ id: 'doc_resize', name: 'Poster', now: fixedDate });
  document.pages[0]?.elements.push(
    createRectElement({ id: 'band', x: 0, y: 0, width: 1080, height: 540 }),
    createTextElement({ id: 'title', text: 'Sale', x: 100, y: 100, fontSize: 64 }),
  );
  return document;
}

describe('resizing a design with preview', () => {
  it('fits content to the new size as a single undoable step', async () => {
    const { user, downloads } = renderEditor(posterDocument());

    openPagePropertiesPanel();
    await user.click(screen.getByRole('button', { name: 'Resize design with preview…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Resize design' });
    await user.click(within(dialog).getByRole('button', { name: /Instagram story/ }));
    expect(within(dialog).getByText('1 page · 1080 × 1920px · content fitted')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Resize this design' }));
    expect(screen.queryByRole('dialog', { name: 'Resize design' })).not.toBeInTheDocument();
    expect(await screen.findByText('Design resized')).toBeInTheDocument();

    const resized = await exportSvg(user, downloads);
    expect(resized).toContain('viewBox="0 0 1080 1920"');
    // Fit mode keeps the 1080x540 band at scale 1 and centres it vertically (y = 690 - 270).
    expect(resized).toContain('<g transform="translate(0 420)">');

    // One undo restores both the canvas size and the original layout.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    const restored = await exportSvg(user, downloads);
    expect(restored).toContain('viewBox="0 0 1080 1080"');
    expect(restored).toContain('<g transform="translate(0 0)">');
  });

  it('stretches content to fill when stretch is chosen', async () => {
    const { user, downloads } = renderEditor(posterDocument());

    openPagePropertiesPanel();
    await user.click(screen.getByRole('button', { name: 'Resize design with preview…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Resize design' });
    await user.click(within(dialog).getByRole('button', { name: /Instagram story/ }));
    await user.click(within(dialog).getByRole('radio', { name: 'Stretch to fill' }));
    await user.click(within(dialog).getByRole('button', { name: 'Resize this design' }));

    const resized = await exportSvg(user, downloads);
    expect(resized).toContain('viewBox="0 0 1080 1920"');
    // The 540-tall band stretches by 16/9 to 960 tall, anchored at the top.
    expect(resized).toContain('<rect width="1080" height="960"');
  });

  it('offers a resized copy when the host provides one, without touching this design', async () => {
    const onCreateResizedCopy = vi.fn(() => Promise.resolve(true));
    const { user, downloads } = renderEditor(posterDocument(), { onCreateResizedCopy });

    openPagePropertiesPanel();
    await user.click(screen.getByRole('button', { name: 'Resize design with preview…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Resize design' });
    await user.click(within(dialog).getByRole('button', { name: /Instagram story/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create resized copy' }));

    expect(onCreateResizedCopy).toHaveBeenCalledTimes(1);
    const [copy] = onCreateResizedCopy.mock.calls[0] as unknown as [ResizedCopyRequest];
    expect(copy.name).toBe('Poster · Instagram story');
    expect(copy.size).toEqual({ width: 1080, height: 1920 });
    expect(copy.pages[0]?.elements[0]).toMatchObject({ y: 420, height: 540 });

    // The current design keeps its original size.
    const unchanged = await exportSvg(user, downloads);
    expect(unchanged).toContain('viewBox="0 0 1080 1080"');
  });
});
