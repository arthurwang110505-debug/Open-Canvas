import { describe, expect, it } from 'vitest';

import { ICON_ENTRIES, ICON_FAMILIES, ICON_IDS, getIcon, searchIcons, shapeToSvg } from './index';
import { ICON_VIEWBOX } from './types';

describe('the icon catalogue', () => {
  it('ships a broad, unique set', () => {
    expect(ICON_ENTRIES.length).toBeGreaterThanOrEqual(200);
    expect(new Set(ICON_IDS).size).toBe(ICON_ENTRIES.length);
  });

  it('uses ids that are safe inside a document and a filename-free lookup', () => {
    for (const id of ICON_IDS) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(id.length).toBeLessThanOrEqual(64);
    }
  });

  it('belongs to a declared family and is searchable by keyword', () => {
    const families = new Set(ICON_FAMILIES.map((family) => family.id));
    for (const entry of ICON_ENTRIES) {
      expect(families.has(entry.family)).toBe(true);
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.shapes.length).toBeGreaterThan(0);
    }
  });

  it('only contains shapes and attributes both renderers understand', () => {
    const tags = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polyline', 'polygon']);
    for (const entry of ICON_ENTRIES) {
      for (const [tag, attributes] of entry.shapes) {
        expect(tags.has(tag)).toBe(true);
        expect(Object.keys(attributes)).not.toContain('key');
        expect(Object.keys(attributes).length).toBeGreaterThan(0);
      }
    }
  });

  it('draws inside the 24×24 grid the renderers scale from', () => {
    expect(ICON_VIEWBOX).toBe(24);
    // Sampling the coordinate-bearing attributes catches copy/paste mistakes in the generator.
    const coordinate = (value: string | undefined) => Number.parseFloat(value ?? '0');
    for (const entry of ICON_ENTRIES) {
      for (const [, attributes] of entry.shapes) {
        for (const key of ['cx', 'cy', 'x', 'y', 'x1', 'x2', 'y1', 'y2']) {
          const raw = attributes[key];
          if (raw === undefined) continue;
          expect(coordinate(raw)).toBeGreaterThanOrEqual(-1);
          expect(coordinate(raw)).toBeLessThanOrEqual(25);
        }
      }
    }
  });
});

describe('getIcon', () => {
  it('resolves a known id and rejects an unknown one', () => {
    expect(getIcon('heart')?.family).toBe('essentials');
    expect(getIcon('not-a-real-icon')).toBeUndefined();
  });

  it('resolves aliases to real geometry', () => {
    // Lucide renamed `home` to `house`; documents written with the old name keep working.
    expect(getIcon('home')?.shapes.length).toBe(2);
  });
});

describe('searchIcons', () => {
  it('returns everything for an empty query', () => {
    expect(searchIcons('  ')).toHaveLength(ICON_ENTRIES.length);
  });

  it('ranks an exact name above a keyword match', () => {
    const [first] = searchIcons('heart');
    expect(first?.id).toBe('heart');
  });

  it('matches synonyms and keeps the order deterministic', () => {
    const results = searchIcons('money');
    expect(results.map((entry) => entry.id)).toContain('wallet');
    expect(searchIcons('money').map((entry) => entry.id)).toEqual(results.map((entry) => entry.id));
  });

  it('returns nothing when a term matches nothing', () => {
    expect(searchIcons('heart zzzz')).toEqual([]);
  });
});

describe('shapeToSvg', () => {
  it('serialises a leaf shape with its attributes', () => {
    expect(shapeToSvg(['circle', { cx: '12', cy: '12', r: '10' }])).toBe(
      '<circle cx="12" cy="12" r="10"/>',
    );
  });

  it('escapes attribute values so a quote cannot close the attribute', () => {
    expect(shapeToSvg(['path', { d: 'M0 0" onload="x' }])).toBe(
      '<path d="M0 0&quot; onload=&quot;x"/>',
    );
  });
});
