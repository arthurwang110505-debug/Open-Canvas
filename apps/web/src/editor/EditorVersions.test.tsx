import { createBlankDocument, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc =
    document ?? createBlankDocument({ id: 'doc_versions_ui', name: 'Versions', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

async function insertRectangle(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Elements');
  await user.click(screen.getByRole('button', { name: 'Rectangle' }));
}

async function openHistory(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Open history' }));
  return screen.getByRole('dialog', { name: 'History' });
}

describe('saved versions (Sprint 6)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves a named version and restores it as one undo step', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);

    let dialog = await openHistory(user);
    await user.type(within(dialog).getByLabelText('Version name'), 'Before launch');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Before launch')).toBeInTheDocument();
    expect(localStorage.getItem('opencanvas:versions:doc_versions_ui')).toContain('Before launch');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    // Delete the rectangle, then restore the version to bring it back.
    await user.keyboard('{Delete}');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    dialog = await openHistory(user);
    await user.click(within(dialog).getByRole('button', { name: 'Restore' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    // The rectangle is back on the page (restore leaves nothing selected, so select all).
    await user.keyboard('{Control>}a{/Control}');
    const properties = openPropertiesPanel();
    expect(within(properties).getByRole('heading', { name: 'Rectangle' })).toBeInTheDocument();

    // Restoring is itself undoable: one Undo removes the rectangle again.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await user.keyboard('{Control>}a{/Control}');
    expect(
      within(openPropertiesPanel()).getByRole('heading', { name: 'Nothing selected' }),
    ).toBeInTheDocument();
  });

  it('requires a name and deletes versions', async () => {
    const { user } = renderEditor();
    await insertRectangle(user);

    const dialog = await openHistory(user);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Give this version a name first.');

    await user.type(within(dialog).getByLabelText('Version name'), 'Draft');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Draft')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete version Draft' }));
    expect(within(dialog).queryByText('Draft')).not.toBeInTheDocument();
    expect(localStorage.getItem('opencanvas:versions:doc_versions_ui')).toBe('[]');
  });
});
