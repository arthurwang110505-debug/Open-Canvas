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

const fixedDate = new Date('2026-10-22T11:00:00.000Z');

function bitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * One 320×180 image over a 400×200 photo: cover leaves a 356×200 window, so the crop box is
 * 16:9 and every aspect preset has room to move.
 */
function cropDocument(): DesignDocument {
  const asset = createImageAsset({
    id: 'asset_wide',
    name: 'wide.webp',
    mimeType: 'image/webp',
    width: 400,
    height: 200,
  });
  const base = createBlankDocument({ id: 'doc_crop', name: 'Crop', now: fixedDate });
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
            x: 100,
            y: 100,
            width: 320,
            height: 180,
          }),
        ],
      },
    ],
  };
}

function renderEditor(document: DesignDocument = cropDocument()) {
  const decode: ImageDecoder = () => Promise.resolve({ width: 400, height: 200 });
  const loadImage: ImageSourceLoader = () => Promise.resolve(bitmap(400, 200));
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} assetServices={{ decode, loadImage }} />
    </TooltipProvider>,
  );
  return { user };
}

const propertiesPanel = () => openPropertiesPanel();

function group(name: string): HTMLElement {
  const section = within(propertiesPanel()).getByRole('heading', { name }).closest('section');
  if (!(section instanceof HTMLElement)) throw new Error(`expected the "${name}" section`);
  return section;
}

/** Selects the only element through the Layers panel and opens crop mode from the panel. */
async function startCrop(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Layers');
  const layers = screen.getByRole('listbox', { name: 'Layers' });
  const [first] = within(layers).getAllByRole('option');
  if (!first) throw new Error('expected one layer');
  await user.click(first);
  await waitFor(() => {
    expect(within(propertiesPanel()).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
  });
  await user.click(within(group('Crop')).getByRole('button', { name: 'Crop on canvas' }));
  return screen.getByTestId('crop-overlay');
}

describe('on-canvas crop', () => {
  it('opens a crop box with eight handles, presets and apply/cancel', async () => {
    const { user } = renderEditor();
    const overlay = await startCrop(user);

    // The overlay itself is the dialog; its contents are queried inside it.
    expect(screen.getByRole('dialog', { name: 'Crop image' })).toBe(overlay);
    expect(within(overlay).getAllByRole('button', { name: /^Resize crop/ })).toHaveLength(8);
    const aspects = within(overlay).getByRole('group', { name: 'Crop aspect' });
    expect(within(aspects).getByRole('button', { name: '1:1' })).toBeInTheDocument();
    expect(within(aspects).getByRole('button', { name: '4:5' })).toBeInTheDocument();
    expect(within(aspects).getByRole('button', { name: '16:9' })).toBeInTheDocument();
    expect(within(overlay).getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(within(overlay).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('applies an aspect preset as one undoable change', async () => {
    const { user } = renderEditor();
    const overlay = await startCrop(user);

    await user.click(within(overlay).getByRole('button', { name: '1:1' }));
    await user.click(within(overlay).getByRole('button', { name: 'Apply' }));

    expect(screen.queryByTestId('crop-overlay')).not.toBeInTheDocument();
    // The window becomes 200x200 of a 400x200 photo, drawn at the cover scale (0.9): a 180x180 box.
    const box = group('Position & size');
    expect(within(box).getByLabelText('Width')).toHaveValue('180');
    expect(within(box).getByLabelText('Height')).toHaveValue('180');
    // The window it shows is the middle half of the photo.
    expect(within(group('Crop')).getByLabelText('Width')).toHaveValue('50');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(group('Position & size')).getByLabelText('Width')).toHaveValue('320');
    expect(within(group('Position & size')).getByLabelText('Height')).toHaveValue('180');
  });

  it('cancels on Escape without an undo step', async () => {
    const { user } = renderEditor();
    await startCrop(user);

    await user.click(
      within(screen.getByTestId('crop-overlay')).getByRole('button', { name: '4:5' }),
    );
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('crop-overlay')).not.toBeInTheDocument();
    expect(within(group('Position & size')).getByLabelText('Width')).toHaveValue('320');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('applies on Enter', async () => {
    const { user } = renderEditor();
    const overlay = await startCrop(user);

    await user.click(within(overlay).getByRole('button', { name: '1:1' }));
    await user.keyboard('{Enter}');
    expect(screen.queryByTestId('crop-overlay')).not.toBeInTheDocument();
    expect(within(group('Position & size')).getByLabelText('Height')).toHaveValue('180');
  });

  it('applies when the user clicks away from the box', async () => {
    const { user } = renderEditor();
    const overlay = await startCrop(user);

    await user.click(within(overlay).getByRole('button', { name: '1:1' }));
    fireEvent.pointerDown(screen.getByTestId('crop-backdrop'));
    expect(screen.queryByTestId('crop-overlay')).not.toBeInTheDocument();
    expect(within(group('Position & size')).getByLabelText('Height')).toHaveValue('180');
  });

  it('leaves the numeric crop fields working after an on-canvas crop', async () => {
    const { user } = renderEditor();
    const overlay = await startCrop(user);

    await user.click(within(overlay).getByRole('button', { name: '1:1' }));
    await user.keyboard('{Enter}');

    const crop = group('Crop');
    const x = within(crop).getByLabelText('X');
    expect(x).toHaveValue('25');
    await user.clear(x);
    await user.type(x, '30{Enter}');
    expect(within(crop).getByLabelText('X')).toHaveValue('30');
  });
});
