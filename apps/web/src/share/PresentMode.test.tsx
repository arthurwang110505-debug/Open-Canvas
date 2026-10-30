import {
  createBlankDocument,
  createPage,
  createRectElement,
  solidFill,
  type DesignDocument,
} from '@opencanvas/document';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PresentMode } from './PresentMode';

function twoPageDocument(): DesignDocument {
  const document = createBlankDocument({ id: 'doc_present', name: 'Deck' });
  document.pages[0]?.elements.push(
    createRectElement({ id: 'a', width: 200, height: 200, fill: solidFill('#ff0000') }),
  );
  const second = createPage({ id: 'page_2' });
  second.elements.push(
    createRectElement({ id: 'b', width: 200, height: 200, fill: solidFill('#0000ff') }),
  );
  document.pages.push(second);
  return document;
}

describe('present mode', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('animates page changes with the chosen transition and remembers it', async () => {
    const user = userEvent.setup();
    const { container } = render(<PresentMode document={twoPageDocument()} onClose={vi.fn()} />);

    expect(await screen.findByText('Deck — 1 / 2')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Slide' }));
    expect(localStorage.getItem('opencanvas:present-transition')).toBe('slide');
    expect(screen.getByRole('radio', { name: 'Slide' })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('Deck — 2 / 2')).toBeInTheDocument();
    expect(container.querySelector('[class*="animate-present-next"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('Deck — 1 / 2')).toBeInTheDocument();
    expect(container.querySelector('[class*="animate-present-prev"]')).not.toBeNull();
  });

  it('can turn transitions off', async () => {
    const user = userEvent.setup();
    const { container } = render(<PresentMode document={twoPageDocument()} onClose={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: 'None' }));
    await user.click(screen.getByRole('button', { name: 'Next page' }));

    expect(await screen.findByText('Deck — 2 / 2')).toBeInTheDocument();
    expect(container.querySelector('[class*="animate-present-"]')).toBeNull();
  });
});
