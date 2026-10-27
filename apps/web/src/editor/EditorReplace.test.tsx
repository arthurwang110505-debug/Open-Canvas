import type { ImageSourceLoader } from '@opencanvas/canvas-fabric';
import {
  createBlankDocument,
  createImageAsset,
  createImageElement,
  type DesignDocument,
} from '@opencanvas/document';
import type { ImageDecoder } from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import { ELEMENT_DRAG_MIME } from './elements/drag';

const fixedDate = new Date('2026-10-22T10:00:00.000Z');
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48];

function pngFile(name = 'studio.png', padTo = 256): File {
  const data = new Uint8Array(padTo);
  data.set(PNG_HEADER);
  return new File([data], name, { type: 'image/png' });
}

function bitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/** A document whose single element is an image with a non-default box, crop and filters. */
function imageDocument(options: { locked?: boolean; fullPage?: boolean } = {}): DesignDocument {
  const asset = createImageAsset({
    id: 'asset_lake',
    name: 'Alpine lake',
    mimeType: 'image/webp',
    width: 1408,
    height: 1056,
    source: { type: 'bundled', photoId: 'alpine-lake' },
  });
  const base = createBlankDocument({ id: 'doc_replace', name: 'Replace', now: fixedDate });
  return {
    ...base,
    assets: { [asset.id]: asset },
    pages: [
      {
        ...base.pages[0]!,
        elements: [
          createImageElement({
            id: 'img_1',
            assetId: asset.id,
            // A full-page box makes the drop point land inside it whatever jsdom reports for the
            // canvas rect; the smaller box is what the panel assertions expect.
            ...(options.fullPage
              ? { x: 0, y: 0, width: 1080, height: 1080 }
              : { x: 120, y: 90, width: 400, height: 300 }),
            crop: { x: 0.1, y: 0.2, width: 0.6, height: 0.5 },
            filters: { brightness: 120, contrast: 90, saturate: 100, blur: 0 },
            ...(options.locked ? { locked: true } : {}),
          }),
        ],
      },
    ],
  };
}

function renderEditor(document: DesignDocument) {
  const decode: ImageDecoder = () => Promise.resolve({ width: 1600, height: 900 });
  const loadImage: ImageSourceLoader = () => Promise.resolve(bitmap(1408, 1056));
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} assetServices={{ decode, loadImage }} />
    </TooltipProvider>,
  );
  return { user };
}

const propertiesPanel = () => openPropertiesPanel();

/** The field group with this heading; labels like "Width" appear in more than one group. */
function group(name: string): HTMLElement {
  const section = within(propertiesPanel()).getByRole('heading', { name }).closest('section');
  if (!(section instanceof HTMLElement)) throw new Error(`expected the "${name}" section`);
  return section;
}

