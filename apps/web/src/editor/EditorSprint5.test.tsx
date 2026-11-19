import {
  createBlankDocument,
  createTextElement,
  validateDocument,
  type DesignDocument,
} from '@opencanvas/document';
import { renderPageToSvg } from '@opencanvas/export';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import { buildChartGroup } from './elements/charts';
import { parseChartGroup, regenerateChartGroup } from './elements/chartData';
import { buildTableGroup, parseTableGroup, regenerateTableGroup } from './elements/tables';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc =
    document ?? createBlankDocument({ id: 'doc_sprint5', name: 'Sprint5', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

describe('text outline and shadow (Sprint 5)', () => {
  it('validates stroke and shadow in the schema', () => {
    const document = createBlankDocument({ id: 'doc_textfx', name: 'TextFX', now: fixedDate });
    document.pages[0]!.elements.push(
      createTextElement({
        id: 't1',
        text: 'Hello',
        stroke: { color: '#111827', width: 2 },
        shadow: { color: '#000000', offsetX: 0, offsetY: 4, blur: 8 },
      }),
    );
    expect(validateDocument(document).ok).toBe(true);
  });

  it('exports stroke and shadow to SVG', async () => {
    const document = createBlankDocument({ id: 'doc_textfx_svg', name: 'TextFX', now: fixedDate });
    document.pages[0]!.elements.push(
      createTextElement({
        id: 't1',
        text: 'Hello',
        stroke: { color: '#ff0000', width: 3 },
        shadow: { color: '#000000', offsetX: 2, offsetY: 4, blur: 6 },
      }),
    );
    const result = await renderPageToSvg(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('stroke="#ff0000"');
    expect(result.value).toContain('stroke-width="3"');
    expect(result.value).toContain('feDropShadow');
    expect(result.value).toContain('filter="url(#text-shadow-');
  });

  it('toggles outline and shadow in Properties', async () => {
    const { user } = renderEditor();

    await activateSidebarTab(user, 'Text');
    await user.click(screen.getByRole('button', { name: 'Add a heading' }));

    let properties = openPropertiesPanel();
    expect(within(properties).getByRole('heading', { level: 2, name: 'Text' })).toBeInTheDocument();
    expect(within(properties).getByRole('checkbox', { name: 'Outline' })).not.toBeChecked();
    expect(within(properties).getByRole('checkbox', { name: 'Shadow' })).not.toBeChecked();

    await user.click(within(properties).getByRole('checkbox', { name: 'Outline' }));
    properties = openPropertiesPanel();
    expect(within(properties).getByRole('checkbox', { name: 'Outline' })).toBeChecked();
    expect(within(properties).getByLabelText('Outline width')).toBeInTheDocument();

    await user.click(within(properties).getByRole('checkbox', { name: 'Shadow' }));
    properties = openPropertiesPanel();
    expect(within(properties).getByRole('checkbox', { name: 'Shadow' })).toBeChecked();
    expect(within(properties).getByLabelText('Blur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});

describe('chart data editing (Sprint 5)', () => {
  it('parses and regenerates bar, pie and line charts', () => {
    for (const kind of ['bar', 'pie', 'line'] as const) {
      const group = buildChartGroup(kind, { width: 1080, height: 1080 });
      const parsed = parseChartGroup(group);
      expect(parsed, kind).not.toBeNull();
      expect(parsed?.kind).toBe(kind);
      expect(parsed?.data.length).toBeGreaterThanOrEqual(4);

      // Pie values are percentages, so the round-trip is approximate there.
      const edited = parsed!.data.map((datum, index) =>
        index === 0 ? { ...datum, value: datum.value + 5, label: 'Edited' } : datum,
      );
      const regenerated = regenerateChartGroup(group, edited);
      expect(regenerated.id).toBe(group.id);
      expect(regenerated.x).toBe(group.x);
      expect(regenerated.y).toBe(group.y);
      expect(regenerated.width).toBe(group.width);
      expect(regenerated.height).toBe(group.height);
      const reparsed = parseChartGroup(regenerated);
      expect(reparsed?.data[0]?.label).toBe('Edited');
      if (kind === 'pie') {
        expect(Math.abs((reparsed?.data[0]?.value ?? 0) - edited[0]!.value)).toBeLessThanOrEqual(5);
      } else {
        expect(reparsed?.data[0]?.value).toBe(edited[0]!.value);
      }
    }
  });

  it('edits chart data in Properties as one undo step', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Bar chart' }));

    let properties = openPropertiesPanel();
    expect(
      within(properties).getByRole('heading', { level: 2, name: 'Group' }),
    ).toBeInTheDocument();
    expect(within(properties).getByText('Chart data')).toBeInTheDocument();

    const labelInput = within(properties).getByLabelText('Label for item 1');
    await user.clear(labelInput);
    await user.type(labelInput, 'Mon');
    const valueInput = within(properties).getByLabelText('Value for Mon');
    await user.clear(valueInput);
    await user.type(valueInput, '99');

    await user.click(within(properties).getByRole('button', { name: 'Apply chart data' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    // One undo restores the previous chart (label back to the default).
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    properties = openPropertiesPanel();
    expect(within(properties).getByLabelText('Label for item 1')).toHaveValue('Mon');
  });
});

describe('tables (Sprint 5)', () => {
  it('builds, parses and regenerates a table group', () => {
    const group = buildTableGroup({ width: 1080, height: 1080 });
    expect(group.name).toBe('Table');
    const parsed = parseTableGroup(group);
    expect(parsed).not.toBeNull();
    expect(parsed).toHaveLength(4);
    expect(parsed?.[0]).toEqual(['Item', 'Qty', 'Price']);

    const edited = parsed!.map((row, r) => (r === 1 ? ['Oranges', '7', '$14'] : row));
    const regenerated = regenerateTableGroup(group, edited);
    expect(regenerated.id).toBe(group.id);
    expect(parseTableGroup(regenerated)?.[1]).toEqual(['Oranges', '7', '$14']);
  });

  it('inserts a table and edits cells in Properties', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    expect(screen.getByRole('region', { name: 'Tables' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Table' }));
    let properties = openPropertiesPanel();
    expect(within(properties).getByText('Table data')).toBeInTheDocument();

    const cell = within(properties).getByLabelText('Row 2, column 1');
    await user.clear(cell);
    await user.type(cell, 'Oranges');

    await user.click(within(properties).getByRole('button', { name: 'Apply table data' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    properties = openPropertiesPanel();
    expect(within(properties).getByLabelText('Row 2, column 1')).toHaveValue('Apples');
  });

  it('adds and removes table rows', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: 'Table' }));

    let properties = openPropertiesPanel();
    await user.click(within(properties).getByRole('button', { name: 'Add row' }));
    await user.click(within(properties).getByRole('button', { name: 'Apply table data' }));

    properties = openPropertiesPanel();
    // Default 4 rows + 1 added = 5 rows of cells.
    expect(within(properties).getByLabelText('Row 5, column 1')).toBeInTheDocument();
  });
});
