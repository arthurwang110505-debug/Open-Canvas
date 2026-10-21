import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION, LIMITS } from './constants';
import {
  createBlankDocument,
  createEllipseElement,
  createIconElement,
  createRectElement,
  createTextElement,
} from './factories';
import { DocumentSchema, ElementSchema, HexColorSchema } from './schema';
import {
  cloneDocument,
  cloneDocumentAs,
  duplicateName,
  parseDocument,
  serializeDocument,
  validateDocument,
} from './serialization';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');

function documentWithElements() {
  const doc = createBlankDocument({ id: 'doc_1', name: 'Fixture', now: fixedDate });
  const page = doc.pages[0];
  if (!page) throw new Error('fixture page missing');
  page.elements.push(
    createRectElement({ id: 'rect_1', x: 10, y: 20, width: 100, height: 50 }),
    createEllipseElement({ id: 'ellipse_1', x: 30, y: 40 }),
    createTextElement({ id: 'text_1', text: 'Hello', x: 0, y: 0 }),
  );
  return doc;
}

describe('HexColorSchema', () => {
  it.each(['#000000', '#FFFFFF', '#1a2B3c', '#1a2b3cff'])('accepts %s', (color) => {
    expect(HexColorSchema.safeParse(color).success).toBe(true);
  });

  it.each(['red', '#fff', '#12345', '1a2b3c', '#1a2b3cf', 'rgb(0,0,0)'])('rejects %s', (color) => {
    expect(HexColorSchema.safeParse(color).success).toBe(false);
  });
});

describe('ElementSchema', () => {
  it('applies defaults for optional styling properties', () => {
    const parsed = ElementSchema.parse({
      type: 'rect',
      id: 'r1',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      fill: { type: 'solid', color: '#ff0000' },
    });
    expect(parsed).toMatchObject({
      rotation: 0,
      opacity: 1,
      locked: false,
      visible: true,
      cornerRadius: 0,
    });
  });

  it('rejects unknown element types', () => {
    const result = ElementSchema.safeParse({
      type: 'video',
      id: 'v1',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range values', () => {
    const base = createRectElement({ id: 'r1' });
    expect(ElementSchema.safeParse({ ...base, opacity: 1.5 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, width: 0 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, x: Number.POSITIVE_INFINITY }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, x: Number.NaN }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...base, id: 'has spaces' }).success).toBe(false);
  });

  it('accepts an icon and applies its defaults', () => {
    const parsed = ElementSchema.parse({
      type: 'icon',
      id: 'i1',
      x: 0,
      y: 0,
      width: 96,
      height: 96,
      iconId: 'arrow-right',
    });
    expect(parsed).toMatchObject({ color: '#111827', strokeWidth: 2 });
  });

  it('rejects an icon id that could not be looked up', () => {
    const icon = createIconElement({ id: 'i1', iconId: 'heart' });
    expect(ElementSchema.safeParse(icon).success).toBe(true);
    for (const iconId of ['', 'Heart', 'heart ', '../heart', 'x'.repeat(65)]) {
      expect(ElementSchema.safeParse({ ...icon, iconId }).success).toBe(false);
    }
    expect(ElementSchema.safeParse({ ...icon, strokeWidth: 0 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...icon, strokeWidth: 12 }).success).toBe(false);
  });

  it('validates typography constraints', () => {
    const text = createTextElement({ id: 't1' });
    expect(ElementSchema.safeParse(text).success).toBe(true);
    expect(ElementSchema.safeParse({ ...text, fontWeight: 450 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...text, fontSize: 0 }).success).toBe(false);
    expect(ElementSchema.safeParse({ ...text, textAlign: 'middle' }).success).toBe(false);
    expect(
      ElementSchema.safeParse({ ...text, text: 'x'.repeat(LIMITS.maxTextLength + 1) }).success,
    ).toBe(false);
  });
});

