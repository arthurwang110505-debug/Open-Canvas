import {
  createBlankDocument,
  createRectElement,
  parseDocument,
  type DesignDocument,
} from '@opencanvas/document';
import { renderPageToSvg } from '@opencanvas/export';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import {
  buildTableElements,
  buildTableGroup,
  DEFAULT_TABLE_DATA,
  parseTableStyle,
  regenerateTableGroup,
} from './elements/tables';

const fixedDate = new Date('2026-11-20T09:30:00.000Z');

/** Selects the page's only element through the Layers list (Fabric does not run in jsdom). */
async function selectOnlyLayer(user: ReturnType<typeof userEvent.setup>) {
  await activateSidebarTab(user, 'Layers');
  const layers = screen.getByRole('listbox', { name: 'Layers' });
  const [first] = within(layers).getAllByRole('option');
  if (!first) throw new Error('expected one layer');
  await user.click(first);
}

function documentWithRect(): DesignDocument {
  const doc = createBlankDocument({ id: 'doc_anim', name: 'Animate', now: fixedDate });
  doc.pages[0]!.elements.push(
    createRectElement({ x: 100, y: 100, width: 300, height: 200, name: 'Card' }),
  );
  return doc;
}

describe('element entrance animations (Sprint 9)', () => {
  it('accepts an animation on any element and keeps it optional', () => {
    const doc = documentWithRect();
    const rect = doc.pages[0]!.elements[0]!;
    expect(rect.animation).toBeUndefined();

    rect.animation = { type: 'rise', duration: 0.8, delay: 0.2 };
    const parsed = parseDocument(doc);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.document.pages[0]!.elements[0]!.animation).toEqual({
        type: 'rise',
        duration: 0.8,
        delay: 0.2,
      });
    }
  });

  it('rejects an animation type the player cannot draw', () => {
    const doc = documentWithRect();
    (doc.pages[0]!.elements[0] as { animation?: unknown }).animation = { type: 'explode' };
    expect(parseDocument(doc).ok).toBe(false);
  });

  it('tags animated elements only when the caller asks for playback', async () => {
    const doc = documentWithRect();
    doc.pages[0]!.elements[0]!.animation = { type: 'pop', duration: 0.9, delay: 0.3 };

    const still = await renderPageToSvg(doc);
    expect(still.ok).toBe(true);
    if (still.ok) {
      // A downloaded file is a still image: no playback hints travel with it.
      expect(still.value).not.toContain('data-animate');
    }

    const playable = await renderPageToSvg(doc, { animations: true });
    expect(playable.ok).toBe(true);
    if (playable.ok) {
      expect(playable.value).toContain('data-animate="pop"');
      expect(playable.value).toContain('--element-animate-duration:0.9s');
      expect(playable.value).toContain('--element-animate-delay:0.3s');
    }
  });

  it('leaves untouched elements free of playback attributes', async () => {
    const doc = documentWithRect();
    const result = await renderPageToSvg(doc, { animations: true });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).not.toContain('data-animate');
  });

  it('sets an entrance from the Properties panel and clears it again', async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <EditorPage document={documentWithRect()} />
      </TooltipProvider>,
    );

    await selectOnlyLayer(user);
    const properties = openPropertiesPanel();
    const select = within(properties).getByLabelText('Entrance');
    expect(select).toHaveValue('none');
    // Duration and delay only make sense once an entrance exists.
    expect(within(properties).queryByLabelText('Duration')).not.toBeInTheDocument();

    await user.selectOptions(select, 'rise');
    expect(within(properties).getByLabelText('Entrance')).toHaveValue('rise');
    expect(within(properties).getByLabelText('Duration')).toHaveValue('0.6');
    expect(
      within(properties).getByText(/Plays in Present mode and in a shared link/),
    ).toBeInTheDocument();

    await user.selectOptions(within(properties).getByLabelText('Entrance'), 'none');
    expect(within(properties).getByLabelText('Entrance')).toHaveValue('none');
    expect(within(properties).queryByLabelText('Duration')).not.toBeInTheDocument();
  });
});

describe('table styles (Sprint 9)', () => {
  it('defaults to a header row and no banding', () => {
    const group = buildTableGroup({ width: 1080, height: 1080 });
    const style = parseTableStyle(group);
    expect(style).toEqual({ accent: '#f3f4f6', header: true, banded: false });
  });

  it('paints a header, bands alternate rows, and reads both back', () => {
    const group = buildTableGroup({ width: 1080, height: 1080 });
    const styled = regenerateTableGroup(group, DEFAULT_TABLE_DATA, {
      accent: '#1d4ed8',
      header: true,
      banded: true,
    });
    const style = parseTableStyle(styled);
    expect(style.accent).toBe('#1d4ed8');
    expect(style.header).toBe(true);
    expect(style.banded).toBe(true);

    // Banded rows are a lighter wash of the accent, not the accent itself.
    const fills = styled.children
      .filter((child) => child.type === 'rect')
      .map((child) => (child.fill.type === 'solid' ? child.fill.color : ''))
      .filter((color) => color !== '');
    expect(fills).toContain('#1d4ed8');
    expect(fills.some((color) => color !== '#1d4ed8' && color !== '#ffffff')).toBe(true);
  });

  it('drops the header tint when the header is turned off', () => {
    const group = buildTableGroup({ width: 1080, height: 1080 });
    const plain = regenerateTableGroup(group, DEFAULT_TABLE_DATA, {
      accent: '#f3f4f6',
      header: false,
      banded: false,
    });
    expect(parseTableStyle(plain)).toMatchObject({ header: false, banded: false });
    const texts = plain.children.filter((child) => child.type === 'text');
    expect(texts.every((text) => text.fontWeight === 400)).toBe(true);
  });

  it('keeps every cell inside the table box whatever the style', () => {
    for (const banded of [false, true]) {
      const elements = buildTableElements(DEFAULT_TABLE_DATA, { x: 0, y: 0 }, 600, 320, {
        accent: '#0ea5a4',
        header: true,
        banded,
      });
      for (const element of elements) {
        expect(element.x).toBeGreaterThanOrEqual(0);
        expect(element.y).toBeGreaterThanOrEqual(0);
        expect(element.x + element.width).toBeLessThanOrEqual(601);
        expect(element.y + element.height).toBeLessThanOrEqual(321);
      }
    }
  });

  it('changes a table style from the Properties panel as one undo step', async () => {
    const doc = createBlankDocument({ id: 'doc_table', name: 'Table', now: fixedDate });
    doc.pages[0]!.elements.push(buildTableGroup(doc.size));
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <EditorPage document={doc} />
      </TooltipProvider>,
    );

    await selectOnlyLayer(user);
    let properties = openPropertiesPanel();
    const banded = within(properties).getByLabelText('Banded rows');
    expect(banded).not.toBeChecked();

    await user.click(banded);
    properties = openPropertiesPanel();
    expect(within(properties).getByLabelText('Banded rows')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    properties = openPropertiesPanel();
    expect(within(properties).getByLabelText('Banded rows')).not.toBeChecked();
  });
});
