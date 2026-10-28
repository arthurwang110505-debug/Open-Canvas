import { createBlankDocument, createRectElement } from '@opencanvas/document';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareDialog } from './ShareDialog';

const fixedDate = new Date('2026-05-06T07:08:09.000Z');

function design() {
  const document = createBlankDocument({ id: 'doc_share', name: 'Share me', now: fixedDate });
  document.pages[0]?.elements.push(createRectElement({ id: 'r1' }));
  return document;
}

function renderDialog(onPresent = vi.fn()) {
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(<ShareDialog document={design()} onClose={onClose} onPresent={onPresent} />);
  return { user, onPresent, onClose };
}

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('ShareDialog', () => {
  it('describes a view link as local to this browser instead of promising public access', () => {
    renderDialog();
    expect(screen.queryByText(/Anyone with the link/i)).not.toBeInTheDocument();
    expect(screen.getByText(/stored in this browser/i)).toBeInTheDocument();
    expect(screen.getByText(/View links do not travel between devices/i)).toBeInTheDocument();
    expect(screen.getByText(/Download/)).toBeInTheDocument();
  });

  it('creates a real view link and stores it for the share viewer', async () => {
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Create view link' }));

    const input = await screen.findByLabelText('Share link');
    const url = (input as HTMLInputElement).value;
    expect(url).toContain('#/share/shr_');
    expect(screen.getByText(/works in this browser and its tabs/i)).toBeInTheDocument();
    const shareId = url.split('#/share/')[1];
    expect(shareId).toBeTruthy();
    const stored = window.localStorage.getItem(`opencanvas:share:${shareId}`);
    expect(stored).toContain('"schemaVersion"');
  });

  it('reports storage failure instead of offering a link that cannot open', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is full', 'QuotaExceededError');
    });
    const { user } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Create view link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not save a view link.*download or export/i,
    );
    expect(screen.queryByLabelText('Share link')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create view link' })).toBeEnabled();
  });

  it('leaves presenting to the editor', async () => {
    const { user, onPresent } = renderDialog();
    await user.click(screen.getByRole('button', { name: /Present fullscreen/i }));
    expect(onPresent).toHaveBeenCalledTimes(1);
  });
});