describe('DocumentSchema', () => {
  it('accepts documents produced by the factories', () => {
    const result = DocumentSchema.safeParse(documentWithElements());
    expect(result.success).toBe(true);
  });

  it('requires at least one page', () => {
    const doc = { ...createBlankDocument({ now: fixedDate }), pages: [] };
    expect(DocumentSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects duplicate element ids across pages', () => {
    const doc = documentWithElements();
    const first = doc.pages[0];
    if (!first) throw new Error('missing page');
    doc.pages.push({ ...first, id: 'page_2', elements: [createRectElement({ id: 'rect_1' })] });
    const result = validateDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-document');
      expect(result.error.issues?.some((issue) => issue.message.includes('rect_1'))).toBe(true);
    }
  });

  it('rejects canvases larger than the supported maximum', () => {
    const doc = createBlankDocument({ now: fixedDate, width: LIMITS.maxCanvasDimension + 1 });
    expect(DocumentSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects documents with too many elements on a page', () => {
    const doc = createBlankDocument({ now: fixedDate });
    const page = doc.pages[0];
    if (!page) throw new Error('missing page');
    for (let i = 0; i <= LIMITS.maxElementsPerPage; i += 1) {
      page.elements.push(createRectElement({ id: `r${i}` }));
    }
    expect(DocumentSchema.safeParse(doc).success).toBe(false);
  });
});

describe('serialization', () => {
  it('round-trips through JSON without losing supported content', () => {
    const doc = documentWithElements();
    const json = serializeDocument(doc, { pretty: true });
    const parsed = parseDocument(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.document).toEqual(doc);
      expect(parsed.value.sourceVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parsed.value.migrated).toBe(false);
    }
  });

  it('rejects invalid JSON safely', () => {
    const result = parseDocument('{ not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-json');
  });

  it('rejects non-object payloads', () => {
    for (const payload of [null, 42, 'text', [], true]) {
      const result = parseDocument(JSON.stringify(payload));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe('invalid-structure');
    }
  });

  it('rejects documents without a schema version', () => {
    const { schemaVersion: _omitted, ...rest } = documentWithElements();
    const result = parseDocument(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid-structure');
  });

  it('rejects documents from a newer schema version', () => {
    const doc = { ...documentWithElements(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 };
    const result = parseDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported-version');
      expect(result.error.message).toContain('newer');
    }
  });

  it('reports a readable path for structural errors', () => {
    const doc = documentWithElements();
    const page = doc.pages[0];
    const rect = page?.elements[0];
    if (rect?.type !== 'rect') throw new Error('fixture mismatch');
    rect.fill = { type: 'solid', color: 'blue' };
    const result = parseDocument(doc);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-document');
      expect(result.error.issues?.[0]?.path).toBe('pages.0.elements.0.fill.color');
    }
  });

  it('strips unknown properties instead of keeping arbitrary data', () => {
    const doc = documentWithElements() as Record<string, unknown>;
    doc['__proto_payload'] = { evil: true };
    const result = parseDocument(doc);
    expect(result.ok).toBe(true);
    if (result.ok) expect('__proto_payload' in result.value.document).toBe(false);
  });

  it('clones documents deeply', () => {
    const doc = documentWithElements();
    const copy = cloneDocument(doc);
    expect(copy).toEqual(doc);
    expect(copy).not.toBe(doc);
    expect(copy.pages[0]).not.toBe(doc.pages[0]);
  });
});

describe('cloneDocumentAs', () => {
  it('copies a document under a new identity without sharing state', () => {
    const now = new Date('2026-03-04T05:06:07.000Z');
    const doc = createBlankDocument({ id: 'doc_src', name: 'Poster' });
    doc.pages[0]?.elements.push(createRectElement({ id: 'r1' }));
    const copy = cloneDocumentAs(doc, { id: 'doc_copy', now });
    expect(copy.id).toBe('doc_copy');
    expect(copy.name).toBe('Poster copy');
    expect(copy.metadata.createdAt).toBe(now.toISOString());
    expect(copy.metadata.updatedAt).toBe(now.toISOString());
    expect(copy.pages[0]?.elements[0]?.id).toBe('r1');
    copy.pages[0]?.elements.push(createRectElement({ id: 'r2' }));
    expect(doc.pages[0]?.elements).toHaveLength(1);
    expect(validateDocument(copy).ok).toBe(true);
  });

  it('keeps duplicate names within the length limit', () => {
    const long = 'x'.repeat(LIMITS.maxNameLength);
    expect(duplicateName(long)).toHaveLength(LIMITS.maxNameLength);
    expect(duplicateName(long).endsWith(' copy')).toBe(true);
    expect(duplicateName('Flyer')).toBe('Flyer copy');
  });
});
