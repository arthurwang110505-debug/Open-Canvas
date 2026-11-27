import { createBlankDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { DISMISS_DISTANCE, DISMISS_VELOCITY, sheetOffset, shouldDismiss } from './useSheetDismiss';
import { activateSidebarTab } from './testHelpers';

type User = ReturnType<typeof userEvent.setup>;

function renderEditor() {
  const document = createBlankDocument({
    id: 'doc_undo',
    name: 'Undo design',
    now: new Date('2026-01-02T03:04:05.000Z'),
  });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={document} />
    </TooltipProvider>,
  );
  return { user };
}

async function addRectangle(user: User) {
  await activateSidebarTab(user, 'Elements');
  await user.click(screen.getByRole('button', { name: 'Rectangle' }));
}

/** Fabric does not run in jsdom, so selection goes through the Layers list. */
async function selectLayer(user: User, index: number) {
  await activateSidebarTab(user, 'Layers');
  const layers = screen.getByRole('listbox', { name: 'Layers' });
  const options = within(layers).getAllByRole('option');
  await user.click(options[index]!);
}

const layerCount = () => {
  const layers = screen.queryByRole('listbox', { name: 'Layers' });
  return layers ? within(layers).queryAllByRole('option').length : 0;
};

describe('telling the user a delete can be taken back', () => {
  it('names what went and offers the way back', async () => {
    const { user } = renderEditor();
    await addRectangle(user);
    await selectLayer(user, 0);
    expect(layerCount()).toBe(1);

    await user.keyboard('{Delete}');

    const toast = await screen.findByRole('status', { name: 'Object deleted' });
    expect(toast).toHaveTextContent('You can put it back.');
    expect(layerCount()).toBe(0);

    await user.click(within(toast).getByRole('button', { name: 'Undo delete' }));
    expect(layerCount()).toBe(1);
  });

  it('counts the objects rather than saying something vague', async () => {
    const { user } = renderEditor();
    await addRectangle(user);
    await addRectangle(user);
    await activateSidebarTab(user, 'Layers');
    await user.keyboard('{Control>}a{/Control}');

    await user.keyboard('{Delete}');

    expect(await screen.findByRole('status', { name: '2 objects deleted' })).toBeInTheDocument();
  });

  it('closes itself once the offer has been taken', async () => {
    const { user } = renderEditor();
    await addRectangle(user);
    await selectLayer(user, 0);
    await user.keyboard('{Delete}');

    const toast = await screen.findByRole('status', { name: 'Object deleted' });
    await user.click(within(toast).getByRole('button', { name: 'Undo delete' }));
    expect(screen.queryByRole('status', { name: 'Object deleted' })).not.toBeInTheDocument();
  });

  it('can be dismissed without undoing', async () => {
    const { user } = renderEditor();
    await addRectangle(user);
    await selectLayer(user, 0);
    await user.keyboard('{Delete}');

    const toast = await screen.findByRole('status', { name: 'Object deleted' });
    await user.click(within(toast).getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByRole('status', { name: 'Object deleted' })).not.toBeInTheDocument();
    expect(layerCount()).toBe(0);
  });

  it('says nothing when there was nothing to delete', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Layers');
    await user.keyboard('{Delete}');
    expect(screen.queryByRole('status', { name: /deleted/i })).not.toBeInTheDocument();
  });
});

describe('swiping a bottom sheet away', () => {
  it('follows a downward finger one-for-one', () => {
    expect(sheetOffset(400, 400)).toBe(0);
    expect(sheetOffset(400, 460)).toBe(60);
    expect(sheetOffset(400, 520)).toBe(120);
  });

  it('resists an upward drag instead of ignoring it', () => {
    // Some movement, so the gesture feels heard, but far less than the finger travelled.
    const offset = sheetOffset(400, 300);
    expect(offset).toBeLessThan(0);
    expect(offset).toBeGreaterThan(-100);
  });

  it('closes on a long drag', () => {
    const from = { y: 400, at: 0 };
    const to = { y: 400 + DISMISS_DISTANCE, at: 1000 };
    expect(shouldDismiss(DISMISS_DISTANCE, from, to)).toBe(true);
  });

  it('stays open on a short, slow drag', () => {
    const from = { y: 400, at: 0 };
    const to = { y: 430, at: 1000 };
    expect(shouldDismiss(30, from, to)).toBe(false);
  });

  it('closes on a short flick, because speed is intent too', () => {
    const from = { y: 400, at: 0 };
    const to = { y: 440, at: 40 };
    expect((to.y - from.y) / (to.at - from.at)).toBeGreaterThan(DISMISS_VELOCITY);
    expect(shouldDismiss(40, from, to)).toBe(true);
  });

  it('ignores a flick that barely moved, which is a tap', () => {
    const from = { y: 400, at: 0 };
    const to = { y: 405, at: 8 };
    expect(shouldDismiss(5, from, to)).toBe(false);
  });

  it('never dismisses on an upward flick', () => {
    const from = { y: 400, at: 0 };
    const to = { y: 300, at: 40 };
    expect(shouldDismiss(sheetOffset(400, 300), from, to)).toBe(false);
  });
});
