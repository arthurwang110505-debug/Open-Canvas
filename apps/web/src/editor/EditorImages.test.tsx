import type { ImageSourceLoader } from '@opencanvas/canvas-fabric';
import { createBlankDocument } from '@opencanvas/document';
import type { ImageDecoder } from '@opencanvas/storage';
import { TooltipProvider } from '@opencanvas/ui';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');
const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48];

function pngFile(name = 'photo.png', padTo = 256): File {
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

function renderEditor(
  options: { decode?: ImageDecoder; loadImage?: ImageSourceLoader; applyAccept?: boolean } = {},
) {
  const document = createBlankDocument({ id: 'doc_test', name: 'Test design', now: fixedDate });
  const decode: ImageDecoder =
    options.decode ?? (() => Promise.resolve({ width: 1600, height: 900 }));
  const loadImage: ImageSourceLoader =
    options.loadImage ?? (() => Promise.resolve(bitmap(1600, 900)));
  const user = userEvent.setup({ applyAccept: options.applyAccept ?? true });
  render(
    <TooltipProvider>
      <EditorPage document={document} assetServices={{ decode, loadImage }} />
    </TooltipProvider>,
  );
  return { user };
}

async function openUploads(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Uploads');
  return screen.getByRole('tabpanel');
}

describe('image uploads', () => {
  it('imports a file, registers the asset and places a fitted image element', async () => {
    const { user } = renderEditor();
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());

    const panel = openPropertiesPanel();
    await within(panel).findByRole('heading', { name: 'Image' });
    // 1600x900 fitted into 60% of a 1080 square → 648x364.5 → rounded 648x365, centered.
    expect(within(panel).getByLabelText('Width')).toHaveValue('648');
    expect(within(panel).getByLabelText('Height')).toHaveValue('365');
    expect(within(panel).getByLabelText('X')).toHaveValue('216');
    expect(within(panel).getByLabelText('Fit')).toHaveValue('cover');
    // Shown as the element subtitle and in the file row of the image group.
    expect(within(panel).getAllByText('photo.png')).toHaveLength(2);
    expect(within(panel).getByText('1600×900 px')).toBeInTheDocument();

    await activateSidebarTab(user, 'Uploads');
    const list = screen.getByRole('list', { name: 'Uploaded images' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('changes the fit mode from the properties panel', async () => {
    const { user } = renderEditor();
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());
    const panel = openPropertiesPanel();
    const fit = await within(panel).findByLabelText('Fit');
    await user.selectOptions(fit, 'fill');
    expect(fit).toHaveValue('fill');
    expect(within(panel).getByText('Stretches the image to the box')).toBeInTheDocument();
  });

  it('undoes an upload in a single step and redoes it', async () => {
    const { user } = renderEditor();
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());
    await screen.findByRole('list', { name: 'Uploaded images' });

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.queryByRole('list', { name: 'Uploaded images' })).not.toBeInTheDocument();
    expect(screen.getByText('Start your design')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('list', { name: 'Uploaded images' })).toBeInTheDocument();
    const panel = openPropertiesPanel();
    expect(within(panel).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
  });

  it('re-inserts an uploaded asset from the panel and refuses to remove it while in use', async () => {
    const { user } = renderEditor();
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());
    await screen.findByRole('list', { name: 'Uploaded images' });

    await user.click(screen.getByRole('button', { name: 'Add photo.png to the page' }));
    await user.keyboard('{Escape}');
    // Re-inserting keeps the same asset record while adding a second element to the design.
    await activateSidebarTab(user, 'Layers');
    expect(within(screen.getByRole('listbox', { name: 'Layers' })).getAllByRole('option')).toHaveLength(2);
    await activateSidebarTab(user, 'Uploads');
    expect(
      within(screen.getByRole('list', { name: 'Uploaded images' })).getAllByRole('listitem'),
    ).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Remove photo.png' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/still used on the canvas/);
    expect(screen.getByRole('list', { name: 'Uploaded images' })).toBeInTheDocument();
  });

  it('removes an unused upload', async () => {
    const { user } = renderEditor();
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());
    await screen.findByRole('list', { name: 'Uploaded images' });
    const panel = openPropertiesPanel();
    await user.click(within(panel).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    await activateSidebarTab(user, 'Uploads');
    await user.click(screen.getByRole('button', { name: 'Remove photo.png' }));
    expect(screen.queryByRole('list', { name: 'Uploaded images' })).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports unsupported files without touching the document', async () => {
    // The input's accept filter is bypassed so the import-side validation is exercised.
    const { user } = renderEditor({ applyAccept: false });
    await openUploads(user);
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    await user.upload(screen.getByLabelText('Upload images'), svg);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not add "icon.svg"');
    expect(alert).toHaveTextContent(/Unsupported image format/);
    expect(screen.getByText('Start your design')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No unsaved changes');
  });

  it('reports decode failures from the browser', async () => {
    const { user } = renderEditor({ decode: () => Promise.reject(new Error('bad chunk')) });
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile('broken.png'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not add "broken.png"');
    expect(alert).toHaveTextContent(/bad chunk/);
  });

  it('surfaces canvas-side asset load failures', async () => {
    const loadImage = vi.fn<ImageSourceLoader>(() => Promise.reject(new Error('corrupt data')));
    const { user } = renderEditor({ loadImage });
    await openUploads(user);
    await user.upload(screen.getByLabelText('Upload images'), pngFile());
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Image "photo.png" could not be displayed');
    expect(alert).toHaveTextContent(/corrupt data/);
    // The element still exists so the user can remove it.
    const panel = openPropertiesPanel();
    expect(within(panel).getByRole('heading', { name: 'Image' })).toBeInTheDocument();
  });

  it('accepts files dropped on the canvas and centers them on the drop point', async () => {
    renderEditor();
    const stage = screen.getByTestId('canvas-stage');
    const dataTransfer = { files: [pngFile()], types: ['Files'], dropEffect: 'none' };
    fireEvent.dragOver(stage, { dataTransfer });
    expect(screen.getByText('Drop images to add them to the page')).toBeInTheDocument();
    fireEvent.drop(stage, { dataTransfer, clientX: 0, clientY: 0 });

    const panel = openPropertiesPanel();
    await within(panel).findByRole('heading', { name: 'Image' });
    expect(screen.queryByText('Drop images to add them to the page')).not.toBeInTheDocument();
    // Fit-to-screen puts the page center at the viewport center (600, 400); the drop at the
    // viewport origin maps to a page point left/above the page, so the image is centered there.
    await waitFor(() => {
      expect(Number(within(panel).getByLabelText('X').getAttribute('value'))).toBeLessThan(0);
    });
    expect(within(panel).getByLabelText('Width')).toHaveValue('648');
  });

  it('toggles snapping from the top bar', async () => {
    const { user } = renderEditor();
    const toggle = screen.getByRole('button', { name: 'Snap to objects' });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
  });
});
