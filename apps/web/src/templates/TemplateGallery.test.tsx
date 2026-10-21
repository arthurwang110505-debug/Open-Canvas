import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TemplateGallery } from './TemplateGallery';
import { TEMPLATES } from './catalog';

describe('template gallery', () => {
  it('shows the whole catalogue with a live count', () => {
    render(<TemplateGallery onUse={() => undefined} />);
    expect(screen.getByText(String(TEMPLATES.length))).toBeInTheDocument();
    expect(screen.getAllByTestId('template-card')).toHaveLength(TEMPLATES.length);
  });

  it('narrows by category and says which chip is on', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} />);
    const presentations = screen.getByRole('button', { name: 'Presentations' });

    await user.click(presentations);

    expect(presentations).toHaveAttribute('aria-pressed', 'true');
    const cards = screen.getAllByTestId('template-card');
    expect(cards.length).toBe(TEMPLATES.filter((tpl) => tpl.category === 'presentation').length);
    expect(cards.length).toBeLessThan(TEMPLATES.length);
  });

  it('searches by label, description and tags, then opens the design', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    render(<TemplateGallery onUse={onUse} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'tote');
    const cards = screen.getAllByTestId('template-card');
    expect(cards).toHaveLength(1);
    await user.click(within(cards[0]!).getByRole('button', { name: /Use .* template/ }));
    expect(onUse).toHaveBeenCalledWith('everyday-tote');
  });

  it('offers a clear way out of an empty result', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'zzzz');
    expect(screen.getByText(/No templates match/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByTestId('template-card')).toHaveLength(TEMPLATES.length);
  });

  it('pages the compact sidebar browser instead of mounting sixty cards', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} variant="panel" />);

    expect(screen.getAllByTestId('template-card').length).toBeLessThanOrEqual(18);
    await user.click(screen.getByRole('button', { name: /Show 18 more of 60/ }));
    expect(screen.getAllByTestId('template-card').length).toBeGreaterThan(18);
  });
});
