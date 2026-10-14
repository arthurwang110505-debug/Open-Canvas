import {
  createBlankDocument,
  createImageAsset,
  createImageElement,
  createRectElement,
  type DesignDocument,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './reducer';
import { createEditorStore } from './store';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');
const clock = { now: () => new Date('2026-01-02T03:05:00.000Z') };

function fixture(): { doc: DesignDocument; pageId: string } {
  const doc = createBlankDocument({ id: 'doc', name: 'Fixture', now: fixedDate });
  const page = doc.pages[0];
  if (!page) throw new Error('missing page');
  page.elements.push(createRectElement({ id: 'rect', x: 0, y: 0 }));
  return { doc, pageId: page.id };
}

const asset = createImageAsset({
  id: 'asset_1',
  name: 'photo.png',
  mimeType: 'image/png',
  width: 800,
  height: 600,
  now: fixedDate,
});

function expectOk<T, E>(result: { ok: true; value: T } | { ok: false; error: E }): T {
  if (!result.ok) throw new Error(`Expected ok result, got ${JSON.stringify(result.error)}`);
  return result.value;
}

describe('asset commands', () => {
  it('registers an asset record', () => {
    const { doc } = fixture();
    const next = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    expect(next.assets).toEqual({ asset_1: asset });
    expect(next.metadata.updatedAt).toBe('2026-01-02T03:05:00.000Z');
    expect(doc.assets).toEqual({});
  });

  it('rejects duplicate asset ids', () => {
    const { doc } = fixture();
    const once = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    const twice = applyCommand(once, { type: 'asset.register', asset }, clock);
    expect(twice.ok).toBe(false);
    if (twice.ok) return;
    expect(twice.error.code).toBe('invalid-command');
    expect(twice.error.message).toContain('already registered');
  });

  it('rejects structurally invalid assets', () => {
    const { doc } = fixture();
    const result = applyCommand(
      doc,
      { type: 'asset.register', asset: { ...asset, width: 0 } },
      clock,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-command');
    expect(result.error.message).toContain('width');
  });

  it('rejects structurally invalid elements on add (e.g. NaN coordinates from a bad drop)', () => {
    const { doc, pageId } = fixture();
    const result = applyCommand(
      doc,
      { type: 'element.add', pageId, element: createRectElement({ id: 'bad', x: Number.NaN }) },
      clock,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-command');
    expect(result.error.message).toContain('x');
    expect(doc.pages[0]?.elements).toHaveLength(1);
  });

  it('rejects image elements whose asset is not registered', () => {
    const { doc, pageId } = fixture();
    const result = applyCommand(
      doc,
      {
        type: 'element.add',
        pageId,
        element: createImageElement({ id: 'img', assetId: 'missing' }),
      },
      clock,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('asset-not-found');
    expect(result.error.message).toContain('missing');
  });

  it('adds image elements once the asset is registered and keeps the document valid', () => {
    const { doc, pageId } = fixture();
    const withAsset = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    const next = expectOk(
      applyCommand(
        withAsset,
        {
          type: 'element.add',
          pageId,
          element: createImageElement({ id: 'img', assetId: 'asset_1', width: 400, height: 300 }),
        },
        clock,
      ),
    );
    expect(next.pages[0]?.elements.at(-1)).toMatchObject({
      type: 'image',
      assetId: 'asset_1',
      fit: 'cover',
    });
  });

  it('rejects updates that point an image at an unknown asset', () => {
    const { doc, pageId } = fixture();
    const withAsset = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    const withImage = expectOk(
      applyCommand(
        withAsset,
        {
          type: 'element.add',
          pageId,
          element: createImageElement({ id: 'img', assetId: 'asset_1' }),
        },
        clock,
      ),
    );
    const bad = applyCommand(
      withImage,
      { type: 'element.update', pageId, elementId: 'img', patch: { assetId: 'nope' } },
      clock,
    );
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.error.code).toBe('asset-not-found');

    const good = expectOk(
      applyCommand(
        withImage,
        { type: 'element.update', pageId, elementId: 'img', patch: { fit: 'fill' } },
        clock,
      ),
    );
    expect(good.pages[0]?.elements.at(-1)).toMatchObject({ fit: 'fill' });
  });

  it('ignores assetId patches on non-image elements', () => {
    const { doc, pageId } = fixture();
    const next = expectOk(
      applyCommand(
        doc,
        { type: 'element.update', pageId, elementId: 'rect', patch: { assetId: 'nope', x: 5 } },
        clock,
      ),
    );
    expect(next.pages[0]?.elements[0]).toMatchObject({ type: 'rect', x: 5 });
    expect(next.pages[0]?.elements[0]).not.toHaveProperty('assetId');
  });

  it('removes unreferenced assets and refuses to remove referenced ones', () => {
    const { doc, pageId } = fixture();
    const withAsset = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    const withImage = expectOk(
      applyCommand(
        withAsset,
        {
          type: 'element.add',
          pageId,
          element: createImageElement({ id: 'img', assetId: 'asset_1' }),
        },
        clock,
      ),
    );

    const blocked = applyCommand(withImage, { type: 'asset.remove', assetId: 'asset_1' }, clock);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.error.code).toBe('invalid-command');

    const removed = expectOk(
      applyCommand(withAsset, { type: 'asset.remove', assetId: 'asset_1' }, clock),
    );
    expect(removed.assets).toEqual({});

    const missing = applyCommand(doc, { type: 'asset.remove', assetId: 'asset_1' }, clock);
    expect(missing.ok).toBe(false);
    if (missing.ok) return;
    expect(missing.error.code).toBe('asset-not-found');
  });

  it('duplicates image elements sharing the same asset', () => {
    const { doc, pageId } = fixture();
    const withAsset = expectOk(applyCommand(doc, { type: 'asset.register', asset }, clock));
    const withImage = expectOk(
      applyCommand(
        withAsset,
        {
          type: 'element.add',
          pageId,
          element: createImageElement({ id: 'img', assetId: 'asset_1' }),
        },
        clock,
      ),
    );
    const next = expectOk(
      applyCommand(
        withImage,
        { type: 'element.duplicate', pageId, elementIds: ['img'], newIds: ['img2'] },
        clock,
      ),
    );
    expect(next.pages[0]?.elements.at(-1)).toMatchObject({ id: 'img2', assetId: 'asset_1' });
  });
});

describe('store integration', () => {
  it('collapses register + add into a single undo step via a shared mergeKey', () => {
    const { doc, pageId } = fixture();
    const store = createEditorStore(doc, { now: () => fixedDate });
    const mergeKey = 'insert-image:img';
    expect(store.getState().dispatch({ type: 'asset.register', asset }, { mergeKey }).ok).toBe(
      true,
    );
    expect(
      store.getState().dispatch(
        {
          type: 'element.add',
          pageId,
          element: createImageElement({ id: 'img', assetId: 'asset_1' }),
        },
        { mergeKey },
      ).ok,
    ).toBe(true);
    expect(store.getState().selectedIds).toEqual(['img']);
    expect(store.getState().past).toHaveLength(1);

    expect(store.getState().undo()).toBe(true);
    expect(store.getState().document.assets).toEqual({});
    expect(store.getState().document.pages[0]?.elements.map((e) => e.id)).toEqual(['rect']);
    expect(store.getState().canUndo()).toBe(false);

    expect(store.getState().redo()).toBe(true);
    expect(store.getState().document.assets).toEqual({ asset_1: asset });
    expect(store.getState().selectedIds).toEqual(['img']);
  });

  it('surfaces asset errors through lastError', () => {
    const { doc, pageId } = fixture();
    const store = createEditorStore(doc, { now: () => fixedDate });
    const result = store.getState().dispatch({
      type: 'element.add',
      pageId,
      element: createImageElement({ id: 'img', assetId: 'missing' }),
    });
    expect(result.ok).toBe(false);
    expect(store.getState().lastError?.code).toBe('asset-not-found');
    expect(store.getState().document).toBe(doc);
  });
});
