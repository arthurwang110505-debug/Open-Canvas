import { createBlankDocument, createRectElement } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { createEditorStore } from './store';
import { MAX_ZOOM, MIN_ZOOM, fitZoom, nextZoomIn, nextZoomOut } from './zoom';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');

function makeStore(options: { mergeWindowMs?: number; historyLimit?: number } = {}) {
  let tick = 0;
  const clock = () => new Date(fixedDate.getTime() + tick);
  const store = createEditorStore(createBlankDocument({ id: 'doc', now: fixedDate }), {
    ...options,
    now: clock,
  });
  const pageId = store.getState().activePageId;
  const advance = (ms: number) => {
    tick += ms;
  };
  return { store, pageId, advance };
}

function ids(store: ReturnType<typeof makeStore>['store']): string[] {
  return store.getState().document.pages[0]?.elements.map((element) => element.id) ?? [];
}

describe('createEditorStore', () => {
  it('starts clean with the first page active', () => {
    const { store, pageId } = makeStore();
    const state = store.getState();
    expect(state.activePageId).toBe(pageId);
    expect(state.dirty).toBe(false);
    expect(state.canUndo()).toBe(false);
    expect(state.canRedo()).toBe(false);
    expect(state.selectedIds).toEqual([]);
  });

  it('applies commands, selects new elements and tracks dirtiness', () => {
    const { store, pageId } = makeStore();
    const result = store
      .getState()
      .dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    expect(result.ok).toBe(true);
    expect(ids(store)).toEqual(['r1']);
    expect(store.getState().selectedIds).toEqual(['r1']);
    expect(store.getState().dirty).toBe(true);
    expect(store.getState().canUndo()).toBe(true);
  });

  it('records rejected commands without changing the document', () => {
    const { store, pageId } = makeStore();
    const before = store.getState().document;
    const result = store.getState().dispatch({
      type: 'element.update',
      pageId,
      elementId: 'missing',
      patch: { x: 1 },
    });
    expect(result.ok).toBe(false);
    expect(store.getState().document).toBe(before);
    expect(store.getState().lastError?.code).toBe('element-not-found');
    expect(store.getState().canUndo()).toBe(false);
    store.getState().clearError();
    expect(store.getState().lastError).toBeNull();
  });

  it('undo and redo restore exact document states', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo, redo } = store.getState();
    const d0 = store.getState().document;
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1', x: 0 }) });
    const d1 = store.getState().document;
    dispatch({ type: 'element.update', pageId, elementId: 'r1', patch: { x: 100 } });
    const d2 = store.getState().document;

    expect(undo()).toBe(true);
    expect(store.getState().document).toBe(d1);
    expect(undo()).toBe(true);
    expect(store.getState().document).toBe(d0);
    expect(undo()).toBe(false);

    expect(redo()).toBe(true);
    expect(store.getState().document).toBe(d1);
    expect(redo()).toBe(true);
    expect(store.getState().document).toBe(d2);
    expect(redo()).toBe(false);
  });

  it('clears the redo stack when a new command is dispatched', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    undo();
    expect(store.getState().canRedo()).toBe(true);
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r2' }) });
    expect(store.getState().canRedo()).toBe(false);
    expect(ids(store)).toEqual(['r2']);
  });

  it('prunes the selection when undo removes selected elements', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    expect(store.getState().selectedIds).toEqual(['r1']);
    undo();
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('selects elements that reappear through undo or redo', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo, redo, setSelection } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r2' }) });
    setSelection(['r1']);
    dispatch({ type: 'element.delete', pageId, elementIds: ['r1'] });
    expect(store.getState().selectedIds).toEqual([]);
    undo(); // restores r1
    expect(store.getState().selectedIds).toEqual(['r1']);
    redo(); // deletes r1 again
    expect(store.getState().selectedIds).toEqual([]);
    undo();
    undo(); // removes r2; r1 stays selected because it still exists
    expect(store.getState().selectedIds).toEqual(['r1']);
  });

  it('coalesces consecutive dispatches sharing a merge key', () => {
    const { store, pageId, advance } = makeStore({ mergeWindowMs: 500 });
    const { dispatch, undo } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1', x: 0 }) });
    for (const x of [1, 12, 123]) {
      advance(50);
      dispatch(
        { type: 'element.update', pageId, elementId: 'r1', patch: { x } },
        { mergeKey: 'x' },
      );
    }
    expect(store.getState().past).toHaveLength(2);
    undo();
    expect(store.getState().document.pages[0]?.elements[0]).toMatchObject({ x: 0 });
  });

  it('stops merging once the window elapses or the key changes', () => {
    const { store, pageId, advance } = makeStore({ mergeWindowMs: 500 });
    const { dispatch } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1', x: 0 }) });
    dispatch(
      { type: 'element.update', pageId, elementId: 'r1', patch: { x: 1 } },
      { mergeKey: 'x' },
    );
    advance(600);
    dispatch(
      { type: 'element.update', pageId, elementId: 'r1', patch: { x: 2 } },
      { mergeKey: 'x' },
    );
    dispatch(
      { type: 'element.update', pageId, elementId: 'r1', patch: { y: 2 } },
      { mergeKey: 'y' },
    );
    expect(store.getState().past).toHaveLength(4);
  });

  it('can skip history for derived updates', () => {
    const { store, pageId } = makeStore();
    const { dispatch } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    dispatch(
      { type: 'element.update', pageId, elementId: 'r1', patch: { height: 77 } },
      { recordHistory: false },
    );
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().document.pages[0]?.elements[0]).toMatchObject({ height: 77 });
  });

  it('caps the history length', () => {
    const { store, pageId } = makeStore({ historyLimit: 3 });
    const { dispatch } = store.getState();
    for (let i = 0; i < 10; i += 1) {
      dispatch({ type: 'element.add', pageId, element: createRectElement({ id: `r${i}` }) });
    }
    expect(store.getState().past).toHaveLength(3);
  });

  it('tracks saved state by snapshot identity', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo, markSaved } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    markSaved();
    expect(store.getState().dirty).toBe(false);
    dispatch({ type: 'element.update', pageId, elementId: 'r1', patch: { x: 5 } });
    expect(store.getState().dirty).toBe(true);
    undo();
    expect(store.getState().dirty).toBe(false);
  });

  it('keeps the store dirty when an older snapshot is marked saved', () => {
    const { store, pageId } = makeStore();
    const { dispatch, undo, markSaved } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    const snapshot = store.getState().document;
    // The user keeps editing while the (async) save of `snapshot` is in flight.
    dispatch({ type: 'element.update', pageId, elementId: 'r1', patch: { x: 5 } });
    markSaved(snapshot);
    expect(store.getState().dirty).toBe(true);
    undo();
    expect(store.getState().dirty).toBe(false);
  });

  it('only selects elements that exist on the active page', () => {
    const { store, pageId } = makeStore();
    const { dispatch, setSelection } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    setSelection(['r1', 'ghost', 'r1']);
    expect(store.getState().selectedIds).toEqual(['r1']);
    store.getState().clearSelection();
    expect(store.getState().selectedIds).toEqual([]);
  });

  it('selects duplicated elements', () => {
    const { store, pageId } = makeStore();
    const { dispatch } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    dispatch({ type: 'element.duplicate', pageId, elementIds: ['r1'], newIds: ['r1-copy'] });
    expect(store.getState().selectedIds).toEqual(['r1-copy']);
  });

  it('loads a new document and resets history', () => {
    const { store, pageId } = makeStore();
    const { dispatch, loadDocument } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
    const next = createBlankDocument({ id: 'other', name: 'Other', now: fixedDate });
    loadDocument(next);
    const state = store.getState();
    expect(state.document).toBe(next);
    expect(state.activePageId).toBe(next.pages[0]?.id);
    expect(state.dirty).toBe(false);
    expect(state.canUndo()).toBe(false);
    expect(state.selectedIds).toEqual([]);
  });

  it('keeps adjust-photo mode only while its frame is being edited', () => {
    const { store, pageId } = makeStore();
    const { dispatch, setPhotoPan, setSelection } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'f' }) });
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'other' }) });

    setSelection(['f']);
    setPhotoPan('f');
    expect(store.getState().photoPanId).toBe('f');
    // Re-selecting the same frame keeps the mode: it is a UI state, not a selection side effect.
    setSelection(['f']);
    expect(store.getState().photoPanId).toBe('f');

    // Selecting something else ends it, as does clearing the selection.
    setSelection(['other']);
    expect(store.getState().photoPanId).toBeNull();
    setSelection(['f']);
    setPhotoPan('f');
    store.getState().clearSelection();
    expect(store.getState().photoPanId).toBeNull();
  });

  it('leaves adjust-photo mode when its frame goes away', () => {
    const { store, pageId } = makeStore();
    const { dispatch } = store.getState();
    dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'f' }) });
    store.getState().setSelection(['f']);
    store.getState().setPhotoPan('f');

    // Deleting the frame (undoably) drops the target with it.
    dispatch({ type: 'element.delete', pageId, elementIds: ['f'] });
    expect(store.getState().photoPanId).toBeNull();
  });

  it('clamps zoom', () => {
    const { store } = makeStore();
    store.getState().setZoom(100);
    expect(store.getState().zoom).toBe(MAX_ZOOM);
    store.getState().setZoom(0);
    expect(store.getState().zoom).toBe(MIN_ZOOM);
    store.getState().setZoom(Number.NaN);
    expect(store.getState().zoom).toBe(1);
  });
});

describe('zoom helpers', () => {
  it('steps through preset stops', () => {
    expect(nextZoomIn(1)).toBe(1.25);
    expect(nextZoomOut(1)).toBe(0.75);
    expect(nextZoomIn(0.6)).toBe(0.75);
    expect(nextZoomOut(0.6)).toBe(0.5);
    expect(nextZoomIn(8)).toBe(MAX_ZOOM);
    expect(nextZoomOut(0.05)).toBe(MIN_ZOOM);
  });

  it('fits a page into a viewport with padding', () => {
    expect(fitZoom({ width: 1000, height: 1000 }, { width: 1080, height: 1080 }, 40)).toBeCloseTo(
      920 / 1080,
    );
    expect(fitZoom({ width: 2000, height: 600 }, { width: 1080, height: 1920 }, 0)).toBeCloseTo(
      600 / 1920,
    );
  });
});
