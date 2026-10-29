import {
  createBlankDocument,
  createRectElement,
  err,
  type DesignDocument,
} from '@opencanvas/document';
import {
  createMemoryProjectOrganizationStore,
  createMemoryProjectStore,
  projectStoreError,
  type ProjectOrganizationStore,
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
import { stubMatchMedia } from '../test/mockMatchMedia';

const baseDate = new Date('2026-03-04T05:06:07.000Z');
let restoreMatchMedia: (() => void) | undefined;
const CUSTOM_DESIGN_SIZES = [
  { unit: 'px', width: '850', height: '1100', expected: { width: 850, height: 1100 } },
  { unit: 'in', width: '8.5', height: '11', expected: { width: 2550, height: 3300 } },
  { unit: 'mm', width: '215.9', height: '279.4', expected: { width: 2550, height: 3300 } },
  { unit: 'cm', width: '21.59', height: '27.94', expected: { width: 2550, height: 3300 } },
] as const;

function makeDocument(id: string, name: string, updatedAt: string): DesignDocument {
  const document = createBlankDocument({ id, name, now: baseDate });
  document.pages[0]?.elements.push(createRectElement({ id: `${id}_rect` }));
  document.metadata.updatedAt = updatedAt;
  return document;
}

function servicesFor(
  store: ProjectStore,
  downloads: Download[] = [],
  organization: ProjectOrganizationStore = createMemoryProjectOrganizationStore(),
): ProjectsServices {
  return {
    store,
    organization,
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

async function openProjects(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Projects' }));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

describe('Dashboard', () => {
  it('shows an empty state when nothing has been saved yet', async () => {
    renderDashboard(servicesFor(createMemoryProjectStore()));
    expect(await screen.findByText('No designs yet')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'What will you design today?' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create a design' }).length).toBeGreaterThan(0);
  });

  it('opens mobile navigation as a drawer and closes it after choosing a view', async () => {
    restoreMatchMedia = stubMatchMedia((query) => query.includes('max-width'));
    const { user } = renderDashboard(servicesFor(createMemoryProjectStore()));
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Dashboard navigation' })).not.toBeInTheDocument();

    await user.click(trigger);
    const drawer = await screen.findByRole('dialog', { name: 'Dashboard navigation' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    await waitFor(() =>
      expect(within(drawer).getByRole('button', { name: 'Close navigation' })).toHaveFocus(),
    );

    await user.click(within(drawer).getByRole('button', { name: 'Projects' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Dashboard navigation' })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(document.body.style.overflow).toBe('');
  });

  it('dismisses mobile navigation with Escape and restores focus', async () => {
    restoreMatchMedia = stubMatchMedia((query) => query.includes('max-width'));
    const { user } = renderDashboard(servicesFor(createMemoryProjectStore()));
    const trigger = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(trigger);
    expect(await screen.findByRole('dialog', { name: 'Dashboard navigation' })).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Dashboard navigation' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('lists saved designs newest first with their contents and timestamp', async () => {
    const store = await seededStore([
      makeDocument('doc_old', 'Old flyer', '2026-01-01T09:00:00.000Z'),
      makeDocument('doc_new', 'Spring poster', '2026-03-01T09:00:00.000Z'),
    ]);
    const { user } = renderDashboard(servicesFor(store));
    await openProjects(user);

    const cards = await screen.findAllByRole('listitem');
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

    await user.click(screen.getAllByRole('button', { name: 'Create a design' })[0]!);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Starting format' }),
      'poster-a4',
    );
    await user.click(screen.getByRole('button', { name: 'Create design' }));

    await waitFor(() => expect(window.location.hash).toMatch(/^#\/design\/doc_/));
    const projectId = decodeURIComponent(window.location.hash.replace('#/design/', ''));
    const loaded = await store.load(projectId);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.value.name).toBe('Untitled design');
    expect(loaded.value.size).toEqual({ width: 2480, height: 3508 });
  });

  it.each(CUSTOM_DESIGN_SIZES)(
    'creates a custom design from $unit dimensions',
    async ({ unit, width: widthValue, height: heightValue, expected }) => {
      const store = createMemoryProjectStore();
      const { user } = renderDashboard(servicesFor(store));

      await user.click(screen.getAllByRole('button', { name: 'Create a design' })[0]!);
      await user.selectOptions(screen.getByRole('combobox', { name: 'Design units' }), unit);
      const width = screen.getByRole('spinbutton', { name: 'Canvas width' });
      const height = screen.getByRole('spinbutton', { name: 'Canvas height' });
      await user.clear(width);
      await user.type(width, widthValue);
      await user.clear(height);
      await user.type(height, heightValue);
      await user.click(screen.getByRole('button', { name: 'Create design' }));

      await waitFor(() => expect(window.location.hash).toMatch(/^#\/design\/doc_/));
      const projectId = decodeURIComponent(window.location.hash.replace('#/design/', ''));
      const loaded = await store.load(projectId);
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.value.size).toEqual(expected);
    },
  );

  it('continues a recent design from the home screen', async () => {
    const store = await seededStore([
      makeDocument('doc_new', 'Spring poster', '2026-03-03T09:00:00.000Z'),
      makeDocument('doc_mid', 'Summer flyer', '2026-03-02T09:00:00.000Z'),
      makeDocument('doc_old', 'Winter card', '2026-03-01T09:00:00.000Z'),
    ]);
    const { user } = renderDashboard(servicesFor(store));

    const recents = await screen.findByRole('region', { name: 'Continue editing' });
    expect(within(recents).getAllByRole('button')).toHaveLength(4);

    await user.click(within(recents).getByRole('button', { name: /Spring poster/ }));
    await waitFor(() => expect(window.location.hash).toBe('#/design/doc_new'));
  });

  it('searches from home and opens an already-filtered project list', async () => {
    const store = await seededStore([
      makeDocument('doc_spring', 'Spring poster', '2026-03-03T09:00:00.000Z'),
      makeDocument('doc_summer', 'Summer flyer', '2026-03-02T09:00:00.000Z'),
    ]);
    const { user } = renderDashboard(servicesFor(store));
    await screen.findByRole('region', { name: 'Continue editing' });

    await user.type(screen.getByRole('searchbox', { name: 'Search your designs' }), 'Spring');
    await user.click(screen.getByRole('button', { name: 'Search designs' }));

    const results = await screen.findByRole('list', { name: 'Designs' });
    expect(within(results).getByRole('heading', { name: 'Spring poster' })).toBeInTheDocument();
    expect(
      within(results).queryByRole('heading', { name: 'Summer flyer' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search your designs' })).toHaveValue('Spring');
    expect(screen.getByText('1 result for “Spring”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear design search' }));
    expect(screen.getByRole('searchbox', { name: 'Search your designs' })).toHaveFocus();
    expect(within(results).getByRole('heading', { name: 'Summer flyer' })).toBeInTheDocument();
  });

  it('offers a clear recovery action when a project search has no matches', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-03T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));
    await openProjects(user);
    const search = await screen.findByRole('searchbox', { name: 'Search your designs' });
    await user.type(search, 'missing');

    expect(await screen.findByRole('heading', { name: 'No matches' })).toBeInTheDocument();
    expect(screen.getByText(/No designs match “missing”/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));

    expect(search).toHaveValue('');
    expect(await screen.findByRole('heading', { name: 'Poster' })).toBeInTheDocument();
  });

  it('sorts the design list by name when asked', async () => {
    const store = await seededStore([
      makeDocument('doc_b', 'Blue poster', '2026-03-03T09:00:00.000Z'),
      makeDocument('doc_a', 'Amber flyer', '2026-03-01T09:00:00.000Z'),
    ]);
    const { user } = renderDashboard(servicesFor(store));
    await openProjects(user);

    const list = await screen.findByRole('list');
    const namesBefore = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(namesBefore[0]).toBe('Blue poster');

    await user.selectOptions(screen.getByLabelText('Sort designs'), 'name');

    const namesAfter = within(list)
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(namesAfter).toEqual(['Amber flyer', 'Blue poster']);
  });

  it('renames a design and stores the new name', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const { user } = renderDashboard(servicesFor(store));
    await openProjects(user);

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
    await openProjects(user);

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
    await openProjects(user);

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
    await openProjects(user);

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
    await openProjects(user);

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
    await openProjects(user);

    await user.click(await screen.findByRole('button', { name: 'Delete Poster' }));
    await user.click(screen.getByRole('button', { name: 'Keep Poster' }));

    expect(screen.getByRole('heading', { name: 'Poster' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Poster' })).toBeInTheDocument();
  });

  it('keeps starred designs in the Starred view and persists the local flag', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const organization = createMemoryProjectOrganizationStore();
    const { user } = renderDashboard(servicesFor(store, [], organization));
    await openProjects(user);

    const star = screen.getByRole('button', { name: 'Star Poster' });
    await user.click(star);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Remove Poster from starred' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Starred' }));
    expect(
      within(await screen.findByRole('list', { name: 'Designs' })).getByRole('heading', {
        name: 'Poster',
      }),
    ).toBeInTheDocument();
    expect(await organization.load()).toMatchObject({
      ok: true,
      value: { projects: [{ projectId: 'doc_a', starred: true, folderId: null }] },
    });

    await user.click(screen.getByRole('button', { name: 'Remove Poster from starred' }));
    expect(
      await screen.findByRole('heading', { name: 'No starred designs yet' }),
    ).toBeInTheDocument();
  });

  it('creates, assigns, renames, and deletes local project folders', async () => {
    const store = await seededStore([makeDocument('doc_a', 'Poster', '2026-03-01T09:00:00.000Z')]);
    const organization = createMemoryProjectOrganizationStore();
    const { user } = renderDashboard(servicesFor(store, [], organization));
    await openProjects(user);

    await user.click(screen.getByRole('button', { name: 'Create folder' }));
    await user.type(screen.getByRole('textbox', { name: 'Folder name' }), 'Campaigns');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Create a folder' })).getByRole('button', {
        name: 'Create folder',
      }),
    );
    const folderButton = await screen.findByRole('button', { name: 'Campaigns' });
    await user.click(screen.getByRole('button', { name: 'Projects' }));

    await user.click(screen.getByRole('button', { name: 'Organize Poster' }));
    await user.click(screen.getByRole('menuitem', { name: 'Campaigns' }));
    await user.click(folderButton);
    expect(
      within(await screen.findByRole('list', { name: 'Designs' })).getByRole('heading', {
        name: 'Poster',
      }),
    ).toBeInTheDocument();
    const organizationAfterMove = await organization.load();
    expect(organizationAfterMove.ok).toBe(true);
    if (!organizationAfterMove.ok) return;
    expect(organizationAfterMove.value.projects).toHaveLength(1);
    expect(organizationAfterMove.value.projects[0]?.projectId).toBe('doc_a');
    expect(organizationAfterMove.value.projects[0]?.starred).toBe(false);
    expect(organizationAfterMove.value.projects[0]?.folderId).toBe(
      organizationAfterMove.value.folders[0]?.id,
    );

    await user.click(screen.getByRole('button', { name: 'Folder actions for Campaigns' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename folder' }));
    const folderName = screen.getByRole('textbox', { name: 'Folder name' });
    await user.clear(folderName);
    await user.type(folderName, 'Launches');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('button', { name: 'Launches' });

    await user.click(screen.getByRole('button', { name: 'Folder actions for Launches' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete folder' }));
    await screen.findByRole('heading', { name: 'Projects' });
    expect(await organization.load()).toMatchObject({
      ok: true,
      value: { projects: [], folders: [] },
    });
    expect(screen.getByRole('heading', { name: 'Poster' })).toBeInTheDocument();
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
    await openProjects(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('IndexedDB is locked.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('heading', { name: 'Poster' });
  });
});
