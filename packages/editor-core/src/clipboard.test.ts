import {
  createBlankDocument,
  createEllipseElement,
  createRectElement,
  createTextElement,
  DocumentSchema,
  type DesignDocument,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { createEditorStore, type EditorStore } from './store';

const now = new Date('2026-01-02T03:04:05.000Z');

function makeStore(): { store: EditorStore; pageId: string; document: DesignDocument } {
  const document = createBlankDocument({ id: 'doc', now });
  const pageId = document.pages[0]?.id;
  if (!pageId) throw new Error('missing page');
  return { store: createEditorStore(document, { now: () => now }), pageId, document };
}

describe('element clipboard', () => {
  it('copies in stacking order and supports repeated paste with fresh ids', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect', x: 10, y: 20 }),
    });
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createTextElement({ id: 'text', x: 100, y: 200 }),
    });
    store.getState().setSelection(['text', 'rect']);

    expect(store.getState().copySelection()).toBe(true);
    expect(store.getState().clipboard?.elements.map((element) => element.id)).toEqual([
      'rect',
      'text',
    ]);
    expect(store.getState().pasteClipboard()).toBe(true);

    let page = store.getState().document.pages[0];
    expect(page?.elements).toHaveLength(4);
    expect(page?.elements[2]).toMatchObject({ type: 'rect', x: 30, y: 40 });
    expect(store.getState().selectedIds).toEqual([page?.elements[2]?.id, page?.elements[3]?.id]);
    expect(DocumentSchema.safeParse(store.getState().document).success).toBe(true);

    expect(store.getState().pasteClipboard()).toBe(true);
    page = store.getState().document.pages[0];
    expect(page?.elements).toHaveLength(6);
    expect(page?.elements[4]).toMatchObject({ type: 'rect', x: 50, y: 60 });
    expect(DocumentSchema.safeParse(store.getState().document).success).toBe(true);

    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements).toHaveLength(4);
    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements).toHaveLength(2);
  });

  it('cuts through one undoable delete and pastes the snapshot later', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect' }),
    });

    expect(store.getState().cutSelection()).toBe(true);
    expect(store.getState().document.pages[0]?.elements).toHaveLength(0);
    expect(store.getState().clipboard?.elements).toHaveLength(1);
    expect(store.getState().pasteClipboard()).toBe(true);
    expect(store.getState().document.pages[0]?.elements).toHaveLength(1);
    expect(store.getState().document.pages[0]?.elements[0]?.id).not.toBe('rect');

    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements).toHaveLength(0);
    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements[0]?.id).toBe('rect');
  });

  it('can merge a long duplicate drag into one history step', () => {
    let timestamp = now.getTime();
    const document = createBlankDocument({ id: 'doc', now });
    const pageId = document.pages[0]?.id;
    if (!pageId) throw new Error('missing page');
    const store = createEditorStore(document, { now: () => new Date(timestamp) });
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect' }),
    });
    const historyBeforeGesture = store.getState().past.length;

    store
      .getState()
      .dispatch(
        { type: 'element.duplicate', pageId, elementIds: ['rect'], offset: 0 },
        { mergeKey: 'alt-drag:test' },
      );
    const copyId = store.getState().selectedIds[0];
    if (!copyId) throw new Error('missing copy selection');
    timestamp += 10_000;
    store.getState().dispatch(
      {
        type: 'element.update',
        pageId,
        elementId: copyId,
        patch: { x: 80, y: 60 },
      },
      { mergeKey: 'alt-drag:test', mergeWindowMs: Number.POSITIVE_INFINITY },
    );

    expect(store.getState().past).toHaveLength(historyBeforeGesture + 1);
    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements).toHaveLength(1);
    expect(store.getState().document.pages[0]?.elements[0]?.id).toBe('rect');
  });

  it('clears clipboards when a different document is loaded', () => {
    const { store, pageId, document } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect' }),
    });
    store.getState().copySelection();
    store.getState().copyStyle();
    store.getState().loadDocument(document);
    expect(store.getState().clipboard).toBeNull();
    expect(store.getState().styleClipboard).toBeNull();
  });
});

describe('style clipboard', () => {
  it('pastes compatible appearance without changing content or geometry', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({
        id: 'source',
        fill: { type: 'solid', color: '#112233' },
        stroke: { color: '#445566', width: 3 },
        cornerRadius: 18,
        opacity: 0.6,
      }),
    });
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createEllipseElement({ id: 'target', x: 300, y: 200, width: 120, height: 90 }),
    });

    store.getState().setSelection(['source']);
    expect(store.getState().copyStyle()).toBe(true);
    store.getState().setSelection(['target']);
    expect(store.getState().pasteStyle()).toBe(true);

    const target = store.getState().document.pages[0]?.elements[1];
    expect(target).toMatchObject({
      id: 'target',
      type: 'ellipse',
      x: 300,
      y: 200,
      width: 120,
      height: 90,
      fill: { type: 'solid', color: '#112233' },
      stroke: { color: '#445566', width: 3 },
      opacity: 0.6,
    });
    expect(target).not.toHaveProperty('cornerRadius');
    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements[1]).toMatchObject({
      fill: { type: 'solid', color: '#f97316' },
      opacity: 1,
    });
  });
});
