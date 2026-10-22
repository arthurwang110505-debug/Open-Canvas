import {
  createFrameElement,
  createImageAsset,
  type DesignDocument,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { FabricImage, Point, type FabricObject } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { FabricCanvasAdapter, type CanvasAdapterCallbacks } from './adapter';

const size = { width: 1000, height: 1000 };
// 2:1 photo: a square mask crops 100px off each side, so there is room to pan.
const asset = createImageAsset({
  id: 'asset_wide',
  name: 'wide.webp',
  mimeType: 'image/webp',
  width: 400,
  height: 200,
});
const assets: DesignDocument['assets'] = { [asset.id]: asset };

function makePage(elements: DesignElement[]): Page {
  return { id: 'page_1', background: { type: 'solid', color: '#ffffff' }, elements };
}

/**
 * Fabric's pointer events carry more fields (the native event, viewport point, selection flags)
 * than the adapter reads. Tests supply the two it uses and cast, rather than faking all of them.
 */
function pointer(target: FabricObject | undefined, x: number, y: number): never {
  return { target, scenePoint: new Point(x, y) } as never;
}

function bitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('FabricCanvasAdapter photo panning', () => {
  let canvasEl: HTMLCanvasElement;
  let callbacks: {
    [K in keyof CanvasAdapterCallbacks]: Mock<NonNullable<CanvasAdapterCallbacks[K]>>;
  };
  let adapter: FabricCanvasAdapter | null = null;

  const frame = createFrameElement({
    id: 'f',
    x: 100,
    y: 100,
    width: 200,
    height: 200,
    assetId: asset.id,
  });

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    document.body.appendChild(canvasEl);
    callbacks = {
      onElementsModified: vi.fn<CanvasAdapterCallbacks['onElementsModified']>(),
      onTextCommitted: vi.fn<CanvasAdapterCallbacks['onTextCommitted']>(),
      onTextMeasured: vi.fn<CanvasAdapterCallbacks['onTextMeasured']>(),
      onSelectionChanged: vi.fn<CanvasAdapterCallbacks['onSelectionChanged']>(),
      onZoomChanged: vi.fn<CanvasAdapterCallbacks['onZoomChanged']>(),
      onAssetError: vi.fn<CanvasAdapterCallbacks['onAssetError']>(),
      onPhotoPanChanged: vi.fn<NonNullable<CanvasAdapterCallbacks['onPhotoPanChanged']>>(),
      onPhotoPanned: vi.fn<NonNullable<CanvasAdapterCallbacks['onPhotoPanned']>>(),
    };
  });

  afterEach(() => {
    adapter?.dispose();
    adapter = null;
    canvasEl.remove();
  });

  /** Renders a filled frame and waits until its bitmap is on the canvas. */
  async function createFilled(element = frame): Promise<{
    adapter: FabricCanvasAdapter;
    object: FabricImage;
  }> {
    const a = new FabricCanvasAdapter(canvasEl, callbacks, {
      resolveAssetUrl: (record) => Promise.resolve(`blob:test/${record.id}`),
      loadImage: () => Promise.resolve(bitmap(asset.width, asset.height)),
    });
    adapter = a;
    a.setViewportSize(800, 600);
    a.render({ page: makePage([element]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('f')).toBe('ready');
    });
    const object = a.getFabricCanvas().getObjects()[1];
    if (!(object instanceof FabricImage)) throw new Error('expected a filled frame');
    // `instanceof` narrows the generic parameters to `any`; the fields used here are concrete.
    return { adapter: a, object: object as FabricImage };
  }

  it('locks the frame while the mode is on and restores it afterwards', async () => {
    const { adapter: a, object } = await createFilled();

    a.setPhotoPanTarget('f');
    // Fabric's drag handler checks these on every move, so the mask cannot move under the photo.
    expect(object.lockMovementX).toBe(true);
    expect(object.lockMovementY).toBe(true);
    expect(object.hasControls).toBe(false);

    a.setPhotoPanTarget(null);
    expect(object.lockMovementX).toBe(false);
    expect(object.hasControls).toBe(true);
  });

  it('pans the photo, keeps the frame still and reports the crop once', async () => {
    const { adapter: a, object } = await createFilled();
    a.setPhotoPanTarget('f');

    const canvas = a.getFabricCanvas();
    canvas.fire('mouse:down', pointer(object, 300, 300));
    // Dragging 40px right hides 40px of photo on the left, at cover scale 1.
    canvas.fire('mouse:move', pointer(object, 340, 300));
    expect(object.cropX).toBe(60);
    expect(object.cropY).toBe(0);
    // The gesture is not committed while the pointer is still down.
    expect(callbacks.onPhotoPanned).not.toHaveBeenCalled();
    // And the frame has not been moved or resized by the drag.
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);

    canvas.fire('mouse:up', pointer(object, 340, 300));
    expect(callbacks.onPhotoPanned).toHaveBeenCalledTimes(1);
    expect(callbacks.onPhotoPanned).toHaveBeenCalledWith('f', {
      x: 0.15,
      y: 0,
      width: 0.5,
      height: 1,
    });
  });

  it('clamps a drag to the bitmap instead of showing empty space', async () => {
    const { adapter: a, object } = await createFilled();
    a.setPhotoPanTarget('f');
    const canvas = a.getFabricCanvas();

    canvas.fire('mouse:down', pointer(object, 300, 300));
    canvas.fire('mouse:move', pointer(object, 900, 300));
    canvas.fire('mouse:up', pointer(object, 900, 300));

    expect(callbacks.onPhotoPanned).toHaveBeenCalledWith('f', {
      x: 0,
      y: 0,
      width: 0.5,
      height: 1,
    });
  });

  it('does not report a click that did not move the photo', async () => {
    const { adapter: a, object } = await createFilled();
    a.setPhotoPanTarget('f');
    const canvas = a.getFabricCanvas();

    canvas.fire('mouse:down', pointer(object, 300, 300));
    canvas.fire('mouse:up', pointer(object, 300, 300));
    expect(callbacks.onPhotoPanned).not.toHaveBeenCalled();
  });

  it('leaves the mode when the user presses somewhere else', async () => {
    const { adapter: a, object } = await createFilled();
    a.setPhotoPanTarget('f');

    a.getFabricCanvas().fire('mouse:down', pointer(undefined, 20, 20));
    expect(callbacks.onPhotoPanChanged).toHaveBeenCalledWith(null);

    // Pressing the frame itself starts a pan instead of closing the mode.
    a.getFabricCanvas().fire('mouse:down', pointer(object, 300, 300));
    expect(callbacks.onPhotoPanChanged).toHaveBeenLastCalledWith(null);
    expect(callbacks.onPhotoPanChanged).toHaveBeenCalledTimes(1);
  });

  it('opens the mode on a double click, but only when there is something to reveal', async () => {
    const { adapter: a, object } = await createFilled();
    const canvas = a.getFabricCanvas();

    canvas.fire('mouse:dblclick', pointer(object, 0, 0));
    expect(callbacks.onPhotoPanChanged).toHaveBeenCalledWith('f');

    // A stretched photo has no overflow, and an empty frame has no photo at all.
    a.render({
      page: makePage([{ ...frame, fit: 'fill' }]),
      size,
      selectedIds: [],
      assets,
    });
    canvas.fire('mouse:dblclick', pointer(object, 0, 0));
    expect(callbacks.onPhotoPanChanged).toHaveBeenCalledTimes(1);
  });

  it('does not offer to pan a locked frame', async () => {
    const { adapter: a, object } = await createFilled({ ...frame, locked: true });
    a.getFabricCanvas().fire('mouse:dblclick', pointer(object, 0, 0));
    expect(callbacks.onPhotoPanChanged).not.toHaveBeenCalled();
  });

  it('ignores double clicks on other element types', () => {
    const a = new FabricCanvasAdapter(canvasEl, callbacks, {});
    adapter = a;
    a.setViewportSize(800, 600);
    a.render({ page: makePage([frame]), size, selectedIds: [], assets });
    a.getFabricCanvas().fire('mouse:dblclick', pointer(a.getFabricCanvas().getObjects()[1], 0, 0));
    // The photo is still loading (no bitmap yet), so there is nothing to pan.
    expect(callbacks.onPhotoPanChanged).not.toHaveBeenCalled();
  });
});
