import {
  CANVAS_PRESETS,
  HexColorSchema,
  IdSchema,
  LIMITS,
  validateDocument,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import {
  CATEGORY_LABELS,
  createDocumentFromTemplate,
  findTemplate,
  getTemplate,
  instantiateTemplate,
  TEMPLATES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_FONT_FAMILIES,
  templatesByCategory,
  type TemplateDefinition,
} from './index';

const now = new Date('2026-07-08T09:10:11.000Z');

function isHex(value: string): boolean {
  return HexColorSchema.safeParse(value).success;
}

function isId(value: string): boolean {
  return IdSchema.safeParse(value).success;
}

describe('the template registry', () => {
  it('ships at least the twelve templates the roadmap promises', () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it('has unique, well-formed ids and non-empty copy', () => {
    const ids = TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const template of TEMPLATES) {
      expect(template.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(template.name.trim().length).toBeGreaterThan(0);
      expect(template.description.trim().length).toBeGreaterThan(0);
      expect(template.name.length).toBeLessThanOrEqual(LIMITS.maxNameLength);
    }
  });

  it('covers every declared category and labels it', () => {
    for (const category of TEMPLATE_CATEGORIES) {
      expect(templatesByCategory(category).length).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[category].length).toBeGreaterThan(0);
    }
    for (const template of TEMPLATES) {
      expect(TEMPLATE_CATEGORIES).toContain(template.category);
      expect(templatesByCategory(template.category)).toContain(template);
    }
  });

  it('uses canvas sizes inside the model limits and matching presets', () => {
    for (const template of TEMPLATES) {
      expect(template.width).toBeGreaterThanOrEqual(LIMITS.minCanvasDimension);
      expect(template.width).toBeLessThanOrEqual(LIMITS.maxCanvasDimension);
      expect(template.height).toBeGreaterThanOrEqual(LIMITS.minCanvasDimension);
      expect(template.height).toBeLessThanOrEqual(LIMITS.maxCanvasDimension);
      expect(isHex(template.background)).toBe(true);

      const preset = template.presetId
        ? CANVAS_PRESETS.find((candidate) => candidate.id === template.presetId)
        : undefined;
      if (template.presetId) {
        expect(preset, `${template.id} references an unknown preset`).toBeDefined();
        expect(preset?.width).toBe(template.width);
        expect(preset?.height).toBe(template.height);
      }
    }
  });

  it('declares elements the document model accepts', () => {
    for (const template of TEMPLATES) {
      expect(template.elements.length).toBeGreaterThan(0);
      expect(template.elements.length).toBeLessThanOrEqual(LIMITS.maxElementsPerPage);

      const ids = template.elements.map((element) => element.id);
      expect(new Set(ids).size, `${template.id} repeats an element id`).toBe(ids.length);

      for (const element of template.elements) {
        expect(isId(element.id), `${template.id}/${element.id} is not a valid id`).toBe(true);
        expect(Math.abs(element.x)).toBeLessThanOrEqual(LIMITS.maxCoordinate);
        expect(Math.abs(element.y)).toBeLessThanOrEqual(LIMITS.maxCoordinate);
        expect(element.width).toBeGreaterThanOrEqual(LIMITS.minElementDimension);
        expect(element.width).toBeLessThanOrEqual(LIMITS.maxElementDimension);
        expect(element.height).toBeGreaterThanOrEqual(LIMITS.minElementDimension);
        expect(element.height).toBeLessThanOrEqual(LIMITS.maxElementDimension);
        if (element.rotation !== undefined) {
          expect(Math.abs(element.rotation)).toBeLessThanOrEqual(360);
        }
        if (element.opacity !== undefined) {
          expect(element.opacity).toBeGreaterThanOrEqual(0);
          expect(element.opacity).toBeLessThanOrEqual(1);
        }

        if (element.kind === 'rect' || element.kind === 'ellipse') {
          if (element.fill !== undefined) expect(isHex(element.fill)).toBe(true);
          if (element.stroke) {
            expect(isHex(element.stroke.color)).toBe(true);
            expect(element.stroke.width).toBeGreaterThanOrEqual(0);
            expect(element.stroke.width).toBeLessThanOrEqual(LIMITS.maxStrokeWidth);
          }
          if (element.kind === 'rect' && element.cornerRadius !== undefined) {
            expect(element.cornerRadius).toBeGreaterThanOrEqual(0);
          }
        }

        if (element.kind === 'text') {
          expect(element.text.length).toBeGreaterThan(0);
          expect(element.text.length).toBeLessThanOrEqual(LIMITS.maxTextLength);
          expect(isHex(element.color)).toBe(true);
          expect(element.fontSize).toBeGreaterThanOrEqual(LIMITS.minFontSize);
          expect(element.fontSize).toBeLessThanOrEqual(LIMITS.maxFontSize);
          expect(TEMPLATE_FONT_FAMILIES).toContain(element.fontFamily ?? 'Inter');
          if (element.fontWeight !== undefined) {
            expect(element.fontWeight % 100).toBe(0);
            expect(element.fontWeight).toBeGreaterThanOrEqual(100);
            expect(element.fontWeight).toBeLessThanOrEqual(900);
          }
          if (element.lineHeight !== undefined) {
            expect(element.lineHeight).toBeGreaterThanOrEqual(0.5);
            expect(element.lineHeight).toBeLessThanOrEqual(5);
          }
          if (element.letterSpacing !== undefined) {
            expect(element.letterSpacing).toBeGreaterThanOrEqual(-100);
            expect(element.letterSpacing).toBeLessThanOrEqual(1000);
          }
        }
      }
    }
  });

  it('ships no binary assets, so nothing needs a third-party license', () => {
    for (const template of TEMPLATES) {
      for (const element of template.elements) {
        expect(['rect', 'ellipse', 'text']).toContain(element.kind);
      }
    }
  });
});

function mustGet(id: string): TemplateDefinition {
  const found = findTemplate(TEMPLATES, id);
  if (!found.ok) throw new Error(`test fixture missing: ${found.error.message}`);
  return found.value;
}

describe('instantiating a template', () => {
  const definition = mustGet('instagram-sale');

  it('produces a document that passes schema validation', () => {
    const created = instantiateTemplate(definition, { now });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(validateDocument(created.value).ok).toBe(true);
  });

  it('keeps the template identity, size, background and elements', () => {
    const created = instantiateTemplate(definition, { now });
    if (!created.ok) throw new Error(created.error.message);
    const document = created.value;

    expect(document.metadata.source).toBe('template');
    expect(document.metadata.templateId).toBe(definition.id);
    expect(document.name).toBe(definition.name);
    expect(document.size).toEqual({ width: definition.width, height: definition.height });
    expect(document.assets).toEqual({});

    const page = document.pages[0];
    expect(page?.background).toEqual({ type: 'solid', color: definition.background });
    expect(page?.elements).toHaveLength(definition.elements.length);
    expect(page?.elements.map((element) => element.id)).toEqual(
      definition.elements.map((element) => element.id),
    );

    const headline = page?.elements.find((element) => element.id === 'headline');
    expect(headline?.type).toBe('text');
    if (headline?.type !== 'text') throw new Error('expected a text element');
    expect(headline.text).toBe('50% OFF');
    expect(headline.fontSize).toBe(170);
    expect(headline.color).toBe('#ffffff');

    const pill = page?.elements.find((element) => element.id === 'cta-pill');
    if (pill?.type !== 'rect') throw new Error('expected a rect element');
    expect(pill.cornerRadius).toBe(55);
    expect(pill.fill).toEqual({ type: 'solid', color: '#ffffff' });
  });

  it('accepts an id, a name and a fixed timestamp', () => {
    const created = instantiateTemplate(definition, {
      id: 'doc_from_template',
      name: 'Summer sale',
      now,
    });
    if (!created.ok) throw new Error(created.error.message);
    expect(created.value.id).toBe('doc_from_template');
    expect(created.value.name).toBe('Summer sale');
    expect(created.value.metadata.createdAt).toBe(now.toISOString());
    expect(created.value.metadata.updatedAt).toBe(now.toISOString());
  });

  it('is deterministic for the same inputs', () => {
    const first = instantiateTemplate(definition, { id: 'doc_same', now });
    const second = instantiateTemplate(definition, { id: 'doc_same', now });
    if (!first.ok || !second.ok) throw new Error('expected both to succeed');
    expect(second.value).toEqual(first.value);
  });

  it('gives every template a fresh document id when none is supplied', () => {
    const first = instantiateTemplate(definition, { now });
    const second = instantiateTemplate(definition, { now });
    if (!first.ok || !second.ok) throw new Error('expected both to succeed');
    expect(first.value.id).not.toBe(second.value.id);
  });
});

describe('looking templates up', () => {
  it('finds a definition by id', () => {
    const found = findTemplate(TEMPLATES, 'menu-cafe');
    expect(found.ok).toBe(true);
    if (!found.ok) return;
    expect(found.value.name).toBe('Café menu (A4)');
    expect(getTemplate('menu-cafe')).toBe(found.value);
  });

  it('reports an unknown id instead of throwing', () => {
    expect(getTemplate('nope')).toBeUndefined();
    const found = findTemplate(TEMPLATES, 'nope');
    expect(found.ok).toBe(false);
    if (found.ok) return;
    expect(found.error.code).toBe('unknown-template');
    expect(found.error.message).toContain('nope');
  });

  it('creates a document by template id', () => {
    const created = createDocumentFromTemplate('slide-title', { now });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.value.size).toEqual({ width: 1920, height: 1080 });
    expect(created.value.metadata.templateId).toBe('slide-title');

    const missing = createDocumentFromTemplate('does-not-exist', { now });
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('unknown-template');
  });

  it('instantiates every shipped template into a valid document', () => {
    for (const template of TEMPLATES) {
      const created = instantiateTemplate(template, { now });
      if (!created.ok) throw new Error(`${template.id}: ${created.error.message}`);
      expect(validateDocument(created.value).ok, template.id).toBe(true);
    }
  });
});
