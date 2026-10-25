import { createBlankDocument, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc =
    document ?? createBlankDocument({ id: 'doc_templates', name: 'Templates', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

async function useTemplate(user: ReturnType<typeof userEvent.setup>, name: string, pick: string) {
  await activateSidebarTab(user, 'Design');
  await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), name);
  await user.click(screen.getByRole('button', { name: `Use ${pick} template` }));
}

describe('applying generated templates', () => {
  it('fills the page and leaves it editable as layers', async () => {
    const { user } = renderEditor();
    await useTemplate(user, 'Design Week', 'Design Week');

    expect(screen.queryByText('Start your design')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    // The poster's vector pieces arrive as ordinary elements, icons included.
    await activateSidebarTab(user, 'Layers');
    const layers = screen.getByRole('listbox', { name: 'Layers' });
    expect(within(layers).getAllByRole('option').length).toBeGreaterThanOrEqual(4);

    await user.click(within(layers).getAllByRole('option')[0]!);
    expect(openPropertiesPanel()).toBeInTheDocument();
  });

  it('replaces the page in one undo step', async () => {
    const { user } = renderEditor();
    await useTemplate(user, 'Everyday Tote', 'Everyday Tote');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText('Start your design')).toBeInTheDocument();
  });

  it('adds a generated design as a second page when asked', async () => {
    const { user } = renderEditor();
    await user.click(screen.getByRole('checkbox', { name: /Add as a new page/i }));
    await activateSidebarTab(user, 'Design');
    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'Noise Fest');
    await user.click(screen.getByRole('button', { name: 'Use Noise Fest template' }));

    expect(screen.getByRole('button', { name: /Go to page 2 \(current\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Go to page 1/ })).toBeInTheDocument();
  });

  it('keeps the template catalogue searchable below the fold', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Design');

    // The sidebar pages the catalogue; the rest is one button away.
    expect(screen.getByRole('button', { name: /Show 18 more of 60/ })).toBeInTheDocument();
    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'live build');
    expect(screen.getByRole('button', { name: 'Use Live Build template' })).toBeInTheDocument();
  });
});
