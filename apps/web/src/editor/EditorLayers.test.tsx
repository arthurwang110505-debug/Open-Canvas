import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EditorPage } from './EditorPage';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');

function renderEditor() {
  const document = createBlankDocument({ id: 'doc_test', name: 'Test design', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} />
    </TooltipProvider>,
  );
  return { user };
}

type User = ReturnType<typeof userEvent.setup>;

const properties = () => screen.getByRole('complementary', { name: 'Properties' });

async function insert(user: User, what: 'Rectangle' | 'Ellipse' | 'Add a heading') {
  const tab = what === 'Add a heading' ? 'Text' : 'Shapes';
  await user.click(screen.getByRole('tab', { name: tab }));
  await user.click(screen.getByRole('button', { name: what }));
}

async function openLayers(user: User) {
  await user.click(screen.getByRole('tab', { name: 'Layers' }));
  return screen.getByRole('listbox', { name: 'Layers' });
}

function layerNames(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole('option')
    .map((option) => option.getAttribute('aria-label') ?? '');
}

async function setField(user: User, label: string, value: string) {
  const field = within(properties()).getByLabelText(label);
  await user.clear(field);
  await user.type(field, `${value}{Enter}`);
}

function fieldValue(label: string): string {
  const field = within(properties()).getByLabelText(label);
  return field instanceof HTMLInputElement ? field.value : '';
}

/** Minimal DataTransfer stand-in: jsdom has none and the panel only writes to it. */
const dataTransfer = () => ({
  setData: vi.fn(),
  effectAllowed: 'none',
  dropEffect: 'none',
});

