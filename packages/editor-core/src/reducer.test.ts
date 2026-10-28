import {
  createBlankDocument,
  createFrameElement,
  createGroupElement,
  createRectElement,
  createTextElement,
  DocumentSchema,
  type DesignDocument,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './reducer';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');
const later = new Date('2026-01-02T03:05:00.000Z');
const clock = { now: () => later };

function fixture(): { doc: DesignDocument; pageId: string } {
  const doc = createBlankDocument({ id: 'doc', name: 'Fixture', now: fixedDate });
  const page = doc.pages[0];
  if (!page) throw new Error('missing page');
  page.elements.push(
    createRectElement({ id: 'a', x: 0, y: 0 }),
    createRectElement({ id: 'b', x: 10, y: 10 }),
    createTextElement({ id: 't', text: 'Hi' }),
  );
  return { doc, pageId: page.id };
}

function elementIds(doc: DesignDocument): string[] {
  return doc.pages[0]?.elements.map((element) => element.id) ?? [];
}

function expectOk<T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!result.ok) throw new Error(`Expected ok result, got ${JSON.stringify(result.error)}`);
  return result.value;
}

function nestedGroup() {
  const inner = createGroupElement(
    [createRectElement({ id: 'inner-child', width: 80, height: 80 })],
    { id: 'inner-group' },
  );
  return createGroupElement(
    [inner, createRectElement({ id: 'outer-child', x: 120, width: 60, height: 60 })],
    { id: 'outer-group' },
  );
}

