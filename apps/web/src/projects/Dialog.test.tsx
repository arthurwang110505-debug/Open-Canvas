import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Dialog } from '@opencanvas/ui';

describe('Dialog', () => {
  it('contains keyboard focus, makes the background inert, and restores focus on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const view = render(
      <main>
        <button>Open dialog</button>
      </main>,
    );
    const trigger = screen.getByRole('button', { name: 'Open dialog' });
    trigger.focus();
    view.rerender(
      <>
        <main>
          <button>Open dialog</button>
        </main>
        <Dialog labelledBy="dialog-title" onClose={onClose}>
          <h2 id="dialog-title">Accessible dialog</h2>
          <button>First</button>
          <button>Last</button>
        </Dialog>
      </>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Accessible dialog' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());
    expect(document.querySelector('main')?.closest('[inert]')).not.toBeNull();
    expect(document.body).toHaveStyle({ overflow: 'hidden' });
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    view.rerender(
      <main>
        <button>Open dialog</button>
      </main>,
    );
    expect(document.querySelector('main')?.closest('[inert]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
    expect(dialog.isConnected).toBe(false);
  });

  it('dismisses only when the backdrop itself is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog labelledBy="title" onClose={onClose}>
        <h2 id="title">Backdrop</h2>
        <button>Inside</button>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Inside' }));
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('presentation'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
