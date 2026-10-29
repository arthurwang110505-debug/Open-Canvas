import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { stubMatchMedia } from '../test/mockMatchMedia';
import { EditorPage } from './EditorPage';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');
let restoreMatchMedia: (() => void) | undefined;

function renderMobileEditor() {
  restoreMatchMedia = stubMatchMedia((query) => query.includes('max-width'));
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage
        document={createBlankDocument({ id: 'doc_responsive', name: 'Responsive', now: fixedDate })}
      />
    </TooltipProvider>,
  );
  return { user };
}

afterEach(() => {
  restoreMatchMedia?.();
  restoreMatchMedia = undefined;
});

describe('responsive editor', () => {
  it('uses a horizontal mobile tool rail and dismissible panel sheet', async () => {
    const { user } = renderMobileEditor();
    expect(screen.getByRole('tablist', { name: 'Editor panels' })).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-expanded', 'false');

    await user.click(screen.getByRole('tab', { name: 'Elements' }));
    expect(await screen.findByRole('tabpanel', { name: 'Elements' })).toBeVisible();
    expect(screen.getByRole('searchbox', { name: 'Search elements' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Text' }));
    expect(await screen.findByRole('tabpanel', { name: 'Text' })).toBeVisible();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('tabpanel')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Text' })).toHaveFocus());
  });

  it('opens selection properties from the contextual toolbar on a phone', async () => {
    const { user } = renderMobileEditor();
    await user.click(screen.getByRole('tab', { name: 'Elements' }));
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));
    await user.click(screen.getByRole('button', { name: 'Close panel' }));

    const toolbar = screen.getByRole('toolbar', { name: 'Contextual toolbar' });
    await user.click(within(toolbar).getByRole('button', { name: 'Open selection properties' }));

    const panel = await screen.findByRole('tabpanel', { name: 'Properties' });
    expect(panel).toBeVisible();
    expect(within(panel).getByRole('complementary', { name: 'Properties' })).toBeVisible();
    expect(screen.getByRole('tab', { name: 'Properties' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps page settings and snapping reachable from compact header overflow', async () => {
    const { user } = renderMobileEditor();

    await user.click(screen.getByRole('button', { name: 'More editor actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Page size & settings' }));
    expect(
      await screen.findByRole('complementary', { name: 'Page properties' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close panel' }));
    await user.click(screen.getByRole('button', { name: 'More editor actions' }));
    await user.click(screen.getByRole('menuitem', { name: /Snap to objects/ }));
    expect(screen.getByRole('button', { name: 'Snap to objects' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('replaces the phone filmstrip with compact access to the full page grid', async () => {
    const { user } = renderMobileEditor();
    const pages = screen.getByRole('button', { name: 'View all pages. Page 1 of 1' });
    expect(
      screen.queryByRole('button', { name: 'Go to page 1 (current)' }),
    ).not.toBeInTheDocument();

    await user.click(pages);
    const grid = await screen.findByRole('dialog', { name: 'All pages' });
    await user.click(within(grid).getByRole('button', { name: 'Add page' }));
    expect(within(grid).getByText('2 pages in this design')).toBeInTheDocument();

    await user.click(within(grid).getByRole('button', { name: 'Close page grid' }));
    expect(
      screen.getByRole('button', { name: /View all pages\. Page [12] of 2/ }),
    ).toBeInTheDocument();
  });
});
