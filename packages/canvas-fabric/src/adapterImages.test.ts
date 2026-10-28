import {
  createImageAsset,
  createImageElement,
  createRectElement,
  type DesignDocument,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { FabricImage, type ImageSource } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

const containing = (text: string): string => expect.stringContaining(text) as string;

import {
  FabricCanvasAdapter,
  type CanvasAdapterCallbacks,
  type CanvasAdapterOptions,
  type ImageSourceLoader,
} from './adapter';
import { PLACEHOLDER_SIZE } from './placeholder';

const size = { width: 1000, height: 1000 };
const asset = createImageAsset({
  id: 'asset_1',
  name: 'photo.png',
  mimeType: 'image/png',
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('FabricCanvasAdapter images', () => {
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

  function create(options: CanvasAdapterOptions = {}): FabricCanvasAdapter {
    adapter = new FabricCanvasAdapter(canvasEl, callbacks, {
      resolveAssetUrl: (a) => Promise.resolve(`blob:test/${a.id}`),
      loadImage: () => Promise.resolve(bitmap(asset.width, asset.height)),
      ...options,
    });
    adapter.setViewportSize(800, 600);
    return adapter;
  }

  const imageObject = (a: FabricCanvasAdapter, index = 1): FabricImage => {
    const object = a.getFabricCanvas().getObjects()[index];
    // `instanceof` narrows to the generic-less class; the adapter only creates plain images.
    if (!object || !(object instanceof FabricImage)) throw new Error('expected a FabricImage');
    return object as FabricImage;
  };

  const image = createImageElement({
    id: 'img',
    assetId: asset.id,
    x: 100,
    y: 100,
    width: 200,
    height: 200,
  });

  it('shows a placeholder immediately and swaps in the bitmap with cover cropping', async () => {
    const a = create();
    a.render({ page: makePage([image]), size, selectedIds: [], assets });

    const object = imageObject(a);
    expect(a.getImageStatus('img')).toBe('loading');
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);
    // Placeholder is stretched over the whole box.
    expect(object.width).toBe(PLACEHOLDER_SIZE);
    expect(object.scaleX).toBe(200 / PLACEHOLDER_SIZE);
    expect(object.strokeWidth).toBe(0);

    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });
    // Same Fabric object, now showing a 400x200 bitmap covered into a 200x200 box.
    expect(imageObject(a)).toBe(object);
    expect(object.getElement().width).toBe(400);
    expect(object.scaleX).toBe(1);
    expect(object.scaleY).toBe(1);
    expect(object.width).toBe(200);
    expect(object.height).toBe(200);
    expect(object.cropX).toBe(100);
    expect(object.cropY).toBe(0);
    expect(object.left).toBe(200);
    expect(object.top).toBe(200);
    expect(callbacks.onAssetError).not.toHaveBeenCalled();
  });

  it('switches fit without reloading the bitmap', async () => {
    const loadImage = vi.fn<ImageSourceLoader>(() => Promise.resolve(bitmap(400, 200)));
    const a = create({ loadImage });
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });

    a.render({ page: makePage([{ ...image, fit: 'fill' }]), size, selectedIds: [], assets });
    const object = imageObject(a);
    expect(object.width).toBe(400);
    expect(object.height).toBe(200);
    expect(object.cropX).toBe(0);
    expect(object.scaleX).toBe(0.5);
    expect(object.scaleY).toBe(1);
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('reloads when the element points at a different asset', async () => {
    const second = createImageAsset({
      id: 'asset_2',
      mimeType: 'image/png',
      width: 10,
      height: 10,
    });
    const loadImage = vi.fn<ImageSourceLoader>((url) =>
      Promise.resolve(url.endsWith('asset_2') ? bitmap(10, 10) : bitmap(400, 200)),
    );
    const a = create({ loadImage });
    const both = { ...assets, [second.id]: second };
    a.render({ page: makePage([image]), size, selectedIds: [], assets: both });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });

    a.render({
      page: makePage([{ ...image, assetId: 'asset_2' }]),
      size,
      selectedIds: [],
      assets: both,
    });
    expect(a.getImageStatus('img')).toBe('loading');
    await vi.waitFor(() => {
      expect(imageObject(a).getElement().width).toBe(10);
    });
    expect(loadImage).toHaveBeenCalledTimes(2);
    expect(imageObject(a).scaleX).toBe(20);
  });

  it('reports missing asset records and shows the error placeholder', () => {
    const a = create();
    a.render({ page: makePage([image]), size, selectedIds: [], assets: {} });
    expect(a.getImageStatus('img')).toBe('error');
    expect(callbacks.onAssetError).toHaveBeenCalledWith(
      'img',
      asset.id,
      expect.objectContaining({ code: 'asset-missing' }),
    );
    // The element is still on the canvas and keeps its footprint.
    const object = imageObject(a);
    expect(object.scaleX).toBe(200 / PLACEHOLDER_SIZE);
  });

  it('reports unavailable bytes when the resolver yields null', async () => {
    const a = create({ resolveAssetUrl: () => Promise.resolve(null) });
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('error');
    });
    expect(callbacks.onAssetError).toHaveBeenCalledWith(
      'img',
      asset.id,
      expect.objectContaining({
        code: 'unavailable',
        message: containing('photo.png'),
      }),
    );
  });

  it('reports load failures once and does not retry on every render', async () => {
    const loadImage = vi.fn<ImageSourceLoader>(() => Promise.reject(new Error('corrupt')));
    const a = create({ loadImage });
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('error');
    });
    expect(callbacks.onAssetError).toHaveBeenCalledTimes(1);
    expect(callbacks.onAssetError.mock.calls[0]?.[2]).toEqual({
      code: 'load-failed',
      message: containing('corrupt'),
    });

    a.render({ page: makePage([{ ...image, x: 150 }]), size, selectedIds: [], assets });
    await Promise.resolve();
    expect(loadImage).toHaveBeenCalledTimes(1);
    expect(callbacks.onAssetError).toHaveBeenCalledTimes(1);
    expect(imageObject(a).left).toBe(250);
  });

  it('fails clearly when no resolver is configured', async () => {
    adapter = new FabricCanvasAdapter(canvasEl, callbacks);
    adapter.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(callbacks.onAssetError).toHaveBeenCalledWith(
        'img',
        asset.id,
        expect.objectContaining({
          code: 'unavailable',
          message: containing('resolver'),
        }),
      );
    });
  });

  it('ignores loads that finish after the element was removed', async () => {
    const pending = deferred<ImageSource>();
    const a = create({ loadImage: () => pending.promise });
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    expect(a.getImageStatus('img')).toBe('loading');

    a.render({ page: makePage([]), size, selectedIds: [], assets });
    expect(a.getImageStatus('img')).toBeUndefined();
    pending.resolve(bitmap(400, 200));
    await pending.promise;
    await Promise.resolve();
    expect(a.getFabricCanvas().getObjects()).toHaveLength(1);
    expect(callbacks.onAssetError).not.toHaveBeenCalled();
  });

  it('aborts in-flight loads on dispose', async () => {
    const signals: AbortSignal[] = [];
    const pending = deferred<ImageSource>();
    const a = create({
      loadImage: (_url, { signal }) => {
        signals.push(signal);
        return pending.promise;
      },
    });
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(signals).toHaveLength(1);
    });
    expect(signals[0]?.aborted).toBe(false);
    a.dispose();
    adapter = null;
    expect(signals[0]?.aborted).toBe(true);
  });

  it('keeps stacking order while images load', async () => {
    const a = create();
    const below = createRectElement({ id: 'below' });
    const above = createRectElement({ id: 'above' });
    a.render({ page: makePage([below, image, above]), size, selectedIds: [], assets });
    const order = () => a.getFabricCanvas().getObjects().slice(1);
    expect(order()[1]).toBeInstanceOf(FabricImage);
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });
    expect(order()[1]).toBeInstanceOf(FabricImage);
    expect(order()).toHaveLength(3);
  });

  it('translates a scaled image back into box geometry', async () => {
    const a = create();
    a.render({ page: makePage([image]), size, selectedIds: [], assets });
    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
    });
    const object = imageObject(a);
    // Simulate the user dragging a corner: Fabric multiplies the existing scale.
    object.set({ scaleX: object.scaleX * 1.5, scaleY: object.scaleY * 1.5, left: 250, top: 250 });
    object.setCoords();
    a.getFabricCanvas().fire('object:modified', { target: object });
    expect(callbacks.onElementsModified).toHaveBeenCalledTimes(1);
    expect(callbacks.onElementsModified.mock.calls[0]?.[0]).toEqual([
      { elementId: 'img', patch: { x: 100, y: 100, width: 300, height: 300, rotation: 0 } },
    ]);
  });

  it('exposes a snapping toggle backed by the aligning guidelines extension', () => {
    const a = create();
    expect(a.isSnappingEnabled()).toBe(true);
    a.setSnapping(false);
    expect(a.isSnappingEnabled()).toBe(false);
    a.setSnapping(true);
    expect(a.isSnappingEnabled()).toBe(true);
    a.dispose();
    adapter = null;
    const off = new FabricCanvasAdapter(canvasEl, callbacks, { snapping: false });
    expect(off.isSnappingEnabled()).toBe(false);
    off.dispose();
  });
});
