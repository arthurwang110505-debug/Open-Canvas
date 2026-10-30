import { CANVAS_PRESETS, validateDocument } from '@opencanvas/document';
import { renderPageToSvg, type TextMeasurer, wrapTextLines } from '@opencanvas/export';
import { getIcon } from '@opencanvas/icons';
import { describe, expect, it } from 'vitest';

import { getBlueprint } from './blueprints';
import { TEMPLATES, categoryLabel, getTemplate } from './catalog';
import { INSTANCES } from './instances';
import { SIGNATURE_TEMPLATES } from './signature';

const PRESETS = new Set(CANVAS_PRESETS.map((preset) => preset.id));

describe('the template catalogue', () => {
  it('ships 60 designs from two sources and no duplicate ids', () => {
    expect(TEMPLATES).toHaveLength(60);
    expect(SIGNATURE_TEMPLATES.length + INSTANCES.length).toBe(60);
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(60);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('has something in every gallery category', () => {
    const counts = new Map<string, number>();
    for (const template of TEMPLATES) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
    }
    for (const category of ['social', 'presentation', 'print', 'video', 'business'] as const) {
      expect(counts.get(category) ?? 0, category).toBeGreaterThanOrEqual(8);
    }
    expect(categoryLabel('all')).toBe('All');
  });

  it('points every design at a preset and a blueprint that exist', () => {
    for (const template of TEMPLATES) {
      expect(PRESETS.has(template.presetId), template.id).toBe(true);
    }
    for (const instance of INSTANCES) {
      expect(getBlueprint(instance.blueprint), instance.id).toBeDefined();
    }
    expect(INSTANCES.map((instance) => instance.blueprint).length).toBeGreaterThan(0);
  });

  it('builds a schema-valid document for every design', () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const result = validateDocument(document);
      expect(result.ok, `${template.id}: ${result.ok ? '' : result.error.message}`).toBe(true);
      expect(document.metadata.templateId).toBe(template.id);
      expect(document.metadata.source).toBe('template');
      expect(document.pages[0]?.elements.length ?? 0).toBeGreaterThanOrEqual(4);
    }
  });

  it('keeps text and icons inside the page and the icon catalogue', () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const { width } = document.size;
      for (const element of document.pages[0]?.elements ?? []) {
        if (element.type === 'text') {
          expect(element.x, template.id).toBeGreaterThanOrEqual(0);
          expect(element.x + element.width, template.id).toBeLessThanOrEqual(width + 1);
          expect(element.y, template.id).toBeGreaterThanOrEqual(0);
          expect(element.fontSize, template.id).toBeGreaterThan(0);
        }
        if (element.type === 'icon') {
          expect(getIcon(element.iconId), `${template.id}: ${element.iconId}`).toBeDefined();
          expect(element.width).toBe(element.height);
        }
      }
    }
  });

  it('keeps generated text boxes from landing on each other', () => {
    for (const instance of INSTANCES) {
      const template = getTemplate(instance.id);
      const document = template?.build();
      const texts = (document?.pages[0]?.elements ?? []).filter(
        (element) => element.type === 'text',
      );
      for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i]!;
          const b = texts[j]!;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (overlapX <= 8 || overlapY <= 8) continue;
          const share = overlapY / Math.min(a.height, b.height);
          expect(share, `${instance.id}: "${a.text}" over "${b.text}"`).toBeLessThan(0.2);
        }
      }
    }
  });

  it('keeps the repaired signature headlines clear of their supporting text', () => {
    // A deliberately generous half-em advance catches the original fixed-height collisions
    // without depending on a platform's font rasterizer in the unit-test environment.
    const measure: TextMeasurer = (text, style) => text.length * style.fontSize * 0.5;
    for (const id of ['instagram-minimal', 'story-gradient', 'presentation-title']) {
      const template = TEMPLATES.find((candidate) => candidate.id === id);
      const document = template?.build();
      expect(document, id).toBeDefined();
      const texts = (document?.pages[0]?.elements ?? [])
        .filter((element) => element.type === 'text')
        .map((element) => {
          const lines = wrapTextLines(element, measure);
          return {
            ...element,
            bottom: element.y + element.fontSize * (element.lineHeight * (lines.length - 1) + 1.13),
          };
        });
      for (let i = 0; i < texts.length; i += 1)
        for (let j = i + 1; j < texts.length; j += 1) {
          const a = texts[i]!;
          const b = texts[j]!;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
          expect(overlapX <= 4 || overlapY <= 4, `${id}: ${a.text} / ${b.text}`).toBe(true);
        }
    }
  });

  it('uses a condensed display face for the long Launch Week headline', () => {
    const document = getTemplate('launch-week')?.build();
    const headline = document?.pages[0]?.elements.find(
      (element) => element.type === 'text' && element.text.includes('workspace'),
    );
    expect(headline?.type).toBe('text');
    if (headline?.type !== 'text') return;
    expect(headline.fontFamily).toBe('Oswald');
    // The browser font audit measured 416px against this 454px box; the old face was 508px.
    expect(headline.width).toBeGreaterThanOrEqual(440);
  });

  it('uses gradient backgrounds where the design calls for one', async () => {
    const gradientTemplates = INSTANCES.filter((instance) => instance.background !== undefined);
    expect(gradientTemplates.length).toBeGreaterThanOrEqual(3);

    const slow = getTemplate('slow-mornings')?.build();
    expect(slow?.pages[0]?.background.type).toBe('linear');
    // The gradient is a real fill, so it reaches the exported file as vector data.
    const nested = await renderPageToSvg(slow!);
    expect(nested.ok).toBe(true);
    if (nested.ok) expect(nested.value).toContain('<linearGradient');
  });

  it('renders every design to a vector file with no broken numbers', async () => {
    for (const template of TEMPLATES) {
      const document = template.build();
      const result = await renderPageToSvg(document);
      expect(result.ok, `${template.id}: ${result.ok ? '' : result.error.message}`).toBe(true);
      if (!result.ok) continue;
      expect(result.value, template.id).not.toContain('NaN');
      const shapes = result.value.match(/<(rect|ellipse|path|circle|line|text|g)\b/g) ?? [];
      expect(shapes.length, template.id).toBeGreaterThan(3);
    }
  });

  it('looks the same twice: builds are deterministic apart from element ids', () => {
    const template = getTemplate('flash-sale');
    expect(template).toBeDefined();
    const first = template?.build();
    const second = template?.build();
    const strip = (document: typeof first) =>
      document?.pages[0]?.elements.map((element) => ({
        type: element.type,
        x: element.x,
        y: element.y,
        width: element.width,
        height: element.height,
      }));
    expect(strip(first)).toEqual(strip(second));
    expect(first?.size).toEqual(second?.size);
  });

  it('finds a design by id', () => {
    expect(getTemplate('studio-opening')?.label).toBe('Studio Opening');
    expect(getTemplate('nope')).toBeUndefined();
  });
});
