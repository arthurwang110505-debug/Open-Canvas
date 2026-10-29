import { createBlankDocument, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import { ELEMENT_DRAG_MIME, parseElementDragPayload } from './elements/drag';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc =
    document ?? createBlankDocument({ id: 'doc_elements', name: 'Elements', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

async function openElements(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Elements');
  return {
    search: screen.getByRole('searchbox', { name: 'Search elements' }),
    shapes: screen.getByRole('region', { name: 'Shapes' }),
    icons: screen.getByRole('listbox', { name: 'Icons' }),
  };
}

/**
 * jsdom ships no `DataTransfer`, so drag tests carry the same tiny record shape the browser
 * exposes: a type list and a getter/setter over string payloads.
 */
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

const propertiesPanel = () => openPropertiesPanel();

describe('elements panel', () => {
  it('searches shapes and icons with one query', async () => {
    const { user } = renderEditor();
    const { search, shapes, icons } = await openElements(user);

    expect(within(shapes).getByRole('button', { name: 'Rectangle' })).toBeInTheDocument();
    expect(within(icons).getByRole('option', { name: 'Insert heart' })).toBeInTheDocument();

    // "star" is a shape label and an icon id.
    await user.type(search, 'star');
    expect(within(shapes).getByRole('button', { name: 'Star' })).toBeInTheDocument();
    expect(within(shapes).queryByRole('button', { name: 'Rectangle' })).not.toBeInTheDocument();
    expect(within(icons).getByRole('option', { name: 'Insert star' })).toBeInTheDocument();

    // A keyword only an icon has empties the shape half of the panel.
    await user.clear(search);
    await user.type(search, 'heart');
    expect(screen.queryByRole('region', { name: 'Shapes' })).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('listbox', { name: 'Icons' })).getByRole('option', {
        name: 'Insert heart',
      }),
    ).toBeInTheDocument();
  });

  it('filters by library with the category chips', async () => {
    const { user } = renderEditor();
    const { search } = await openElements(user);

    const shapesChip = screen.getByRole('button', { name: 'Shapes' });
    const iconsChip = screen.getByRole('button', { name: 'Icons' });
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(shapesChip);
    expect(shapesChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Shapes' })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Icons' })).not.toBeInTheDocument();

    await user.click(iconsChip);
    expect(iconsChip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('listbox', { name: 'Icons' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Shapes' })).not.toBeInTheDocument();

    // Search still applies inside a library.
    await user.type(search, 'heart');
    expect(
      within(screen.getByRole('listbox', { name: 'Icons' })).getByRole('option', {
        name: 'Insert heart',
      }),
    ).toBeInTheDocument();
  });

  it('recovers from no matches by clearing the query and category together', async () => {
    const { user } = renderEditor();
    const { search } = await openElements(user);

    await user.click(screen.getByRole('button', { name: 'Icons' }));
    await user.type(search, 'zzzz-nothing');
    expect(screen.getByRole('heading', { name: /No elements match/ })).toBeInTheDocument();
    expect(screen.queryByRole('listbox', { name: 'Icons' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Shapes' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(search).toHaveValue('');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('region', { name: 'Shapes' })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: 'Icons' })).toBeInTheDocument();
  });

  it('inserts a click straight into the middle of the page', async () => {
    const { user } = renderEditor();
    const { shapes } = await openElements(user);

    await user.click(within(shapes).getByRole('button', { name: 'Rectangle' }));
    let properties = propertiesPanel();
    // 30% of a 1080 square, centred.
    expect(within(properties).getByLabelText('Width')).toHaveValue('324');
    expect(within(properties).getByLabelText('X')).toHaveValue('378');

    const { icons: iconsAgain } = await openElements(user);
    await user.click(within(iconsAgain).getByRole('option', { name: 'Insert heart' }));
    properties = propertiesPanel();
    expect(within(properties).getByRole('heading', { level: 2, name: 'Icon' })).toBeInTheDocument();
    expect(within(properties).getByLabelText('Width')).toHaveValue('216');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('drags a shape payload and drops it at the pointer', async () => {
    const { user } = renderEditor();
    const { shapes } = await openElements(user);

    const transfer = fakeDataTransfer();
    fireEvent.dragStart(within(shapes).getByRole('button', { name: 'Rectangle' }), {
      dataTransfer: transfer,
    });
    expect(parseElementDragPayload(transfer.getData(ELEMENT_DRAG_MIME))).toEqual({
      kind: 'shape',
      shape: 'rect',
    });

    const stage = screen.getByTestId('canvas-stage');
    fireEvent.dragOver(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });

    // The ghost previews the real inserted size: 30% of the page's short side, at this zoom.
    // (jsdom reports a 1x1 viewport, so the exact px depends on the fitted zoom; only its
    // existence and a positive size are asserted here.)
    const ghost = screen.getByTestId('element-drop-ghost');
    expect(Number.parseFloat(ghost.style.width)).toBeGreaterThan(0);

    fireEvent.drop(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });

    const properties = propertiesPanel();
    expect(within(properties).getByLabelText('Width')).toHaveValue('324');
    // Dropped far past the bottom-right corner, so it lands clamped to the page, not centred.
    expect(within(properties).getByLabelText('X')).toHaveValue('756');
    expect(within(properties).getByLabelText('Y')).toHaveValue('756');
    expect(screen.queryByTestId('element-drop-ghost')).not.toBeInTheDocument();
  });

  it('drops an icon payload at the pointer too', async () => {
    const { user } = renderEditor();
    const { icons } = await openElements(user);

    const transfer = fakeDataTransfer();
    fireEvent.dragStart(within(icons).getByRole('option', { name: 'Insert heart' }), {
      dataTransfer: transfer,
    });
    expect(parseElementDragPayload(transfer.getData(ELEMENT_DRAG_MIME))).toEqual({
      kind: 'icon',
      iconId: 'heart',
    });

    const stage = screen.getByTestId('canvas-stage');
    fireEvent.dragOver(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });
    fireEvent.drop(stage, { dataTransfer: transfer, clientX: 2000, clientY: 2000 });

    const properties = propertiesPanel();
    expect(within(properties).getByRole('heading', { level: 2, name: 'Icon' })).toBeInTheDocument();
    expect(within(properties).getByLabelText('X')).toHaveValue('864');
    expect(within(properties).getByLabelText('Y')).toHaveValue('864');
  });

  it('previews a drag while the browser hides the payload mid-gesture', async () => {
    const { user } = renderEditor();
    const { shapes } = await openElements(user);
    const rectangle = within(shapes).getByRole('button', { name: 'Rectangle' });

    fireEvent.dragStart(rectangle, { dataTransfer: fakeDataTransfer() });
    // Chrome exposes only the type list during `dragover`; the value arrives with the drop.
    const opaque = fakeDataTransfer();
    opaque.setData(ELEMENT_DRAG_MIME, '');
    const stage = screen.getByTestId('canvas-stage');
    fireEvent.dragOver(stage, { dataTransfer: opaque, clientX: 100, clientY: 100 });
    expect(screen.getByTestId('element-drop-ghost')).toBeInTheDocument();

    fireEvent.dragEnd(rectangle);
    fireEvent.dragOver(stage, { dataTransfer: opaque, clientX: 100, clientY: 100 });
    expect(screen.queryByTestId('element-drop-ghost')).not.toBeInTheDocument();
  });

  it('rejects payloads that would not survive the document schema', () => {
    expect(parseElementDragPayload('')).toBeNull();
    expect(parseElementDragPayload('not json')).toBeNull();
    expect(parseElementDragPayload('{"kind":"shape","shape":"pentagon"}')).toBeNull();
    expect(parseElementDragPayload('{"kind":"icon","iconId":"Heart"}')).toBeNull();
    expect(parseElementDragPayload('{"kind":"icon","iconId":"heart"}')).toEqual({
      kind: 'icon',
      iconId: 'heart',
    });
  });
});
