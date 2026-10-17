import {
  createBlankDocument,
  createRectElement,
  err,
  type DesignDocument,
} from '@opencanvas/document';
import {
  createMemoryProjectStore,
  projectStoreError,
  type ProjectStore,
} from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Dashboard } from './Dashboard';
import { formatTimestamp } from './format';
import type { ProjectsServices } from './ProjectsContext';
import { ProjectsProvider } from './ProjectsProvider';

const baseDate = new Date('2026-03-04T05:06:07.000Z');

function makeDocument(id: string, name: string, updatedAt: string): DesignDocument {
  const document = createBlankDocument({ id, name, now: baseDate });
  document.pages[0]?.elements.push(createRectElement({ id: `${id}_rect` }));
  document.metadata.updatedAt = updatedAt;
  return document;
}

function servicesFor(store: ProjectStore, downloads: Download[] = []): ProjectsServices {
  return {
    store,
    backend: 'memory',
    download: (blob, filename) => downloads.push({ blob, filename }),
  };
}

interface Download {
  blob: Blob;
  filename: string;
}

async function seededStore(documents: readonly DesignDocument[]): Promise<ProjectStore> {
  const store = createMemoryProjectStore();
  for (const document of documents) {
    const saved = await store.save(document);
    if (!saved.ok) throw new Error(saved.error.message);
  }
  return store;
}

function renderDashboard(services: ProjectsServices) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <ProjectsProvider services={services}>
        <Dashboard />
      </ProjectsProvider>
    </TooltipProvider>,
  );
  return { user };
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('Dashboard', () => {
  it('shows an empty state when nothing has been saved yet', async () => {
    renderDashboard(servicesFor(createMemoryProjectStore()));
    expect(await screen.findByText('No designs yet')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your designs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New design' })).toBeEnabled();
  });

  it('lists saved designs newest first with their contents and timestamp', async () => {
    const store = await seededStore([
      makeDocument('doc_old', 'Old flyer', '2026-01-01T09:00:00.000Z'),
      makeDocument('doc_new', 'Spring poster', '2026-03-01T09:00:00.000Z'),
    ]);
    renderDashboard(servicesFor(store));

    await screen.findByRole('list', { name: 'Saved designs' });
    const cards = within(screen.getByRole('list', { name: 'Saved designs' })).getAllByRole(
      'listitem',
    );
    expect(cards).toHaveLength(2);
    const first = cards[0];
    const second = cards[1];
    if (!first || !second) throw new Error('Expected two project cards.');
    expect(within(first).getByRole('heading', { name: 'Spring poster' })).toBeInTheDocument();
    expect(within(second).getByRole('heading', { name: 'Old flyer' })).toBeInTheDocument();
    expect(within(first).getByText(/1080 × 1080 px · 1 page · 1 element/)).toBeInTheDocument();
    expect(
      within(first).getByText(`Updated ${formatTimestamp('2026-03-01T09:00:00.000Z')}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This browser has no IndexedDB: designs are kept in memory only/),
    ).toBeInTheDocument();
  });

  it('creates a design with the selected canvas size and navigates to the editor', async () => {
    const store = createMemoryProjectStore();
    const { user } = renderDashboard(servicesFor(store));

    await user.selectOptions(screen.getByLabelText('Canvas size'), 'poster-a4');
    await user.click(screen.getByRole('button', { name: 'New design' }));

    await waitFor(() => expect(window.location.hash).toMatch(/^#\/design\/doc_/));
    const projectId = decodeURIComponent(window.location.hash.replace('#/design/', ''));
    const loaded = await store.load(projectId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.name).toBe('Untitled design');
    expect(loaded.value.size).toEqual({ width: 2480, height: 3508 });
  });

  it('renames a design and stores the new name', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Rename Poster' }));
    const field = screen.getByRole('textbox', { name: 'New name for Poster' });
    await user.clear(field);
    await user.type(field, 'Spring flyer{Enter}');

    await screen.findByRole('heading', { name: 'Spring flyer' });
    const loaded = await store.load('doc_a');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.name).toBe('Spring flyer');
  });

  it('rejects an empty name and keeps the field open', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Rename Poster' }));
    const field = screen.getByRole('textbox', { name: 'New name for Poster' });
    await user.clear(field);
    await user.type(field, '   {Enter}');

    expect(await screen.findByRole('alert')).toHaveTextContent('A design name cannot be empty.');
    expect(screen.getByRole('textbox', { name: 'New name for Poster' })).toBeInTheDocument();
    const loaded = await store.load('doc_a');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.name).toBe('Poster');
  });

  it('cancels a rename with Escape', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Rename Poster' }));
    const field = screen.getByRole('textbox', { name: 'New name for Poster' });
    await user.type(field, ' changed{Escape}');

    await waitFor(() =>
      expect(
        screen.queryByRole('textbox', { name: 'New name for Poster' }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('heading', { name: 'Poster' })).toBeInTheDocument();
  });

  it('duplicates a design', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Duplicate Poster' }));

    await screen.findByRole('heading', { name: 'Poster copy' });
    const list = await store.list();
    expect(list.ok).toBe(true);
    if (!list.ok) return;
    expect(list.value).toHaveLength(2);
  });

  it('deletes a design only after confirmation', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Delete Poster' }));
    expect(screen.getByRole('button', { name: 'Keep Poster' })).toBeInTheDocument();
    const beforeDelete = await store.list();
    expect(beforeDelete.ok).toBe(true);
    if (!beforeDelete.ok) return;
    expect(beforeDelete.value.map((summary) => summary.id)).toEqual(['doc_a']);

    await user.click(screen.getByRole('button', { name: 'Confirm delete Poster' }));
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Poster' })).not.toBeInTheDocument(),
    );
    expect(await store.list()).toEqual({ ok: true, value: [] });
    expect(screen.getByText('No designs yet')).toBeInTheDocument();
  });

  it('keeps the design when the delete confirmation is dismissed', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await screen.findByRole('button', { name: 'Delete Poster' }));
    await user.click(screen.getByRole('button', { name: 'Keep Poster' }));

    expect(screen.getByRole('heading', { name: 'Poster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Poster' })).toBeInTheDocument();
  });

  it('reports a failing project list with a retry action', async () => {
    const inner = createMemoryProjectStore();
    let fail = true;
    const store: ProjectStore = {
      list: async () =>
        fail ? err(projectStoreError('storage-unavailable', 'IndexedDB is locked.')) : inner.list(),
      load: (projectId) => inner.load(projectId),
      save: (document) => inner.save(document),
      duplicate: (projectId) => inner.duplicate(projectId),
      remove: (projectId) => inner.remove(projectId),
      assetBlobStore: (projectId) => inner.assetBlobStore(projectId),
    };
    await inner.save(makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z'));
    const { user } = renderDashboard(servicesFor(store));

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB is locked.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Poster' });
  });
});
