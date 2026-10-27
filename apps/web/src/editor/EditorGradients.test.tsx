import { createBlankDocument, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import type { ExportServices } from './export/ExportServices';

const fixedDate = new Date('2026-10-22T10:00:00.000Z');

function renderEditor(document?: DesignDocument) {
  const downloads: { blob: Blob; filename: string }[] = [];
  const doc =
    document ?? createBlankDocument({ id: 'doc_gradient', name: 'Gradient', now: fixedDate });
  const user = userEvent.setup();
  const services: Partial<ExportServices> = {
    download: (blob, filename) => downloads.push({ blob, filename }),
  };
  render(
    <TooltipProvider>
      <EditorPage document={doc} exportServices={services} />
    </TooltipProvider>,
  );
  return { user, downloads };
}

async function openBackground(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Background');
}

describe('gradient backgrounds', () => {
  it('applies a preset and shows its angle', async () => {
    const { user } = renderEditor();
    await openBackground(user);

    const presets = screen.getByRole('group', { name: 'Gradient presets' });
    await user.click(within(presets).getByRole('button', { name: 'Gradient Sunrise' }));

    expect(within(presets).getByRole('button', { name: 'Gradient Sunrise' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Sunrise runs at 160°; the field appears only once a linear gradient is applied.
    expect(screen.getByLabelText('Angle')).toHaveValue('160');
    // No solid swatch claims to be selected anymore.
    const colors = screen.getByRole('listbox', { name: 'Background colors' });
    const selected = within(colors)
      .getAllByRole('option')
      .filter((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(0);
  });

  it('turns a linear gradient in one undoable step', async () => {
    const { user } = renderEditor();
    await openBackground(user);
    await user.click(
      within(screen.getByRole('group', { name: 'Gradient presets' })).getByRole('button', {
        name: 'Gradient Ocean',
      }),
    );

    const angle = screen.getByLabelText('Angle');
    await user.clear(angle);
    await user.type(angle, '45{Enter}');
    expect(angle).toHaveValue('45');

    // Rapid angle edits coalesce, so the whole nudge is one history step.
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByLabelText('Angle')).toHaveValue('165');
  });

  it('does not offer an angle for a radial gradient', async () => {
    const { user } = renderEditor();
    await openBackground(user);

    await user.click(
      within(screen.getByRole('group', { name: 'Gradient presets' })).getByRole('button', {
        name: 'Gradient Glow',
      }),
    );
    expect(screen.queryByLabelText('Angle')).not.toBeInTheDocument();
  });

  it('exports the gradient as a vector definition, not a flat colour', async () => {
    const { user, downloads } = renderEditor();
    await openBackground(user);
    await user.click(
      within(screen.getByRole('group', { name: 'Gradient presets' })).getByRole('button', {
        name: 'Gradient Aurora',
      }),
    );

    await user.click(screen.getByRole('button', { name: 'Download' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export SVG' }));

    const svg = await downloads[0]?.blob.text();
    expect(svg).toContain('<defs>');
    expect(svg).toContain('<linearGradient');
    expect(svg).toContain('stop-color="#22d3ee"');
    expect(svg).toContain('<rect width="1080" height="1080" fill="url(#grad-1)"/>');
  });
});

describe('gradient shape fills', () => {
  it('fills a rectangle with a gradient and can go back to a solid colour', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Rectangle' }));

    const properties = openPropertiesPanel();
    await user.click(within(properties).getByRole('button', { name: 'Gradient' }));
    await user.click(within(properties).getByRole('button', { name: 'Gradient Mint' }));

    expect(within(properties).getByLabelText('Fill (gradient)')).toBeInTheDocument();
    expect(within(properties).getByLabelText('Angle')).toHaveValue('150');

    // A solid colour always wins back the label, so the panel never lies about the fill.
    await user.clear(within(properties).getByLabelText('Fill (gradient)'));
    await user.type(within(properties).getByLabelText('Fill (gradient)'), '#112233{Enter}');
    expect(within(properties).getByLabelText('Fill')).toHaveValue('#112233');
  });
});
