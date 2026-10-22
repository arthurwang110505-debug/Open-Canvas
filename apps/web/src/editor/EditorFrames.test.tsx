import { createBlankDocument, createFrameElement, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { ELEMENT_DRAG_MIME } from './elements/drag';

const fixedDate = new Date('2026-10-22T10:00:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc = document ?? createBlankDocument({ id: 'doc_frames', name: 'Frames', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user, document: doc };
}

const propertiesPanel = () => screen.getByRole('complementary', { name: 'Properties' });

async function insertFrame(user: ReturnType<typeof userEvent.setup>, name = 'Photo frame') {
  await user.click(screen.getByRole('tab', { name: 'Elements' }));
  await user.click(screen.getByRole('button', { name }));
  return propertiesPanel();
}

/** jsdom has no `DataTransfer`; the panel and the stage only need these members. */
function fakeDataTransfer(initial: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initial));
  return {
    get types() {
      return [...entries.keys()];
    },
    getData: (type: string) => entries.get(type) ?? '',
    setData: (type: string, value: string) => {
      entries.set(type, value);
    },
    dropEffect: 'none',
    effectAllowed: 'none',
    files: [] as File[],
  };
}

function photodrag(photoId: string) {
  const transfer = fakeDataTransfer();
  transfer.setData(ELEMENT_DRAG_MIME, JSON.stringify({ kind: 'photo', photoId }));
  return transfer;
}

describe('frames', () => {
  it('inserts an empty frame with its own properties', async () => {
    const { user } = renderEditor();
    const panel = await insertFrame(user);

    expect(within(panel).getByRole('heading', { name: 'Frame' })).toBeInTheDocument();
    expect(within(panel).getByText('Empty frame')).toBeInTheDocument();
    expect(within(panel).getByLabelText('Shape')).toHaveValue('rect');
    // A placeholder is a real element: it can be sized before a photo exists.
    expect(within(panel).getByLabelText('Width')).toHaveValue('540');
    expect(within(panel).getByRole('button', { name: 'Choose photo' })).toBeInTheDocument();
  });

  it('fills the frame with a chosen photo and names the layer after it', async () => {
    const { user } = renderEditor();
    const panel = await insertFrame(user);

    await user.click(within(panel).getByRole('button', { name: 'Choose photo' }));
    const picker = within(panel).getByRole('listbox', { name: 'Choose a photo' });
    await user.click(within(picker).getByRole('option', { name: 'Fill with Alpine lake' }));

    expect(within(panel).getByText('Alpine lake')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Replace photo' })).toBeInTheDocument();
    // The frame keeps its shape; only its content changed.
    expect(within(panel).getByLabelText('Photo fit')).toHaveValue('cover');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('drops a photo onto a frame instead of stacking a second element', async () => {
    const document = createBlankDocument({ id: 'doc_drop', name: 'Drop', now: fixedDate });
    // A full-page frame: any drop point lands inside it.
    document.pages[0]?.elements.push(
      createFrameElement({ id: 'frame_full', x: 0, y: 0, width: 1080, height: 1080 }),
    );
    renderEditor(document);

    const stage = screen.getByTestId('canvas-stage');
    fireEvent.drop(stage, { dataTransfer: photodrag('ocean-waves'), clientX: 2000, clientY: 2000 });

    const panel = propertiesPanel();
    // Still one frame element — the drop filled it rather than adding an image on top.
    expect(within(panel).getByRole('heading', { name: 'Frame' })).toBeInTheDocument();
    expect(within(panel).getByText('Ocean waves')).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Layers' }));
    const layers = screen.getByRole('listbox', { name: 'Layers' });
    expect(within(layers).getAllByRole('option')).toHaveLength(1);
    expect(within(layers).getByRole('option', { name: /Ocean waves/ })).toBeInTheDocument();
  });

  it('switches the mask between rectangle and ellipse', async () => {
    const { user } = renderEditor();
    const panel = await insertFrame(user, 'Circle frame');
    expect(within(panel).getByLabelText('Shape')).toHaveValue('ellipse');
    // Corner radius only means something for a rectangle.
    expect(within(panel).queryByLabelText('Corner radius')).not.toBeInTheDocument();

    await user.selectOptions(within(panel).getByLabelText('Shape'), 'rect');
    expect(within(panel).getByLabelText('Corner radius')).toBeInTheDocument();
  });

  it('removes the photo but keeps the frame', async () => {
    const { user } = renderEditor();
    const panel = await insertFrame(user);
    await user.click(within(panel).getByRole('button', { name: 'Choose photo' }));
    const picker = within(panel).getByRole('listbox', { name: 'Choose a photo' });
    await user.click(within(picker).getByRole('option', { name: 'Fill with Desert dunes' }));
    expect(within(panel).getByText('Desert dunes')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: 'Remove' }));
    expect(within(panel).getByText('Empty frame')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Choose photo' })).toBeInTheDocument();
  });
});
