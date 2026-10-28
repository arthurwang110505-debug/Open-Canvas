import { createBlankDocument, createRectElement } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { createEditorStore } from './store';

function makeStore() {
  const document = createBlankDocument({ id: 'doc', now: new Date('2026-01-01T00:00:00Z') });
  const pageId = document.pages[0]?.id;
  if (!pageId) throw new Error('missing page');
  return { store: createEditorStore(document), pageId };
}

describe('labeled history navigation', () => {
  it('jumps backward and forward without discarding the redo timeline', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect' }),
    });
    store.getState().dispatch({
      type: 'element.update',
      pageId,
      elementId: 'rect',
      patch: { x: 50 },
    });
    expect(store.getState().pastLabels).toEqual(['Added rectangle', 'Moved rectangle']);

    expect(store.getState().jumpToHistory(0)).toBe(true);
    expect(store.getState().document.pages[0]?.elements).toHaveLength(0);
    expect(store.getState().future).toHaveLength(2);
    expect(store.getState().futureLabels).toEqual(['Added rectangle', 'Moved rectangle']);
    expect(store.getState().pastLabels).toEqual([]);

    expect(store.getState().jumpToHistory(2)).toBe(true);
    expect(store.getState().document.pages[0]?.elements[0]?.x).toBe(50);
    expect(store.getState().pastLabels).toEqual(['Added rectangle', 'Moved rectangle']);
    expect(store.getState().future).toEqual([]);

    expect(store.getState().undo()).toBe(true);
    expect(store.getState().futureLabels).toEqual(['Moved rectangle']);
    expect(store.getState().redo()).toBe(true);
    expect(store.getState().pastLabels).toEqual(['Added rectangle', 'Moved rectangle']);
    expect(store.getState().futureLabels).toEqual([]);
  });

  it('keeps coalesced edits in one labeled entry and trims labels with the history limit', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'rect' }),
    });
    store
      .getState()
      .dispatch(
        { type: 'element.update', pageId, elementId: 'rect', patch: { x: 1 } },
        { mergeKey: 'move' },
      );
    store
      .getState()
      .dispatch(
        { type: 'element.update', pageId, elementId: 'rect', patch: { x: 2 } },
        { mergeKey: 'move' },
      );

    expect(store.getState().past).toHaveLength(2);
    expect(store.getState().pastLabels).toEqual(['Added rectangle', 'Moved rectangle']);
    store.getState().undo();
    expect(store.getState().document.pages[0]?.elements[0]?.x).toBe(0);
  });

  it('replaces only the redo branch when a new edit follows a jump', () => {
    const { store, pageId } = makeStore();
    for (const id of ['one', 'two']) {
      store.getState().dispatch({
        type: 'element.add',
        pageId,
        element: createRectElement({ id }),
      });
    }
    store.getState().jumpToHistory(1);
    store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createRectElement({ id: 'three' }),
    });

    expect(store.getState().document.pages[0]?.elements.map((element) => element.id)).toEqual([
      'one',
      'three',
    ]);
    expect(store.getState().future).toEqual([]);
    expect(store.getState().futureLabels).toEqual([]);
    expect(store.getState().pastLabels).toEqual(['Added rectangle', 'Added rectangle']);
  });
});
