import { createBlankDocument, createRectElement } from '@opencanvas/document';
import { createMemoryProjectStore, type ProjectStore } from '@opencanvas/storage';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { App } from './App';
import type { ProjectsServices } from './projects/ProjectsContext';

const PROJECT_ID = 'doc_app';

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

async function seededServices(): Promise<ProjectsServices> {
  const store = createMemoryProjectStore();
  const document = createBlankDocument({ id: PROJECT_ID, name: 'Route design' });
  document.pages[0]?.elements.push(createRectElement({ id: 'rect_route' }));
  const saved = await store.save(document);
  if (!saved.ok) throw new Error(saved.error.message);
  return servicesFor(store);
}

function setHash(hash: string) {
  act(() => {
    window.location.hash = hash;
  });
}

describe('App routing', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  afterEach(() => {
    window.location.hash = '';
  });

  it('starts on the dashboard', async () => {
    render(<App projects={servicesFor(createMemoryProjectStore())} />);
    expect(await screen.findByRole('heading', { name: 'Your designs' })).toBeInTheDocument();
  });

  it('opens the editor for a design hash', async () => {
    setHash(`#/design/${PROJECT_ID}`);
    render(<App projects={await seededServices()} />);
    expect(await screen.findByRole('textbox', { name: 'Design name' })).toHaveValue('Route design');
  });

  it('follows hash changes in both directions', async () => {
    const user = userEvent.setup();
    const services = await seededServices();
    render(<App projects={services} />);
    await screen.findByRole('heading', { name: 'Your designs' });

    setHash(`#/design/${PROJECT_ID}`);
    expect(await screen.findByRole('textbox', { name: 'Design name' })).toHaveValue('Route design');

    await user.click(screen.getByRole('link', { name: 'OpenCanvas: back to your designs' }));
    expect(await screen.findByRole('heading', { name: 'Your designs' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
  });

  it('explains an unknown route and offers a way back', async () => {
    const user = userEvent.setup();
    setHash('#/settings');
    render(<App projects={servicesFor(createMemoryProjectStore())} />);

    expect(await screen.findByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByText('#/settings')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to your designs' }));
    expect(await screen.findByRole('heading', { name: 'Your designs' })).toBeInTheDocument();
  });
});
