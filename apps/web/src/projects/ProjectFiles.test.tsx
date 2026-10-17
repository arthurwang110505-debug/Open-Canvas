import {
  createBlankDocument,
  createImageAsset,
  createImageElement,
  createRectElement,
  type DesignDocument,
} from '@opencanvas/document';
import {
  createMemoryProjectStore,
  packProject,
  unpackProject,
  type ProjectStore,
} from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Dashboard } from './Dashboard';
import type { ProjectsServices } from './ProjectsContext';
import { ProjectsProvider } from './ProjectsProvider';

const now = new Date('2026-06-07T08:09:10.000Z');
const LOGO_BYTES = new Uint8Array([137, 80, 78, 71, 42, 41, 40]);

interface Download {
  blob: Blob;
  filename: string;
}

function designWithImage(id = 'doc_file', name = 'Flyer'): DesignDocument {
  const document = createBlankDocument({ id, name, now });
  const asset = createImageAsset({
    id: 'asset_logo',
    name: 'logo.png',
    mimeType: 'image/png',
    width: 6,
    height: 6,
    now,
  });
  document.assets[asset.id] = asset;
  document.pages[0]?.elements.push(
    createRectElement({ id: 'r1', x: 10, y: 10, width: 120, height: 80 }),
    createImageElement({ id: 'i1', assetId: asset.id, x: 40, y: 120, width: 100, height: 100 }),
  );
  return document;
}

async function storeWith(design: DesignDocument, options: { withBytes?: boolean } = {}) {
  const store = createMemoryProjectStore();
  const saved = await store.save(design);
  if (!saved.ok) throw new Error(saved.error.message);
  if (options.withBytes !== false) {
    await store.assetBlobStore(design.id).put('asset_logo', new Blob([LOGO_BYTES.slice()]));
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

function servicesFor(store: ProjectStore, downloads: Download[]): ProjectsServices {
  return {
    store,
    backend: 'memory',
    download: (blob, filename) => downloads.push({ blob, filename }),
  };
}

/** Builds a real `.opencanvas` archive for import tests. */
async function projectFile(design: DesignDocument): Promise<File> {
  const packed = await packProject({
    document: design,
    readAsset: (assetId) =>
      Promise.resolve(assetId === 'asset_logo' ? new Blob([LOGO_BYTES.slice()]) : undefined),
    now,
  });
  if (!packed.ok) throw new Error(packed.error.message);
  return new File([packed.value], `${design.name}.opencanvas`, { type: packed.value.type });
}

beforeEach(() => {
  window.location.hash = '';
});

afterEach(() => {
  window.location.hash = '';
});

describe('exporting a project file', () => {
  it('downloads a .opencanvas file that holds the document and its image bytes', async () => {
    const design = designWithImage();
    const store = await storeWith(design);
    const downloads: Download[] = [];
    const { user } = renderDashboard(servicesFor(store, downloads));

    await user.click(await screen.findByRole('button', { name: 'Export Flyer' }));

    expect(await screen.findByText('Flyer.opencanvas was downloaded.')).toBeInTheDocument();
    const [download] = downloads;
    if (!download) throw new Error('expected a download');
    expect(download.filename).toBe('Flyer.opencanvas');

    const unpacked = await unpackProject(new Uint8Array(await download.blob.arrayBuffer()));
    if (!unpacked.ok) throw new Error(unpacked.error.message);
    expect(unpacked.value.document.id).toBe(design.id);
    expect(unpacked.value.document.name).toBe('Flyer');
    expect(unpacked.value.document.pages[0]?.elements).toHaveLength(2);
    expect(unpacked.value.blobs.size).toBe(1);
    const blob = unpacked.value.blobs.get('asset_logo');
    if (!blob) throw new Error('expected the logo blob');
    expect(blob.type).toBe('image/png');
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(LOGO_BYTES);
  });

  it('reports a project whose image bytes are gone instead of writing a broken file', async () => {
    const store = await storeWith(designWithImage(), { withBytes: false });
    const downloads: Download[] = [];
    const { user } = renderDashboard(servicesFor(store, downloads));

    await user.click(await screen.findByRole('button', { name: 'Export Flyer' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('"Flyer" could not be exported');
    expect(alert.textContent).toContain('logo.png');
    expect(downloads).toEqual([]);
  });
});

describe('importing a project file', () => {
  it('adds the design and its images to this browser', async () => {
    const store = createMemoryProjectStore();
    const downloads: Download[] = [];
    const { user } = renderDashboard(servicesFor(store, downloads));
    expect(await screen.findByText('No designs yet')).toBeInTheDocument();

    const input = screen.getByLabelText('OpenCanvas project file');
    await user.upload(input, await projectFile(designWithImage()));

    expect(await screen.findByText('Imported "Flyer".')).toBeInTheDocument();
    const card = screen.getByRole('heading', { name: 'Flyer' }).closest('li');
    expect(card).not.toBeNull();
    if (!card) return;
    expect(within(card).getByText(/1080 × 1080 px · 1 page · 2 elements/)).toBeInTheDocument();

    const imported = await store.load('doc_file');
    if (!imported.ok) throw new Error(imported.error.message);
    expect(imported.value.name).toBe('Flyer');
    const bytes = await store.assetBlobStore('doc_file').get('asset_logo');
    if (!bytes) throw new Error('expected the imported logo bytes');
    expect(new Uint8Array(await bytes.arrayBuffer())).toEqual(LOGO_BYTES);
  });

  it('imports a second copy rather than overwriting the project already here', async () => {
    const design = designWithImage();
    const store = await storeWith(design);
    const downloads: Download[] = [];
    const { user } = renderDashboard(servicesFor(store, downloads));
    await screen.findByRole('heading', { name: 'Flyer' });

    await user.upload(
      screen.getByLabelText('OpenCanvas project file'),
      await projectFile(designWithImage()),
    );

    expect(
      await screen.findByText('Imported as "Flyer copy" (a design with that id already exists).'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: 'Saved designs' })).getAllByRole('heading', {
        level: 2,
      }),
    ).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Flyer copy' })).toBeInTheDocument();

    const original = await store.load('doc_file');
    if (!original.ok) throw new Error(original.error.message);
    expect(original.value.name).toBe('Flyer');
  });

  it('rejects a file that is not an OpenCanvas project', async () => {
    const store = createMemoryProjectStore();
    const downloads: Download[] = [];
    const { user } = renderDashboard(servicesFor(store, downloads));

    await user.upload(
      screen.getByLabelText('OpenCanvas project file'),
      new File(['not a project'], 'notes.opencanvas', { type: 'text/plain' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('"notes.opencanvas" could not be imported');
    expect(alert.textContent).toContain('not a readable ZIP archive');
    expect(screen.getByText('No designs yet')).toBeInTheDocument();
  });
});
