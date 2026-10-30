import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TemplateGallery } from './TemplateGallery';
import { TEMPLATES } from './catalog';
import { templateColorMoods, templateOrientation } from './templateMetadata';

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
    await user.click(
      within(cards[0]!).getByRole('button', { name: 'Use template: Everyday Tote' }),
    );
    expect(onUse).toHaveBeenCalledWith('everyday-tote');
  });

  it('clears a template keyword without disturbing the discovery controls', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} />);
    const search = screen.getByRole('searchbox', { name: 'Search templates' });
    await user.type(search, 'tote');
    expect(screen.getAllByTestId('template-card')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Clear template search' }));

    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
    expect(screen.getAllByTestId('template-card')).toHaveLength(TEMPLATES.length);
    expect(screen.getByRole('combobox', { name: 'Template orientation' })).toHaveValue('all');
  });

  it('offers a clear way out of an empty result', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search templates' }), 'zzzz');
    expect(screen.getByText(/No templates match/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getAllByTestId('template-card')).toHaveLength(TEMPLATES.length);
  });

  it('filters templates by orientation and palette color mood', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Template orientation' }),
      'portrait',
    );
    const portraitCount = TEMPLATES.filter(
      (template) => templateOrientation(template.build()) === 'portrait',
    ).length;
    expect(screen.getAllByTestId('template-card')).toHaveLength(portraitCount);

    await user.selectOptions(screen.getByRole('combobox', { name: 'Template color' }), 'warm');
    const warmCount = TEMPLATES.filter((template) =>
      templateColorMoods(template.build()).includes('warm'),
    ).filter((template) => templateOrientation(template.build()) === 'portrait').length;
    expect(screen.getAllByTestId('template-card')).toHaveLength(warmCount);
    expect(screen.getByRole('button', { name: 'Clear refinements' })).toBeInTheDocument();
  });

  it('opens a preview instead of using the template when preview is enabled', async () => {
    const user = userEvent.setup();
    const onUse = vi.fn();
    const onPreview = vi.fn();
    const template = TEMPLATES[0];
    if (!template) throw new Error('Expected a template');
    render(<TemplateGallery onUse={onUse} onPreview={onPreview} />);

    await user.click(screen.getByRole('button', { name: `Preview ${template.label} template` }));
    expect(onPreview).toHaveBeenCalledWith(template.id);
    expect(onUse).not.toHaveBeenCalled();
  });

  it('shows a curated home row without mounting the full library', () => {
    render(<TemplateGallery onUse={() => undefined} variant="home" maxItems={6} />);
    expect(screen.getAllByTestId('template-card')).toHaveLength(6);
    expect(screen.queryByRole('searchbox', { name: 'Search templates' })).not.toBeInTheDocument();
  });

  it('pages the compact sidebar browser instead of mounting sixty cards', async () => {
    const user = userEvent.setup();
    render(<TemplateGallery onUse={() => undefined} variant="panel" />);

    expect(screen.getAllByTestId('template-card').length).toBeLessThanOrEqual(18);
    await user.click(screen.getByRole('button', { name: /Show 18 more of 60/ }));
    expect(screen.getAllByTestId('template-card').length).toBeGreaterThan(18);
  });
});