/** Selects the only element through the Layers panel, as a user without a pointed cursor would. */
async function selectOnlyElement(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Layers');
  const layers = screen.getByRole('listbox', { name: 'Layers' });
  const [first] = within(layers).getAllByRole('option');
  if (!first) throw new Error('expected one layer');
  await user.click(first);
  await waitFor(() => {
    expect(within(propertiesPanel()).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
  });
}

/** jsdom has no `DataTransfer`; the panel and the stage only need these members. */
function photoDrag() {
  const entries = new Map<string, string>();
  return {
    get types() {
      return [...entries.keys()];
    },
    getData: (type: string) => entries.get(type) ?? '',
    setData: (type: string, value: string) => {
      entries.set(type, value);
    },
    set payload(value: unknown) {
      entries.set(ELEMENT_DRAG_MIME, JSON.stringify(value));
    },
    dropEffect: 'none',
    effectAllowed: 'none',
    files: [] as File[],
  };
}

describe('replacing an image', () => {
  it('swaps the picture and keeps the box, crop and filters', async () => {
    const { user } = renderEditor(imageDocument());
    await selectOnlyElement(user);
    const panel = propertiesPanel();
    // Named in the element subtitle and in the file row of the image group.
    expect(within(panel).getAllByText('Alpine lake').length).toBeGreaterThan(0);

    await user.click(within(panel).getByRole('button', { name: 'Replace image' }));
    const picker = within(panel).getByRole('listbox', { name: 'Replace with a photo' });
    await user.click(within(picker).getByRole('option', { name: 'Replace with Desert dunes' }));

    // The asset changed; nothing else did.
    expect(within(panel).getAllByText('Desert dunes').length).toBeGreaterThan(0);
    expect(within(panel).queryAllByText('Alpine lake')).toHaveLength(0);
    const box = group('Position & size');
    expect(within(box).getByLabelText('Width')).toHaveValue('400');
    expect(within(box).getByLabelText('Height')).toHaveValue('300');
    expect(within(box).getByLabelText('X')).toHaveValue('120');
    expect(within(group('Adjust')).getByLabelText('Brightness')).toHaveValue('120');

    // The crop window still describes the same part of the old picture.
    const crop = group('Crop');
    expect(within(crop).getByLabelText('X')).toHaveValue('10');
    expect(within(crop).getByLabelText('Width')).toHaveValue('60');
  });

  it('replaces in one undo step, bringing the old picture back', async () => {
    const { user } = renderEditor(imageDocument());
    await selectOnlyElement(user);
    const panel = propertiesPanel();

    await user.click(within(panel).getByRole('button', { name: 'Replace image' }));
    const picker = within(panel).getByRole('listbox', { name: 'Replace with a photo' });
    await user.click(within(picker).getByRole('option', { name: 'Replace with Ocean waves' }));
    expect(within(panel).getAllByText('Ocean waves').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(panel).getAllByText('Alpine lake').length).toBeGreaterThan(0);
  });

  it('accepts an upload as the replacement', async () => {
    const { user } = renderEditor(imageDocument());
    await selectOnlyElement(user);
    const panel = propertiesPanel();

    await user.click(within(panel).getByRole('button', { name: 'Replace image' }));
    await user.upload(within(panel).getByLabelText('Upload a replacement image'), pngFile());

    await waitFor(() => {
      expect(within(panel).getAllByText('studio.png').length).toBeGreaterThan(0);
    });
    // The element kept its box, so the upload replaced the picture rather than adding one.
    const box = group('Position & size');
    expect(within(box).getByLabelText('Width')).toHaveValue('400');
    expect(within(box).getByLabelText('X')).toHaveValue('120');
  });

  it('drops the old asset record once nothing references it', async () => {
    const { user } = renderEditor(imageDocument());
    await selectOnlyElement(user);
    const panel = propertiesPanel();

    await user.click(within(panel).getByRole('button', { name: 'Replace image' }));
    const picker = within(panel).getByRole('listbox', { name: 'Replace with a photo' });
    await user.click(within(picker).getByRole('option', { name: 'Replace with Snow ridge' }));

    // The Uploads panel lists every asset record in the document: the unused one is gone.
    await activateSidebarTab(user, 'Uploads');
    const uploads = screen.getByRole('tabpanel');
    expect(within(uploads).queryByLabelText('Add Alpine lake to the page')).not.toBeInTheDocument();
    expect(within(uploads).getByLabelText('Add Snow ridge to the page')).toBeInTheDocument();
  });
});

describe('swapping an image by drag and drop', () => {
  it('drops a photo onto the image instead of stacking a second one', async () => {
    renderEditor(imageDocument({ fullPage: true }));
    const stage = screen.getByTestId('canvas-stage');

    const transfer = photoDrag();
    transfer.payload = { kind: 'photo', photoId: 'ocean-waves' };
    fireEvent.dragOver(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });
    // No "new element" ghost over a target that will be filled instead.
    expect(screen.queryByTestId('element-drop-ghost')).not.toBeInTheDocument();
    fireEvent.drop(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Layers' }));
    const layers = screen.getByRole('listbox', { name: 'Layers' });
    const options = within(layers).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('Ocean waves');
  });

  it('adds a new element when the image under the pointer is locked', async () => {
    renderEditor(imageDocument({ locked: true, fullPage: true }));
    const stage = screen.getByTestId('canvas-stage');

    const transfer = photoDrag();
    transfer.payload = { kind: 'photo', photoId: 'ocean-waves' };
    fireEvent.drop(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Layers' }));
    const layers = screen.getByRole('listbox', { name: 'Layers' });
    expect(within(layers).getAllByRole('option')).toHaveLength(2);
    expect(within(layers).getByRole('option', { name: /Alpine lake/ })).toBeInTheDocument();
  });
});
