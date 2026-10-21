import { createBlankDocument, createRectElement, err } from '@opencanvas/document';
import {
  createMemoryProjectStore,
  projectStoreError,
  type ProjectStore,
} from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ProjectsServices } from './ProjectsContext';
import { ProjectsProvider } from './ProjectsProvider';
import { ProjectEditor } from './ProjectEditor';

const PROJECT_ID = 'doc_persist';
/** Autosave waits for a quiet period of 1.2 s; give the assertions room beyond that. */
const SAVE_TIMEOUT = 5000;

function servicesFor(store: ProjectStore): ProjectsServices {
  return {
    store,
    backend: 'memory',
    // The dashboard is not exercised here; a no-op keeps the services complete.
    download: () => {
      /* not used by these tests */
    },
  };
}

async function persistedStore(): Promise<ProjectStore> {
  const store = createMemoryProjectStore();
  const document = createBlankDocument({ id: PROJECT_ID, name: 'Saved design' });
  document.pages[0]?.elements.push(createRectElement({ id: 'rect_saved', name: 'Kept rectangle' }));
  const saved = await store.save(document);
  if (!saved.ok) throw new Error(saved.error.message);
  return store;
}

function renderProjectEditor(services: ProjectsServices, projectId: string = PROJECT_ID) {
  const user = userEvent.setup();
  const view = render(
    <TooltipProvider>
      <ProjectsProvider services={services}>
        <ProjectEditor projectId={projectId} />
      </ProjectsProvider>
    </TooltipProvider>,
  );
  return { user, ...view };
}

async function insertRectangle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('tab', { name: 'Shapes' }));
  await user.click(await screen.findByRole('button', { name: 'Rectangle' }));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('ProjectEditor', () => {
  it('opens a saved design', async () => {
    renderProjectEditor(servicesFor(await persistedStore()));
    expect(await screen.findByRole('textbox', { name: 'Design name' })).toHaveValue('Saved design');
    expect(screen.getByRole('status')).toHaveTextContent('No unsaved changes');
  });

  it('reports a design that cannot be loaded and offers a way back', async () => {
    const { user } = renderProjectEditor(servicesFor(createMemoryProjectStore()), 'doc_missing');

    expect(
      await screen.findByRole('heading', { name: 'This design could not be opened' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No saved design with id "doc_missing".');

    await user.click(screen.getByRole('button', { name: 'Back to designs' }));
    expect(window.location.hash).toBe('#/');
  });

  it('autosaves an edit to the project store and marks it saved', async () => {
    const store = createMemoryProjectStore();
    const blank = createBlankDocument({ id: PROJECT_ID, name: 'Saved design' });
    await store.save(blank);
    const { user } = renderProjectEditor(servicesFor(store));

    await insertRectangle(user);
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All changes saved'), {
      timeout: SAVE_TIMEOUT,
    });

    const saved = await store.load(PROJECT_ID);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.pages[0]?.elements).toHaveLength(1);
    expect(saved.value.pages[0]?.elements[0]?.type).toBe('rect');
  });

  it('restores the saved design when the editor is reopened', async () => {
    const store = await persistedStore();
    const services = servicesFor(store);
    const first = renderProjectEditor(services);
    await screen.findByRole('textbox', { name: 'Design name' });

    await first.user.click(screen.getByRole('tab', { name: 'Layers' }));
    const list = screen.getByRole('listbox', { name: 'Layers' });
    expect(within(list).getByRole('option', { name: 'Kept rectangle' })).toBeInTheDocument();
    first.unmount();

    // A fresh mount stands for a page reload: the document comes back from the store.
    const second = renderProjectEditor(services);
    expect(await screen.findByRole('textbox', { name: 'Design name' })).toHaveValue('Saved design');
    await second.user.click(screen.getByRole('tab', { name: 'Layers' }));
    expect(
      within(screen.getByRole('listbox', { name: 'Layers' })).getByRole('option', {
        name: 'Kept rectangle',
      }),
    ).toBeInTheDocument();
  });

  it('saves immediately on Ctrl/⌘ S without waiting for the quiet period', async () => {
    const store = createMemoryProjectStore();
    await store.save(createBlankDocument({ id: PROJECT_ID, name: 'Saved design' }));
    const { user } = renderProjectEditor(servicesFor(store));

    await insertRectangle(user);
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    await user.keyboard('{Control>}s{/Control}');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All changes saved'), {
      timeout: 1000,
    });
    const saved = await store.load(PROJECT_ID);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.pages[0]?.elements).toHaveLength(1);
  });

  it('surfaces a failed write and recovers with "Save now"', async () => {
    const inner = createMemoryProjectStore();
    await inner.save(createBlankDocument({ id: PROJECT_ID, name: 'Saved design' }));
    let failing = true;
    const store: ProjectStore = {
      list: () => inner.list(),
      load: (projectId) => inner.load(projectId),
      save: (document) =>
        failing
          ? Promise.resolve(
              err(
                projectStoreError('quota-exceeded', 'The browser ran out of local storage space.'),
              ),
            )
          : inner.save(document),
      duplicate: (projectId) => inner.duplicate(projectId),
      remove: (projectId) => inner.remove(projectId),
      assetBlobStore: (projectId) => inner.assetBlobStore(projectId),
    };
    const { user } = renderProjectEditor(servicesFor(store));

    await insertRectangle(user);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Save failed'), {
      timeout: SAVE_TIMEOUT,
    });
    expect(screen.getByText('The browser ran out of local storage space.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save now' })).toBeInTheDocument();

    failing = false;
    await user.click(screen.getByRole('button', { name: 'Save now' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('All changes saved'), {
      timeout: 1000,
    });
    const saved = await inner.load(PROJECT_ID);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.pages[0]?.elements).toHaveLength(1);
  });
});
