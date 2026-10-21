import { createBlankDocument, createIconElement, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc = document ?? createBlankDocument({ id: 'doc_icons', name: 'Icons', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

async function openIconsTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: 'Icons' }));
  return screen.getByRole('listbox', { name: 'Icons' });
}

describe('icons', () => {
  it('inserts an icon from the panel and selects it', async () => {
    const { user } = renderEditor();
    const list = await openIconsTab(user);

    await user.click(within(list).getByRole('option', { name: 'Insert heart' }));

    const properties = screen.getByRole('complementary', { name: 'Properties' });
    // "Icon" labels both the element type heading and the properties section.
    expect(within(properties).getByRole('heading', { level: 2, name: 'Icon' })).toBeInTheDocument();
    expect(within(properties).getByText('heart')).toBeInTheDocument();
    // 20% of a 1080 square, centred.
    expect(within(properties).getByLabelText('Width')).toHaveValue('216');
    expect(within(properties).getByLabelText('X')).toHaveValue('432');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });

  it('searches by keyword and narrows by category', async () => {
    const { user } = renderEditor();
    const list = await openIconsTab(user);

    await user.type(screen.getByRole('searchbox', { name: 'Search icons' }), 'money');
    expect(within(list).getByRole('option', { name: 'Insert wallet' })).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: 'Insert heart' })).not.toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: 'Search icons' }));
    await user.click(screen.getByRole('button', { name: 'Food' }));
    expect(within(list).getByRole('option', { name: 'Insert pizza' })).toBeInTheDocument();
    expect(within(list).queryByRole('option', { name: 'Insert heart' })).not.toBeInTheDocument();
  });

  it('recolours and replaces a selected icon', async () => {
    const document = createBlankDocument({ id: 'doc_icons', name: 'Icons', now: fixedDate });
    document.pages[0]?.elements.push(
      createIconElement({ id: 'icon_1', x: 100, y: 100, iconId: 'heart', width: 120, height: 120 }),
    );
    const { user } = renderEditor(document);

    // Selecting on the Fabric canvas needs a pointer, so pick the layer like a user with a
    // stacked page would.
    await user.click(screen.getByRole('tab', { name: 'Layers' }));
    const layers = screen.getByRole('listbox', { name: 'Layers' });
    await user.click(within(layers).getByRole('option', { name: 'Heart' }));
    const properties = screen.getByRole('complementary', { name: 'Properties' });

    const color = within(properties).getByLabelText('Color');
    await user.clear(color);
    await user.type(color, '#ef4444{Enter}');
    expect(color).toHaveValue('#ef4444');

    await user.click(within(properties).getByRole('button', { name: 'Replace' }));
    const picker = within(properties).getByRole('listbox', { name: 'Icons' });
    await user.click(within(picker).getByRole('option', { name: 'Insert star' }));
    expect(within(properties).getByText('star')).toBeInTheDocument();
    // The picker closes again so the panel is not left in replace mode.
    expect(within(properties).queryByRole('listbox', { name: 'Icons' })).not.toBeInTheDocument();
  });

  it('undoes an icon insertion as one step', async () => {
    const { user } = renderEditor();
    const list = await openIconsTab(user);
    await user.click(within(list).getByRole('option', { name: 'Insert star' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(/Nothing on the page yet/)).toBeInTheDocument();
  });
});