describe('Layers panel', () => {
  it('lists elements top-most first with derived names', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await insert(user, 'Ellipse');
    await insert(user, 'Add a heading');
    const list = await openLayers(user);
    expect(layerNames(list)).toEqual(['Add a heading', 'Ellipse', 'Rectangle']);
    expect(screen.getByText(/3 elements\./)).toBeInTheDocument();
  });

  it('selects with click, Ctrl-click and Shift-click', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await insert(user, 'Ellipse');
    await insert(user, 'Add a heading');
    const list = await openLayers(user);

    await user.click(within(list).getByRole('option', { name: 'Rectangle' }));
    expect(within(properties()).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();
    expect(within(list).getByRole('option', { name: 'Rectangle' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(list).getByRole('option', { name: 'Ellipse' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    // Shift-click selects the range from the anchor (Rectangle) up to the heading.
    await user.keyboard('{Shift>}');
    await user.click(within(list).getByRole('option', { name: 'Add a heading' }));
    await user.keyboard('{/Shift}');
    expect(screen.getByRole('heading', { name: '3 elements selected' })).toBeInTheDocument();

    // A plain click resets the selection and the anchor; Ctrl-click toggles membership.
    await user.click(within(list).getByRole('option', { name: 'Ellipse' }));
    expect(within(properties()).getByRole('heading', { name: 'Ellipse' })).toBeInTheDocument();
    await user.keyboard('{Control>}');
    await user.click(within(list).getByRole('option', { name: 'Rectangle' }));
    await user.keyboard('{/Control}');
    expect(screen.getByRole('heading', { name: '2 elements selected' })).toBeInTheDocument();
    await user.keyboard('{Control>}');
    await user.click(within(list).getByRole('option', { name: 'Rectangle' }));
    await user.keyboard('{/Control}');
    expect(within(properties()).getByRole('heading', { name: 'Ellipse' })).toBeInTheDocument();
  });

  it('renames an element inline and the rename is undoable', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    const list = await openLayers(user);

    await user.dblClick(within(list).getByRole('option', { name: 'Rectangle' }));
    const input = screen.getByRole('textbox', { name: 'Rename Rectangle' });
    await user.clear(input);
    await user.type(input, 'Hero box{Enter}');

    expect(within(list).getByRole('option', { name: 'Hero box' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Rename/ })).not.toBeInTheDocument();
    expect(within(properties()).getByText('Hero box')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(list).getByRole('option', { name: 'Rectangle' })).toBeInTheDocument();

    // Escape discards the draft.
    await user.dblClick(within(list).getByRole('option', { name: 'Rectangle' }));
    await user.type(screen.getByRole('textbox', { name: 'Rename Rectangle' }), 'Nope{Escape}');
    expect(within(list).getByRole('option', { name: 'Rectangle' })).toBeInTheDocument();
  });

  it('toggles visibility and lock per element without changing the selection', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await insert(user, 'Ellipse');
    const list = await openLayers(user);

    await user.click(within(list).getByRole('button', { name: 'Hide Rectangle' }));
    expect(within(list).getByRole('button', { name: 'Show Rectangle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // The ellipse stays selected; the toggle acts on the row, not on the selection.
    expect(within(properties()).getByRole('heading', { name: 'Ellipse' })).toBeInTheDocument();

    await user.click(within(list).getByRole('button', { name: 'Lock Rectangle' }));
    expect(within(list).getByRole('button', { name: 'Unlock Rectangle' })).toBeInTheDocument();

    await user.click(within(list).getByRole('option', { name: 'Rectangle' }));
    expect(within(properties()).getByRole('button', { name: 'Unlock' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(properties()).getByRole('button', { name: 'Show' })).toBeInTheDocument();
  });

  it('reorders elements by drag and drop', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await insert(user, 'Ellipse');
    await insert(user, 'Add a heading');
    const list = await openLayers(user);
    expect(layerNames(list)).toEqual(['Add a heading', 'Ellipse', 'Rectangle']);

    // Drag the rectangle above the heading (rows have a 0px box in jsdom, so any negative
    // clientY counts as the upper half).
    const transfer = dataTransfer();
    fireEvent.dragStart(within(list).getByRole('option', { name: 'Rectangle' }), {
      dataTransfer: transfer,
    });
    const heading = within(list).getByRole('option', { name: 'Add a heading' });
    fireEvent.dragOver(heading, { dataTransfer: transfer, clientY: -1 });
    fireEvent.drop(heading, { dataTransfer: transfer, clientY: -1 });
    expect(layerNames(list)).toEqual(['Rectangle', 'Add a heading', 'Ellipse']);

    // Drop the heading below the ellipse (lower half of the row).
    fireEvent.dragStart(within(list).getByRole('option', { name: 'Add a heading' }), {
      dataTransfer: transfer,
    });
    const ellipse = within(list).getByRole('option', { name: 'Ellipse' });
    fireEvent.dragOver(ellipse, { dataTransfer: transfer, clientY: 1 });
    fireEvent.drop(ellipse, { dataTransfer: transfer, clientY: 1 });
    expect(layerNames(list)).toEqual(['Rectangle', 'Ellipse', 'Add a heading']);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(layerNames(list)).toEqual(['Rectangle', 'Add a heading', 'Ellipse']);
  });

  it('reorders the selection with bracket shortcuts', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await insert(user, 'Ellipse');
    await insert(user, 'Add a heading');
    const list = await openLayers(user);
    await user.click(within(list).getByRole('option', { name: 'Rectangle' }));

    await user.keyboard('{Control>}[BracketRight]{/Control}');
    expect(layerNames(list)).toEqual(['Add a heading', 'Rectangle', 'Ellipse']);
    await user.keyboard('{Control>}{Shift>}[BracketRight]{/Shift}{/Control}');
    expect(layerNames(list)).toEqual(['Rectangle', 'Add a heading', 'Ellipse']);
    await user.keyboard('{Control>}[BracketLeft]{/Control}');
    expect(layerNames(list)).toEqual(['Add a heading', 'Rectangle', 'Ellipse']);
    await user.keyboard('{Control>}{Shift>}[BracketLeft]{/Shift}{/Control}');
    expect(layerNames(list)).toEqual(['Add a heading', 'Ellipse', 'Rectangle']);
  });
});

describe('Align and distribute', () => {
  it('aligns a single element to the page', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    // 324 wide on a 1080 page, inserted centred at x=378.
    expect(fieldValue('X')).toBe('378');
    await user.click(within(properties()).getByRole('button', { name: 'Align left' }));
    expect(fieldValue('X')).toBe('0');
    await user.click(within(properties()).getByRole('button', { name: 'Align right' }));
    expect(fieldValue('X')).toBe('756');
    await user.click(within(properties()).getByRole('button', { name: 'Align bottom' }));
    expect(fieldValue('Y')).toBe('756');
    await user.click(
      within(properties()).getByRole('button', { name: 'Align horizontal centers' }),
    );
    expect(fieldValue('X')).toBe('378');
    expect(
      within(properties()).getByRole('button', { name: 'Distribute horizontally' }),
    ).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(fieldValue('X')).toBe('756');
  });

  it('aligns several elements to the selection box and distributes three', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await setField(user, 'X', '0');
    await insert(user, 'Ellipse');
    await setField(user, 'X', '400');
    await insert(user, 'Rectangle');
    await setField(user, 'X', '756');

    await user.keyboard('{Escape}');
    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('heading', { name: '3 elements selected' })).toBeInTheDocument();

    // Equal gaps: boxes of width 324 at 0 and 756 leave the middle one at 378.
    await user.click(within(properties()).getByRole('button', { name: 'Distribute horizontally' }));
    const list = await openLayers(user);
    await user.click(within(list).getByRole('option', { name: 'Ellipse' }));
    expect(fieldValue('X')).toBe('378');

    await user.keyboard('{Control>}a{/Control}');
    await user.click(within(properties()).getByRole('button', { name: 'Align right' }));
    await user.click(within(list).getByRole('option', { name: 'Ellipse' }));
    expect(fieldValue('X')).toBe('756');
  });

  it('skips locked elements when aligning', async () => {
    const { user } = renderEditor();
    await insert(user, 'Rectangle');
    await setField(user, 'X', '100');
    await user.click(within(properties()).getByRole('button', { name: 'Lock' }));
    await user.click(within(properties()).getByRole('button', { name: 'Align left' }));
    expect(fieldValue('X')).toBe('100');
  });
});
