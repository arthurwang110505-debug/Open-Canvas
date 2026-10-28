import {
  createFrameElement,
  createGroupElement,
  createImageAsset,
  createImageElement,
  createRectElement,
  type DesignDocument,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { FabricImage, Group, Rect } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import {
  FabricCanvasAdapter,
  type CanvasAdapterCallbacks,
  type ImageSourceLoader,
} from './adapter';

const size = { width: 1000, height: 1000 };
const asset = createImageAsset({
  id: 'asset_group',
  name: 'group-photo.png',
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

describe('FabricCanvasAdapter groups', () => {
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

  function create(loadImage: ImageSourceLoader = () => Promise.resolve(bitmap(400, 200))) {
    adapter = new FabricCanvasAdapter(canvasEl, callbacks, {
      resolveAssetUrl: (record) => Promise.resolve(`blob:test/${record.id}`),
      loadImage,
    });
    adapter.setViewportSize(800, 600);
    return adapter;
  }

  function topLevelGroup(a: FabricCanvasAdapter): Group {
    const object = a.getFabricCanvas().getObjects()[1];
    if (!(object instanceof Group)) throw new Error('expected a Fabric group');
    return object;
  }

  it('loads real bitmaps for grouped images and filled frames without moving their boxes', async () => {
    const a = create();
    const image = createImageElement({
      id: 'img',
      assetId: asset.id,
      x: 150,
      y: 20,
      width: 200,
      height: 200,
    });
    const frame = createFrameElement({
      id: 'frame',
      assetId: asset.id,
      x: 400,
      y: 20,
      width: 160,
      height: 160,
    });
    const group = createGroupElement(
      [createRectElement({ id: 'rect', width: 100, height: 100 }), image, frame],
      { id: 'group' },
    );

    a.render({ page: makePage([group]), size, selectedIds: [], assets });

    const object = topLevelGroup(a);
    const children = object.getObjects();
    const groupedImage = children[1];
    const groupedFrame = children[2];
    expect(children[0]).toBeInstanceOf(Rect);
    expect(groupedImage).toBeInstanceOf(FabricImage);
    expect(groupedFrame).toBeInstanceOf(FabricImage);
    if (!(groupedImage instanceof FabricImage) || !(groupedFrame instanceof FabricImage)) return;
    expect(a.getImageStatus('img')).toBe('loading');
    expect(a.getImageStatus('frame')).toBe('loading');
    const positions = [groupedImage, groupedFrame].map((child) => ({
      left: child.left,
      top: child.top,
    }));

    await vi.waitFor(() => {
      expect(a.getImageStatus('img')).toBe('ready');
      expect(a.getImageStatus('frame')).toBe('ready');
    });

    for (const [index, child] of [groupedImage, groupedFrame].entries()) {
      expect(child.getElement().width).toBe(400);
      expect(child.getElement().height).toBe(200);
      expect(child.cropX).toBe(100);
      expect(child.left).toBe(positions[index]?.left);
      expect(child.top).toBe(positions[index]?.top);
      expect(child.selectable).toBe(false);
      expect(child.evented).toBe(false);
    }
    expect(groupedFrame.clipPath).toBeInstanceOf(Rect);
    expect(callbacks.onAssetError).not.toHaveBeenCalled();
  });

  it('reuses decoded images through group and ungroup reconciliation', async () => {
    const loadImage = vi.fn<ImageSourceLoader>(() => Promise.resolve(bitmap(400, 200)));
    const a = create(loadImage);
    const rect = createRectElement({ id: 'rect', width: 100, height: 100 });
    const image = createImageElement({
      id: 'img',
      assetId: asset.id,
      x: 150,
      y: 20,
      width: 200,
      height: 200,
    });
    const group = createGroupElement([rect, image], { id: 'group' });

    a.render({ page: makePage([rect, image]), size, selectedIds: [], assets });
    await vi.waitFor(() => expect(a.getImageStatus('img')).toBe('ready'));
    expect(loadImage).toHaveBeenCalledTimes(1);

    a.render({ page: makePage([group]), size, selectedIds: [], assets });
    const groupedImage = topLevelGroup(a).getObjects()[1];
    expect(groupedImage).toBeInstanceOf(FabricImage);
    if (!(groupedImage instanceof FabricImage)) return;
    expect(a.getImageStatus('img')).toBe('ready');
    expect(groupedImage.getElement().width).toBe(400);
    expect(loadImage).toHaveBeenCalledTimes(1);

    const ungrouped = group.children.map((child) => ({
      ...child,
      x: child.x + group.x,
      y: child.y + group.y,
    }));
    a.render({ page: makePage(ungrouped), size, selectedIds: [], assets });
    const topLevelImage = a.getFabricCanvas().getObjects()[2];
    expect(topLevelImage).toBeInstanceOf(FabricImage);
    if (!(topLevelImage instanceof FabricImage)) return;
    expect(topLevelImage.getElement().width).toBe(400);
    expect(a.getImageStatus('img')).toBe('ready');
    expect(loadImage).toHaveBeenCalledTimes(1);
  });

  it('loads a photo nested more than one group deep', async () => {
    const a = create();
    const nested = createGroupElement(
      [
        createRectElement({ id: 'rect', width: 100, height: 100 }),
        createImageElement({ id: 'img', assetId: asset.id, x: 150, width: 200, height: 200 }),
      ],
      { id: 'nested' },
    );
    const outer = createGroupElement(
      [nested, createRectElement({ id: 'outer-rect', x: 400, width: 80, height: 80 })],
      { id: 'outer' },
    );

    a.render({ page: makePage([outer]), size, selectedIds: [], assets });

    await vi.waitFor(() => expect(a.getImageStatus('img')).toBe('ready'));
    const nestedObject = topLevelGroup(a).getObjects()[0];
    expect(nestedObject).toBeInstanceOf(Group);
    if (!(nestedObject instanceof Group)) return;
    const image = nestedObject.getObjects()[1];
    expect(image).toBeInstanceOf(FabricImage);
    if (!(image instanceof FabricImage)) return;
    expect(image.getElement().width).toBe(400);
    expect(image.getElement().height).toBe(200);
  });

  it('rebuilds changed group children and releases removed image loads', async () => {
    const a = create();
    const group = createGroupElement(
      [
        createRectElement({ id: 'rect', width: 100, height: 100 }),
        createImageElement({ id: 'img', assetId: asset.id, x: 150, width: 200, height: 200 }),
      ],
      { id: 'group' },
    );
    a.render({ page: makePage([group]), size, selectedIds: [], assets });
    const initial = topLevelGroup(a);
    await vi.waitFor(() => expect(a.getImageStatus('img')).toBe('ready'));

    const rect = group.children[0];
    if (!rect) throw new Error('expected the rectangle child');
    const changed = { ...group, children: [rect] };
    a.render({ page: makePage([changed]), size, selectedIds: [], assets });

    const rebuilt = topLevelGroup(a);
    expect(rebuilt).not.toBe(initial);
    expect(rebuilt.getObjects()).toHaveLength(1);
    expect(a.getImageStatus('img')).toBeUndefined();
  });
});
