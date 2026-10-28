import { createBlankDocument, DocumentSchema } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { createEditorStore } from './store';

function makeStore() {
  const document = createBlankDocument({ id: 'doc' });
  const pageId = document.pages[0]?.id;
  if (!pageId) throw new Error('missing page');
  return { store: createEditorStore(document), pageId };
}

describe('page guide commands', () => {
  it('adds and moves guides through undoable commands, ignoring no-op moves', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'page.addGuide',
      pageId,
      guide: { id: 'guide', axis: 'horizontal', position: 100, kind: 'margin' },
    });
    store
      .getState()
      .dispatch({ type: 'page.updateGuide', pageId, guideId: 'guide', position: 100 });
    expect(store.getState().past).toHaveLength(1);

    store
      .getState()
      .dispatch({ type: 'page.updateGuide', pageId, guideId: 'guide', position: 140 });
    expect(store.getState().document.pages[0]?.guides[0]?.position).toBe(140);
    expect(store.getState().pastLabels).toEqual(['Added margin guide', 'Moved margin guide']);

    store.getState().undo();
    expect(store.getState().document.pages[0]?.guides[0]?.position).toBe(100);
    store.getState().undo();
    expect(store.getState().document.pages[0]?.guides).toEqual([]);
    store.getState().redo();
    expect(store.getState().document.pages[0]?.guides[0]?.position).toBe(100);
  });

  it('preserves independent guide data when a page is duplicated', () => {
    const { store, pageId } = makeStore();
    store.getState().dispatch({
      type: 'page.addGuide',
      pageId,
      guide: { id: 'bleed', axis: 'vertical', position: 36, kind: 'bleed' },
    });
    store.getState().dispatch({ type: 'page.duplicate', pageId, newPageId: 'page_two' });

    const source = store.getState().document.pages[0];
    const copy = store.getState().document.pages[1];
    expect(copy?.guides).toEqual(source?.guides);
    expect(copy?.guides[0]).not.toBe(source?.guides[0]);
    expect(DocumentSchema.safeParse(store.getState().document).success).toBe(true);
  });

  it('rejects invalid positions and duplicate ids without changing the document', () => {
    const { store, pageId } = makeStore();
    const before = store.getState().document;
    const invalid = store.getState().dispatch({
      type: 'page.addGuide',
      pageId,
      guide: { id: 'guide', axis: 'vertical', position: Number.NaN, kind: 'margin' },
    });
    expect(invalid.ok).toBe(false);
    expect(store.getState().document).toBe(before);

    store.getState().dispatch({
      type: 'page.addGuide',
      pageId,
      guide: { id: 'guide', axis: 'vertical', position: 20, kind: 'margin' },
    });
    const withGuide = store.getState().document;
    const duplicate = store.getState().dispatch({
      type: 'page.addGuide',
      pageId,
      guide: { id: 'guide', axis: 'horizontal', position: 40, kind: 'bleed' },
    });
    expect(duplicate.ok).toBe(false);
    expect(store.getState().document).toBe(withGuide);
  });
});
