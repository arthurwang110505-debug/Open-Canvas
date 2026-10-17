import { err } from '@opencanvas/document';
import {
  createMemoryProjectStore,
  projectStoreError,
  type ProjectStore,
} from '@opencanvas/storage';
import { getTemplate, TEMPLATES } from '@opencanvas/templates';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Dashboard } from './Dashboard';
import type { ProjectsServices } from './ProjectsContext';
import { ProjectsProvider } from './ProjectsProvider';

function servicesFor(store: ProjectStore): ProjectsServices {
  return {
    store,
    backend: 'memory',
    download: () => {
      /* not used by these tests */
    },
  };
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

/** Waits for the gallery (the project list resolves first) and returns one template card. */
async function cardFor(name: string): Promise<HTMLElement> {
  return screen.findByRole('button', {
    name: `Create a design from the ${name} template`,
  });
}

/** Decodes the data URL of a preview image back to the SVG markup. */
async function previewSvg(button: HTMLElement): Promise<string> {
  const image = await waitFor(() => {
    const img = within(button).getByRole('presentation', { hidden: true });
    expect(img).toHaveAttribute('src');
    return img;
  });
  const src = image.getAttribute('src') ?? '';
  expect(src.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
  return decodeURIComponent(src.slice(src.indexOf(',') + 1));
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('the template gallery', () => {
  it('offers every shipped template', async () => {
    const store = createMemoryProjectStore();
    renderDashboard(servicesFor(store));

    expect(
      await screen.findByRole('heading', { name: 'Start from a template' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        `${String(TEMPLATES.length)} original templates ship with OpenCanvas — shapes and text only, no stock assets. Everything stays editable once the design is created.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /template$/ })).toHaveLength(TEMPLATES.length);
    expect(await cardFor('Café menu (A4)')).toBeEnabled();
  });

  it('previews the real rendering, not a stand-in picture', async () => {
    const store = createMemoryProjectStore();
    renderDashboard(servicesFor(store));

    const svg = await previewSvg(await cardFor('Sale announcement'));
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 1080 1080"');
    expect(svg).toContain('50% OFF');
    expect(svg).toContain('<title>Sale announcement</title>');
  });

  it('creates a design from the template and opens it in the editor', async () => {
    const store = createMemoryProjectStore();
    const { user } = renderDashboard(servicesFor(store));
    const definition = getTemplate('poster-event-a4');
    if (!definition) throw new Error('expected the poster template');

    await user.click(await cardFor(definition.name));

    await waitFor(() => expect(window.location.hash).toMatch(/^#\/design\//));
    const projectId = decodeURIComponent(window.location.hash.replace('#/design/', ''));

    const saved = await store.load(projectId);
    if (!saved.ok) throw new Error(saved.error.message);
    const document = saved.value;
    expect(document.metadata.source).toBe('template');
    expect(document.metadata.templateId).toBe('poster-event-a4');
    expect(document.name).toBe('Event poster (A4)');
    expect(document.size).toEqual({ width: 2480, height: 3508 });
    expect(document.assets).toEqual({});
    const page = document.pages[0];
    expect(page?.background).toEqual({ type: 'solid', color: '#fffbeb' });
    expect(page?.elements).toHaveLength(definition.elements.length);
    expect(page?.elements.map((element) => element.id)).toEqual(
      definition.elements.map((element) => element.id),
    );

    const listed = await store.list();
    if (!listed.ok) throw new Error(listed.error.message);
    expect(listed.value).toHaveLength(1);
    expect(listed.value[0]?.name).toBe('Event poster (A4)');
  });

  it('reports a template that cannot be saved instead of navigating away', async () => {
    const inner = createMemoryProjectStore();
    const store: ProjectStore = {
      list: () => inner.list(),
      load: (projectId) => inner.load(projectId),
      save: () =>
        Promise.resolve(err(projectStoreError('quota-exceeded', 'This browser is out of space.'))),
      duplicate: (projectId) => inner.duplicate(projectId),
      remove: (projectId) => inner.remove(projectId),
      assetBlobStore: (projectId) => inner.assetBlobStore(projectId),
    };
    const { user } = renderDashboard(servicesFor(store));

    await user.click(await cardFor('Business card'));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The "Business card" template could not be used');
    expect(alert.textContent).toContain('This browser is out of space.');
    expect(window.location.hash).toBe('');
  });
});
