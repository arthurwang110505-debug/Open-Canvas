import { BUNDLED_PHOTOS } from '../assets/photos/catalog';
import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import { parseElementDragPayload } from './elements/drag';

const fixedDate = new Date('2026-10-22T08:00:00.000Z');

/** Real PNG bytes so the importer’s format sniffing accepts the fetched file. */
const ONE_PIXEL_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function pngBytes(): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(ONE_PIXEL_PNG.split(',')[1] ?? ''), (c) => c.charCodeAt(0));
}

function renderEditor() {
  const document = createBlankDocument({ id: 'doc_photos', name: 'Photos', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage
        document={document}
        assetServices={{
          decode: () => Promise.resolve({ width: 200, height: 100 }),
          loadImage: () => Promise.resolve(new Image()),
        }}
      />
    </TooltipProvider>,
  );
  return { user };
}

async function openPhotos(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Elements');
  await user.click(screen.getByRole('button', { name: 'Photos' }));
  return {
    list: screen.getByRole('listbox', { name: 'Photos' }),
    search: screen.getByRole('searchbox', { name: 'Search elements' }),
  };
}

describe('bundled photo library', () => {
  it('lists every bundled photo as a lazily loaded tile', async () => {
    const { user } = renderEditor();
    const { list } = await openPhotos(user);
    expect(within(list).getAllByRole('option')).toHaveLength(BUNDLED_PHOTOS.length);
    const tile = within(list).getByRole('option', { name: 'Insert photo Alpine lake' });
    // Ten 1400px photos must not download until they are on screen.
    expect(tile.querySelector('img')).toHaveAttribute('loading', 'lazy');
  });

  it('searches photos by tag alongside the rest of the library', async () => {
    const { user } = renderEditor();
    const { list, search } = await openPhotos(user);
    await user.type(search, 'ocean');
    expect(within(list).getAllByRole('option')).toHaveLength(1);
    expect(within(list).getByRole('option', { name: 'Insert photo Ocean waves' })).toBeVisible();

    await user.clear(search);
    await user.type(search, 'zzzz');
    expect(screen.queryByRole('listbox', { name: 'Photos' })).not.toBeInTheDocument();
    expect(screen.getByText(/No elements match/)).toBeInTheDocument();
  });

  it('inserts the photo as an image element and undo takes it back', async () => {
    const { user } = renderEditor();
    const { list } = await openPhotos(user);
    await user.click(within(list).getByRole('option', { name: 'Insert photo Alpine lake' }));

    const panel = openPropertiesPanel();
    expect(within(panel).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
    expect(within(panel).getAllByText('Alpine lake').length).toBeGreaterThan(0);
    expect(within(panel).getByLabelText('Fit')).toHaveValue('cover');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('shows the licence on request', async () => {
    const { user } = renderEditor();
    await openPhotos(user);
    const toggle = screen.getByRole('button', { name: 'See licence' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('note')).toHaveTextContent(/CC0 1\.0/);
    expect(screen.getByRole('link', { name: /Read the CC0 1\.0 licence/ })).toBeInTheDocument();
  });

  it('accepts photo drags and rejects ids that are not slugs', () => {
    expect(
      parseElementDragPayload(JSON.stringify({ kind: 'photo', photoId: 'alpine-lake' })),
    ).toEqual({ kind: 'photo', photoId: 'alpine-lake' });
    for (const photoId of ['Alpine Lake', '', 'a'.repeat(65), '../etc/passwd']) {
      expect(parseElementDragPayload(JSON.stringify({ kind: 'photo', photoId }))).toBeNull();
    }
  });
});

describe('photos from a link', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('imports an image from a URL and remembers the link', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve({
        ok: true,
        blob: () => Promise.resolve(new Blob([pngBytes()], { type: 'image/png' })),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { user } = renderEditor();
      await openPhotos(user);

      await user.type(screen.getByLabelText('Image URL'), 'https://example.com/photo.png');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(fetchMock).toHaveBeenCalledWith('https://example.com/photo.png');
      const panel = openPropertiesPanel();
      expect(await within(panel).findByRole('heading', { name: 'Image' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
      expect(localStorage.getItem('opencanvas:photo-urls:v1')).toContain(
        'https://example.com/photo.png',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports a link that cannot be fetched', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('network down')));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const { user } = renderEditor();
      await openPhotos(user);

      await user.type(screen.getByLabelText('Image URL'), 'https://example.com/missing.png');
      await user.click(screen.getByRole('button', { name: 'Add' }));

      expect(await screen.findByText('Could not fetch that image')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
