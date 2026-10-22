import { BUNDLED_PHOTOS } from '../assets/photos/catalog';
import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { parseElementDragPayload } from './elements/drag';

const fixedDate = new Date('2026-10-22T08:00:00.000Z');

function renderEditor() {
  const document = createBlankDocument({ id: 'doc_photos', name: 'Photos', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} />
    </TooltipProvider>,
  );
  return { user };
}

async function openPhotos(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Elements' }));
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

    const panel = screen.getByRole('complementary', { name: 'Properties' });
    expect(within(panel).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
    expect(within(panel).getAllByText('Alpine lake').length).toBeGreaterThan(0);
    expect(within(panel).getByLabelText('Fit')).toHaveValue('cover');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Nothing on the page yet/)).toBeInTheDocument();
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
