import { createBlankDocument, type DesignElement } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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

async function insertRectangle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Rectangle' }));
  return screen.getByRole('complementary', { name: 'Properties' });
}

describe('EditorPage', () => {
  it('renders the editor chrome with an empty page state', () => {
    renderEditor();
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Test design');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Shapes' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/Nothing on the page yet/)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No unsaved changes');
    expect(screen.getByLabelText('Design canvas')).toBeInTheDocument();
  });

  it('inserts a rectangle, selects it and shows its properties', async () => {
    const { user } = renderEditor();
    const panel = await insertRectangle(user);
    expect(within(panel).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();
    // 30% of a 1080 square, centered.
    expect(within(panel).getByLabelText('Width')).toHaveValue('324');
    expect(within(panel).getByLabelText('X')).toHaveValue('378');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
    expect(screen.getByRole('status')).toHaveTextContent('Unsaved changes');
  });

  it('commits numeric edits from the properties panel and supports undo/redo', async () => {
    const { user } = renderEditor();
    const panel = await insertRectangle(user);
    const xField = within(panel).getByLabelText('X');
    await user.clear(xField);
    await user.type(xField, '100{Enter}');
    expect(xField).toHaveValue('100');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(panel).getByLabelText('X')).toHaveValue('378');
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(within(panel).getByLabelText('X')).toHaveValue('100');
  });

  it('rejects out-of-range values instead of corrupting the document', async () => {
    const { user } = renderEditor();
    const panel = await insertRectangle(user);
    const opacity = within(panel).getByLabelText('Opacity');
    await user.clear(opacity);
    await user.type(opacity, '250{Enter}');
    // Clamped by the field to the allowed maximum.
    expect(opacity).toHaveValue('100');
  });

  it('deletes the selection with the keyboard and clears the panel', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);
    await user.keyboard('{Delete}');
    expect(screen.getByText(/Nothing on the page yet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByText(/Nothing on the page yet/)).toBeInTheDocument();
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(screen.getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();
  });

  it('duplicates and nudges elements with shortcuts', async () => {
    const { user } = renderEditor();
    const panel = await insertRectangle(user);
    await user.keyboard('{Control>}d{/Control}');
    expect(within(panel).getByLabelText('X')).toHaveValue('398');
    await user.keyboard('{ArrowLeft}');
    expect(within(panel).getByLabelText('X')).toHaveValue('397');
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(within(panel).getByLabelText('Y')).toHaveValue('408');
  });

  it('renames the design from the title field', async () => {
    const { user } = renderEditor();
    const title = screen.getByRole('textbox', { name: 'Design name' });
    await user.clear(title);
    await user.type(title, 'Launch poster{Enter}');
    expect(title).toHaveValue('Launch poster');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('does not keep an empty name', async () => {
    const { user } = renderEditor();
    const title = screen.getByRole('textbox', { name: 'Design name' });
    await user.clear(title);
    await user.tab();
    expect(title).toHaveValue('Test design');
  });

  it('changes the page background from the sidebar', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('tab', { name: 'Background' }));
    await user.click(screen.getByRole('option', { name: 'Background #0f172a' }));
    expect(screen.getByRole('option', { name: 'Background #0f172a' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('inserts editable text with the chosen preset', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('tab', { name: 'Text' }));
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    const panel = screen.getByRole('complementary', { name: 'Properties' });
    expect(within(panel).getByRole('heading', { name: 'Text' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a heading');
    expect(within(panel).getByLabelText('Size')).toHaveValue('96');
    expect(within(panel).getByLabelText('Weight')).toHaveValue('800');
  });

  it('reorders layers through the arrange controls', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);
    await user.click(screen.getByRole('button', { name: 'Ellipse' }));
    // Ellipse is now on top and selected; send it to the back.
    await user.click(screen.getByRole('button', { name: 'Send to back' }));
    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('heading', { name: '2 elements selected' })).toBeInTheDocument();
  });

  it('changes the canvas size through presets', async () => {
    const { user } = renderEditor();
    const panel = screen.getByRole('complementary', { name: 'Properties' });
    await user.selectOptions(within(panel).getByLabelText('Preset'), 'youtube-thumbnail');
    expect(within(panel).getByLabelText('Width')).toHaveValue('1280');
    expect(within(panel).getByLabelText('Height')).toHaveValue('720');
  });

  it('exposes zoom controls once the canvas is mounted', async () => {
    const { user } = renderEditor();
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' });
    expect(zoomIn).toBeEnabled();
    const before = screen.getByRole('button', { name: /Zoom level/ }).textContent;
    await user.click(zoomIn);
    const after = screen.getByRole('button', { name: /Zoom level/ }).textContent;
    expect(after).not.toBe(before);
  });
});

// Type-level guard: the panel must know every element type the schema defines.
const _exhaustive: Record<DesignElement['type'], true> = {
  rect: true,
  ellipse: true,
  text: true,
  image: true,
  path: true,
  group: true,
};
void _exhaustive;