describe('applyCommand', () => {
  it('never mutates the input document', () => {
    const { doc, pageId } = fixture();
    const snapshot = structuredClone(doc);
    expectOk(
      applyCommand(doc, {
        type: 'element.update',
        pageId,
        elementId: 'a',
        patch: { x: 99 },
      }),
    );
    expect(doc).toEqual(snapshot);
  });

  it('bumps updatedAt on successful commands only', () => {
    const { doc } = fixture();
    const renamed = expectOk(applyCommand(doc, { type: 'document.rename', name: 'New' }, clock));
    expect(renamed.name).toBe('New');
    expect(renamed.metadata.updatedAt).toBe(later.toISOString());
    expect(renamed.metadata.createdAt).toBe(fixedDate.toISOString());

    const failed = applyCommand(doc, { type: 'document.rename', name: '   ' }, clock);
    expect(failed.ok).toBe(false);
  });

  it('validates canvas sizes on resize', () => {
    const { doc } = fixture();
    const resized = expectOk(
      applyCommand(doc, { type: 'document.resize', width: 1920, height: 1080 }),
    );
    expect(resized.size).toEqual({ width: 1920, height: 1080 });
    expect(applyCommand(doc, { type: 'document.resize', width: 0, height: 10 }).ok).toBe(false);
    expect(applyCommand(doc, { type: 'document.resize', width: 10.5, height: 10 }).ok).toBe(false);
  });

  it('adds elements at the end or at a given index', () => {
    const { doc, pageId } = fixture();
    const appended = expectOk(
      applyCommand(doc, { type: 'element.add', pageId, element: createRectElement({ id: 'z' }) }),
    );
    expect(elementIds(appended)).toEqual(['a', 'b', 't', 'z']);

    const inserted = expectOk(
      applyCommand(doc, {
        type: 'element.add',
        pageId,
        element: createRectElement({ id: 'z' }),
        index: 1,
      }),
    );
    expect(elementIds(inserted)).toEqual(['a', 'z', 'b', 't']);
  });

  it('rejects duplicate ids and unknown pages', () => {
    const { doc, pageId } = fixture();
    const duplicate = applyCommand(doc, {
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'a' }),
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe('invalid-command');

    const missingPage = applyCommand(doc, {
      type: 'element.add',
      pageId: 'nope',
      element: createRectElement({ id: 'q' }),
    });
    expect(missingPage.ok).toBe(false);
    if (!missingPage.ok) expect(missingPage.error.code).toBe('page-not-found');
  });

  it('updates elements and keeps identity fields immutable', () => {
    const { doc, pageId } = fixture();
    const updated = expectOk(
      applyCommand(doc, {
        type: 'element.update',
        pageId,
        elementId: 'a',
        patch: { x: 50, rotation: 45, fill: { type: 'solid', color: '#00ff00' } },
      }),
    );
    const element = updated.pages[0]?.elements[0];
    expect(element).toMatchObject({ id: 'a', type: 'rect', x: 50, rotation: 45 });
    // Untouched pages/elements keep their identity (structural sharing).
    expect(updated.pages[0]?.elements[1]).toBe(doc.pages[0]?.elements[1]);
  });

  it('rejects patches that would produce an invalid element', () => {
    const { doc, pageId } = fixture();
    const result = applyCommand(doc, {
      type: 'element.update',
      pageId,
      elementId: 'a',
      patch: { opacity: 4 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('invalid-result');
      expect(result.error.message).toContain('opacity');
    }
  });

  it('ignores properties that do not apply to the element type', () => {
    const { doc, pageId } = fixture();
    const updated = expectOk(
      applyCommand(doc, {
        type: 'element.update',
        pageId,
        elementId: 't',
        patch: { cornerRadius: 12, fontSize: 64 },
      }),
    );
    const text = updated.pages[0]?.elements[2];
    expect(text?.type).toBe('text');
    expect(text).not.toHaveProperty('cornerRadius');
    expect(text).toMatchObject({ fontSize: 64 });
  });

  it('applies batch updates atomically', () => {
    const { doc, pageId } = fixture();
    const result = applyCommand(doc, {
      type: 'element.updateMany',
      pageId,
      updates: [
        { elementId: 'a', patch: { x: 1 } },
        { elementId: 'missing', patch: { x: 2 } },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('element-not-found');
  });

  it('deletes elements', () => {
    const { doc, pageId } = fixture();
    const deleted = expectOk(
      applyCommand(doc, { type: 'element.delete', pageId, elementIds: ['a', 't'] }),
    );
    expect(elementIds(deleted)).toEqual(['b']);
    expect(applyCommand(doc, { type: 'element.delete', pageId, elementIds: ['zzz'] }).ok).toBe(
      false,
    );
  });

  it('duplicates elements with an offset and new ids', () => {
    const { doc, pageId } = fixture();
    const duplicated = expectOk(
      applyCommand(doc, {
        type: 'element.duplicate',
        pageId,
        elementIds: ['a'],
        newIds: ['a2'],
        offset: 15,
      }),
    );
    expect(elementIds(duplicated)).toEqual(['a', 'b', 't', 'a2']);
    expect(duplicated.pages[0]?.elements[3]).toMatchObject({ id: 'a2', x: 15, y: 15 });
  });

  it('duplicates complete group trees with document-wide unique ids', () => {
    const { doc, pageId } = fixture();
    const withGroup = expectOk(
      applyCommand(doc, { type: 'element.add', pageId, element: nestedGroup() }),
    );
    const duplicated = expectOk(
      applyCommand(withGroup, {
        type: 'element.duplicate',
        pageId,
        elementIds: ['outer-group'],
        newIds: ['outer-copy'],
        offset: 0,
      }),
    );

    const copy = duplicated.pages[0]?.elements.at(-1);
    expect(copy).toMatchObject({ id: 'outer-copy', type: 'group', x: 0, y: 0 });
    if (copy?.type !== 'group') throw new Error('expected copied group');
    expect(copy.children.map((child) => child.id)).not.toEqual(['inner-group', 'outer-child']);
    expect(DocumentSchema.safeParse(duplicated).success).toBe(true);
  });

  it('pastes copied elements as new validated element trees', () => {
    const { doc, pageId } = fixture();
    const pasted = expectOk(
      applyCommand(doc, {
        type: 'element.paste',
        pageId,
        elements: [
          nestedGroup(),
          createTextElement({ id: 'copied-text', text: 'Hi', x: 200, y: 40 }),
        ],
        offset: 25,
      }),
    );

    expect(pasted.pages[0]?.elements).toHaveLength(5);
    expect(pasted.pages[0]?.elements.at(-1)).toMatchObject({
      type: 'text',
      text: 'Hi',
      x: 225,
      y: 65,
    });
    expect(DocumentSchema.safeParse(pasted).success).toBe(true);
  });

  it('rejects pasted groups that reference missing assets', () => {
    const { doc, pageId } = fixture();
    const group = createGroupElement(
      [createFrameElement({ id: 'filled-frame', assetId: 'missing-asset' })],
      { id: 'asset-group' },
    );
    const result = applyCommand(doc, { type: 'element.paste', pageId, elements: [group] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('asset-not-found');
  });

  it('regenerates nested ids when duplicating a page', () => {
    const { doc, pageId } = fixture();
    const withGroup = expectOk(
      applyCommand(doc, { type: 'element.add', pageId, element: nestedGroup() }),
    );
    const duplicated = expectOk(
      applyCommand(withGroup, { type: 'page.duplicate', pageId, newPageId: 'page-copy' }),
    );
    expect(duplicated.pages).toHaveLength(2);
    expect(DocumentSchema.safeParse(duplicated).success).toBe(true);
  });

  it('reorders elements within the page', () => {
    const { doc, pageId } = fixture();
    const reorder = (
      elementId: string,
      to: 'front' | 'back' | 'forward' | 'backward' | { index: number },
    ) =>
      elementIds(expectOk(applyCommand(doc, { type: 'element.reorder', pageId, elementId, to })));

    expect(reorder('a', 'front')).toEqual(['b', 't', 'a']);
    expect(reorder('t', 'back')).toEqual(['t', 'a', 'b']);
    expect(reorder('a', 'forward')).toEqual(['b', 'a', 't']);
    expect(reorder('t', 'backward')).toEqual(['a', 't', 'b']);
    expect(reorder('a', { index: 99 })).toEqual(['b', 't', 'a']);
    expect(reorder('b', { index: -5 })).toEqual(['b', 'a', 't']);
  });

  it('returns the same document when a reorder is a no-op', () => {
    const { doc, pageId } = fixture();
    const result = expectOk(
      applyCommand(doc, { type: 'element.reorder', pageId, elementId: 'a', to: 'back' }),
    );
    expect(result).toBe(doc);
  });

  it('replaces a page with template content in one command', () => {
    const { doc, pageId } = fixture();
    const updated = expectOk(
      applyCommand(doc, {
        type: 'page.replaceContent',
        pageId,
        background: { type: 'solid', color: '#0f172a' },
        elements: [createTextElement({ id: 'headline', text: 'Spring sale' })],
      }),
    );
    expect(updated.pages[0]?.background).toEqual({ type: 'solid', color: '#0f172a' });
    expect(elementIds(updated)).toEqual(['headline']);
  });

  it('rejects invalid template content instead of storing it', () => {
    const { doc, pageId } = fixture();
    const bad = { ...createTextElement({ id: 't' }), fontSize: 0 };
    const result = applyCommand(doc, {
      type: 'page.replaceContent',
      pageId,
      background: { type: 'solid', color: '#ffffff' },
      elements: [bad],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-result');
  });

  it('adds a page seeded with template content', () => {
    const { doc } = fixture();
    const updated = expectOk(
      applyCommand(doc, {
        type: 'page.add',
        pageId: 'page_template',
        background: { type: 'solid', color: '#fef3c7' },
        elements: [createRectElement({ id: 'tile', width: 120, height: 120 })],
      }),
    );
    expect(updated.pages).toHaveLength(2);
    expect(updated.pages[1]).toMatchObject({
      id: 'page_template',
      background: { type: 'solid', color: '#fef3c7' },
    });
    expect(updated.pages[1]?.elements.map((element) => element.id)).toEqual(['tile']);
  });

  it('sets the page background', () => {
    const { doc, pageId } = fixture();
    const updated = expectOk(
      applyCommand(doc, {
        type: 'page.setBackground',
        pageId,
        background: { type: 'solid', color: '#123456' },
      }),
    );
    expect(updated.pages[0]?.background).toEqual({ type: 'solid', color: '#123456' });
  });
});
