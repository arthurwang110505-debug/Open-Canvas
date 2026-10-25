import { createBlankDocument, type DesignElement } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPagePropertiesPanel, openPropertiesPanel } from './testHelpers';

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
  await activateSidebarTab(user, 'Elements');
  await user.click(screen.getByRole('button', { name: 'Rectangle' }));
  return openPropertiesPanel();
}

describe('EditorPage', () => {
  it('renders the editor chrome with an empty page state', async () => {
    const { user } = renderEditor();
    expect(screen.getByRole('textbox', { name: 'Design name' })).toHaveValue('Test design');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Redo' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('toolbar', { name: 'Contextual toolbar' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Properties' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No unsaved changes');
    expect(screen.getByLabelText('Design canvas')).toBeInTheDocument();
    await activateSidebarTab(user, 'Page');
    expect(within(openPagePropertiesPanel()).getByText(/Nothing on the page yet/)).toBeInTheDocument();
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
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);
    await user.keyboard('{Control>}z{/Control}');
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
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
    await activateSidebarTab(user, 'Background');
    await user.click(screen.getByRole('option', { name: 'Background #0f172a' }));
    expect(screen.getByRole('option', { name: 'Background #0f172a' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('inserts editable text with the chosen preset', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    const panel = openPropertiesPanel();
    expect(within(panel).getByRole('heading', { name: 'Text' })).toBeInTheDocument();
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a heading');
    expect(within(panel).getByLabelText('Size')).toHaveValue('96');
    expect(within(panel).getByLabelText('Weight')).toHaveValue('800');
  });

  it('offers the bundled families and previews the chosen font', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    const panel = openPropertiesPanel();
    const font = within(panel).getByLabelText('Font');

    // Bundled families are grouped, and only weights the family ships are offered.
    expect(within(font).getByRole('group', { name: 'Serif' })).toBeInTheDocument();
    await user.selectOptions(font, 'Playfair Display');
    expect(font).toHaveValue('Playfair Display');
    expect(within(panel).getByTestId('font-specimen')).toHaveStyle({
      fontFamily: '"Playfair Display"',
    });

    // Playfair Display starts at 400, so 800 is not a real weight for it.
    const weight = within(panel).getByLabelText<HTMLSelectElement>('Weight');
    expect([...weight.options].map((option) => option.value)).toEqual([
      '400',
      '500',
      '600',
      '700',
      '800',
      '900',
    ]);
  });

  it('toggles bulleted and numbered lists without changing the text', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    const panel = openPropertiesPanel();
    const bullets = within(panel).getByRole('button', { name: 'Bulleted list' });
    const numbers = within(panel).getByRole('button', { name: 'Numbered list' });

    expect(bullets).toHaveAttribute('aria-pressed', 'false');
    await user.click(bullets);
    expect(bullets).toHaveAttribute('aria-pressed', 'true');
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a heading');
    await user.click(numbers);
    expect(bullets).toHaveAttribute('aria-pressed', 'false');
    expect(numbers).toHaveAttribute('aria-pressed', 'true');
    await user.click(numbers);
    expect(numbers).toHaveAttribute('aria-pressed', 'false');
  });

  it('inserts a text style preset with its size, tracking and casing baked in', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a label' }));
    const panel = openPropertiesPanel();
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a label');
    expect(within(panel).getByLabelText('Size')).toHaveValue('22');
    expect(within(panel).getByLabelText('Letter spacing')).toHaveValue('4');
    expect(within(panel).getByLabelText('Casing')).toHaveValue('uppercase');
  });

  it('inserts a font pairing as one undoable step', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add Editorial pairing' }));
    const panel = openPropertiesPanel();
    // The heading is selected so it can be edited straight away.
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a heading');
    expect(within(panel).getByLabelText('Font')).toHaveValue('Playfair Display');
    expect(within(panel).getByLabelText('Weight')).toHaveValue('700');

    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('heading', { name: '2 elements selected' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Nothing selected')).toBeInTheDocument();
  });

  it('changes display casing without rewriting the text', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));
    const panel = openPropertiesPanel();
    const casing = within(panel).getByLabelText('Casing');

    expect(casing).toHaveValue('none');
    await user.selectOptions(casing, 'uppercase');
    expect(casing).toHaveValue('uppercase');
    // Display-only: the content field keeps the wording the author typed.
    expect(within(panel).getByLabelText('Content')).toHaveValue('Add a heading');

    // Rapid changes share one undo step.
    await user.selectOptions(casing, 'capitalize');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(panel).getByLabelText('Casing')).toHaveValue('none');
  });

  it('reorders layers through the arrange controls', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Ellipse' }));
    // Ellipse is now on top and selected; send it to the back from its edit drawer.
    const panel = openPropertiesPanel();
    await user.click(within(panel).getByRole('button', { name: 'Send to back' }));
    await user.keyboard('{Control>}a{/Control}');
    expect(screen.getByRole('heading', { name: '2 elements selected' })).toBeInTheDocument();
  });

  it('changes the canvas size through the page settings drawer', async () => {
    const { user } = renderEditor();
    const panel = openPagePropertiesPanel();
    await user.selectOptions(within(panel).getByLabelText('Preset'), 'youtube-thumbnail');
    expect(within(panel).getByLabelText('Width')).toHaveValue('1280');
    expect(within(panel).getByLabelText('Height')).toHaveValue('720');
  });

  it('applies a template to the current page in one undoable step', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('button', { name: 'Use Pastel Summer Sale template' }));

    expect(screen.queryByText('Start your design')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Start your design')).toBeInTheDocument();
  });

  it('can insert a template as a new page instead of replacing the current one', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('checkbox', { name: /Add as a new page/i }));
    await user.click(screen.getByRole('button', { name: 'Use Pastel Summer Sale template' }));

    expect(screen.getByRole('button', { name: /Go to page 2 \(current\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to page 1/ })).toBeInTheDocument();
  });

  it('offers a starting point on an empty page and gets out of the way after the first insert', async () => {
    const { user } = renderEditor();
    expect(screen.getByText('Start your design')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add a shape' }));

    expect(screen.queryByText('Start your design')).not.toBeInTheDocument();
    const panel = openPropertiesPanel();
    expect(within(panel).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('opens a zoom menu with presets in the workspace corner', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('button', { name: /Zoom level/ }));
    await user.click(screen.getByRole('menuitem', { name: '200%' }));
    expect(screen.getByRole('button', { name: /Zoom level/ })).toHaveTextContent('200%');
  });

  it('keeps the selection toolbar available after inserting an element', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Ellipse' }));
    const selectionToolbar = screen.getByRole('toolbar', { name: 'Selection actions' });
    expect(selectionToolbar).toBeInTheDocument();
    expect(within(selectionToolbar).getByRole('button', { name: 'Duplicate selection' })).toBeEnabled();
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
  icon: true,
  path: true,
  frame: true,
  group: true,
};
void _exhaustive;
