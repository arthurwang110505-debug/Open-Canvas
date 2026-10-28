import {
  createImageAsset,
  createImageElement,
  type DesignDocument,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { FabricImage } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { FabricCanvasAdapter, type CanvasAdapterCallbacks } from './adapter';

const size = { width: 2000, height: 2000 };
const asset = createImageAsset({
  id: 'asset_wide',
  name: 'wide.webp',
  mimeType: 'image/webp',
  width: 400,
  height: 200,
});
const assets: DesignDocument['assets'] = { [asset.id]: asset };

function makePage(elements: DesignElement[]): Page {
  return { id: 'page_1', background: { type: 'solid', color: '#ffffff' }, elements, guides: [] };
}

function bitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('FabricCanvasAdapter crop editing', () => {
  let canvasEl: HTMLCanvasElement;
  let callbacks: {
    [K in keyof CanvasAdapterCallbacks]: Mock<NonNullable<CanvasAdapterCallbacks[K]>>;
  };
  let adapter: FabricCanvasAdapter | null = null;

  const image = createImageElement({
    id: 'img',
    assetId: asset.id,
    x: 100,
    y: 100,
    width: 200,
    height: 200,
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
    };
  });

  afterEach(() => {
    adapter?.dispose();
    adapter = null;
    canvasEl.remove();
  });

  /** Renders a single cropped-able image and waits for its bitmap. */
  async function create(
    element = image,
  ): Promise<{ adapter: FabricCanvasAdapter; object: FabricImage }> {
    const a = new FabricCanvasAdapter(canvasEl, callbacks, {
      resolveAssetUrl: (record) => Promise.resolve(`blob:test/${record.id}`),
      loadImage: () => Promise.resolve(bitmap(asset.width, asset.height)),
    });
    adapter = a;
    a.setViewportSize(800, 600);
    a.render({ page: makePage([element]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });
    const object = a.getFabricCanvas().getObjects()[1];
    if (!(object instanceof FabricImage)) throw new Error('expected an image element');
    return { adapter: a, object: object as FabricImage };
  }

  it('draws the whole bitmap while cropping, so a handle can reveal more photo', async () => {
    const { adapter: a, object } = await create();
    expect(a.beginCropEdit('img')).toBe(true);

    // The uncropped bitmap at the crop scale: 200px box over a 200px window → scale 1.
    expect(object.width).toBe(400);
    expect(object.height).toBe(200);
    expect(object.cropX).toBe(0);
    expect(object.cropY).toBe(0);
    expect(object.scaleX).toBe(1);
    // Centred like every other object: the bitmap spans page x 0..400, so the visible window
    // (source x 100..300) still sits exactly on the box (page 100..300).
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);
    expect(object.selectable).toBe(false);
    expect(object.evented).toBe(false);
  });

  it('previews a dragged box without touching the document', async () => {
    const { adapter: a, object } = await create();
    a.beginCropEdit('img');

    a.previewCrop({ box: { x: 100, y: 100, width: 300, height: 200 } });
    // The window grew to 300 source px at the same scale, so the bitmap is drawn as wide as
    // before and simply follows the wider box.
    expect(object.left).toBe(250);
    expect(object.width).toBe(400);
  });

  it('restores the element when the crop ends', async () => {
    const { adapter: a, object } = await create();
    a.beginCropEdit('img');
    a.previewCrop({ box: { x: 100, y: 100, width: 300, height: 200 } });

    a.endCropEdit();
    expect(object.width).toBe(200);
    expect(object.height).toBe(200);
    expect(object.cropX).toBe(100);
    expect(object.selectable).toBe(true);
    expect(object.evented).toBe(true);
  });

  it('keeps the crop view through a page render', async () => {
    const { adapter: a, object } = await create();
    a.beginCropEdit('img');
    // Any other state change re-renders the page; the crop view must survive it.
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    expect(object.width).toBe(400);
    expect(object.selectable).toBe(false);
  });

  it('keeps the visible window on the box for a rotated image', async () => {
    const rotated = { ...image, rotation: 90 };
    const { adapter: a, object } = await create(rotated);
    a.beginCropEdit('img');

    // 90°: the bitmap's own centre offset turns with it, so the object's centre does too.
    expect(object.angle).toBe(90);
    expect(object.width).toBe(400);
    // Box centre is (200, 200); the window centre is the bitmap centre, so no offset applies.
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);
  });

  it('refuses to crop anything but a loaded image', async () => {
    const { adapter: a } = await create();
    expect(a.beginCropEdit('missing')).toBe(false);
  });
});
