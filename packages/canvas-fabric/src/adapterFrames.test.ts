import {
  createFrameElement,
  createImageAsset,
  type DesignDocument,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { Ellipse, FabricImage, Rect } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { FabricCanvasAdapter, type CanvasAdapterCallbacks } from './adapter';

const size = { width: 1000, height: 1000 };
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

function bitmap(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

describe('FabricCanvasAdapter frames', () => {
  let canvasEl: HTMLCanvasElement;
  let callbacks: {
    [K in keyof CanvasAdapterCallbacks]: Mock<NonNullable<CanvasAdapterCallbacks[K]>>;
  };
  let adapter: FabricCanvasAdapter | null = null;

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

  function create(): FabricCanvasAdapter {
    adapter = new FabricCanvasAdapter(canvasEl, callbacks, {
      resolveAssetUrl: (a) => Promise.resolve(`blob:test/${a.id}`),
      loadImage: () => Promise.resolve(bitmap(asset.width, asset.height)),
    });
    adapter.setViewportSize(800, 600);
    return adapter;
  }

  const objectOf = (a: FabricCanvasAdapter) => a.getFabricCanvas().getObjects()[1];

  it('draws an empty frame as its shape with the placeholder fill', () => {
    const a = create();
    const frame = createFrameElement({
      id: 'f',
      x: 100,
      y: 100,
      width: 300,
      height: 200,
      cornerRadius: 24,
      fill: { type: 'solid', color: '#cbd5e1' },
    });
    a.render({ page: makePage([frame]), size, selectedIds: [], assets });

    const object = objectOf(a);
    expect(object).toBeInstanceOf(Rect);
    if (!(object instanceof Rect)) return;
    expect(object.get('rx')).toBe(24);
    expect(object.width).toBe(300);
    expect(object.height).toBe(200);
    expect(object.fill).toBe('#cbd5e1');
    // An empty frame never asks for an image to load.
    expect(a.getImageStatus('f')).toBeUndefined();
  });

  it('draws an empty elliptical frame as an ellipse', () => {
    const a = create();
    const frame = createFrameElement({ id: 'f', width: 300, height: 200, shape: 'ellipse' });
    a.render({ page: makePage([frame]), size, selectedIds: [], assets });
    const object = objectOf(a);
    expect(object).toBeInstanceOf(Ellipse);
    if (!(object instanceof Ellipse)) return;
    expect(object.rx).toBe(150);
    expect(object.ry).toBe(100);
  });

  it('fills a frame with a cover-cropped photo under a mask', async () => {
    const a = create();
    const frame = createFrameElement({
      id: 'f',
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      assetId: asset.id,
    });
    a.render({ page: makePage([frame]), size, selectedIds: [], assets });

    const object = objectOf(a);
    expect(object).toBeInstanceOf(FabricImage);
    expect(a.getImageStatus('f')).toBe('loading');

    await vi.waitFor(() => {
      expect(a.getImageStatus('f')).toBe('ready');
    });
    if (!(object instanceof FabricImage)) throw new Error('expected a FabricImage');
    // The same cover maths as an image element: a 400x200 photo covered into a 200x200 box.
    expect(object.getElement().width).toBe(400);
    expect(object.width).toBe(200);
    expect(object.height).toBe(200);
    expect(object.cropX).toBe(100);
    expect(object.cropY).toBe(0);
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);
    // The mask is the frame's own shape, centred on the object.
    expect(object.clipPath).toBeInstanceOf(Rect);
    const clip = object.clipPath as Rect;
    expect(clip.width).toBe(200);
    expect(clip.height).toBe(200);
    expect(clip.left).toBe(0);
    expect(clip.top).toBe(0);
    expect(callbacks.onAssetError).not.toHaveBeenCalled();
  });

  it('re-masks when the photo changes and returns to a shape when it is cleared', async () => {
    const a = create();
    const filled = createFrameElement({ id: 'f', width: 200, height: 200, assetId: asset.id });
    a.render({ page: makePage([filled]), size, selectedIds: [], assets });
    const image = objectOf(a);
    expect(image).toBeInstanceOf(FabricImage);

    // Changing only the fit keeps the object and re-lays out the photo.
    a.render({ page: makePage([{ ...filled, fit: 'fill' }]), size, selectedIds: [], assets });
    expect(objectOf(a)).toBe(image);

    // Removing the photo cannot be expressed by the image object, so it is replaced.
    const empty = { ...filled, assetId: undefined };
    a.render({ page: makePage([empty]), size, selectedIds: [], assets });
    const shape = objectOf(a);
    expect(shape).toBeInstanceOf(Rect);
    expect(shape).not.toBe(image);

    // And adding it back replaces the shape again, reusing the cached bitmap.
    a.render({ page: makePage([filled]), size, selectedIds: [], assets });
    expect(objectOf(a)).toBeInstanceOf(FabricImage);
    await vi.waitFor(() => {
      expect(a.getImageStatus('f')).toBe('ready');
    });
  });

  it('reports a photo whose asset is missing without dropping the frame', () => {
    const a = create();
    const frame = createFrameElement({ id: 'f', width: 200, height: 200, assetId: 'nope' });
    a.render({ page: makePage([frame]), size, selectedIds: [], assets });
    expect(callbacks.onAssetError).toHaveBeenCalledWith(
      'f',
      'nope',
      expect.objectContaining({ code: 'asset-missing' }),
    );
    expect(objectOf(a)).toBeInstanceOf(FabricImage);
  });
});
