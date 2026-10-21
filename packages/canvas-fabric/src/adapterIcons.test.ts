import { createIconElement, type DesignElement, type Page } from '@opencanvas/document';
import { Group, Path } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { FabricCanvasAdapter, type CanvasAdapterCallbacks } from './adapter';

function makePage(elements: DesignElement[]): Page {
  return { id: 'page_1', background: { type: 'solid', color: '#ffffff' }, elements };
}

const size = { width: 1080, height: 1080 };

describe('FabricCanvasAdapter icons', () => {
  let canvasEl: HTMLCanvasElement;
  let callbacks: {
    [K in keyof CanvasAdapterCallbacks]: Mock<NonNullable<CanvasAdapterCallbacks[K]>>;
  };
  let adapter: FabricCanvasAdapter;

  beforeEach(() => {
    canvasEl = document.createElement('canvas');
    document.body.appendChild(canvasEl);
    callbacks = {
      onElementsModified: vi.fn<CanvasAdapterCallbacks['onElementsModified']>(),
      onTextCommitted: vi.fn<CanvasAdapterCallbacks['onTextCommitted']>(),
      onTextMeasured: vi.fn<CanvasAdapterCallbacks['onTextMeasured']>(),
      onSelectionChanged: vi.fn<CanvasAdapterCallbacks['onSelectionChanged']>(),
      onZoomChanged: vi.fn<CanvasAdapterCallbacks['onZoomChanged']>(),
      onViewportChanged: vi.fn<NonNullable<CanvasAdapterCallbacks['onViewportChanged']>>(),
      onInteractionChanged: vi.fn<NonNullable<CanvasAdapterCallbacks['onInteractionChanged']>>(),
      onTextEditingChanged: vi.fn<NonNullable<CanvasAdapterCallbacks['onTextEditingChanged']>>(),
      onAssetError: vi.fn<CanvasAdapterCallbacks['onAssetError']>(),
    };
    adapter = new FabricCanvasAdapter(canvasEl, callbacks);
    adapter.setViewportSize(800, 600);
  });

  afterEach(() => {
    adapter.dispose();
    canvasEl.remove();
  });

  const iconObject = () => adapter.getFabricCanvas().getObjects()[1] as Group | undefined;

  it('draws an icon as paths on its 24-unit grid, scaled onto the box', () => {
    const icon = createIconElement({
      id: 'i1',
      x: 100,
      y: 80,
      iconId: 'heart',
      width: 240,
      height: 120,
    });
    adapter.render({ page: makePage([icon]), size, selectedIds: [], assets: {} });

    const group = iconObject();
    expect(group).toBeInstanceOf(Group);
    // 240×120 element → 10×5 grid scale, centred on the element's centre like every object.
    expect(group?.scaleX).toBeCloseTo(10);
    expect(group?.scaleY).toBeCloseTo(5);
    expect(group?.left).toBe(220);
    expect(group?.top).toBe(140);

    const paths = group?.getObjects().filter((child) => child instanceof Path) ?? [];
    expect(paths.length).toBeGreaterThan(0);
    expect(paths[0]?.stroke).toBe('#111827');
    expect(paths[0]?.strokeWidth).toBe(2);
  });

  it('rebuilds the paths when the icon or its colour changes', () => {
    const heart = createIconElement({ id: 'i1', iconId: 'heart' });
    adapter.render({ page: makePage([heart]), size, selectedIds: [], assets: {} });
    const first = iconObject();

    // Only the colour changes: the geometry is baked into the paths, so the object is replaced.
    const red = { ...heart, color: '#ef4444' };
    adapter.render({ page: makePage([red]), size, selectedIds: [], assets: {} });
    const second = iconObject();
    expect(second).not.toBe(first);
    expect(second?.getObjects()[0]?.stroke).toBe('#ef4444');

    // A pure move keeps the object: no needless rebuild on every drag frame.
    const moved = { ...red, x: 40, y: 40 };
    adapter.render({ page: makePage([moved]), size, selectedIds: [], assets: {} });
    expect(iconObject()).toBe(second);
    expect(iconObject()?.left).toBe(40 + 96);
  });

  it('reports the icon box when it is resized, not the grid size', () => {
    const icon = createIconElement({ id: 'i1', iconId: 'star', width: 96, height: 96 });
    adapter.render({ page: makePage([icon]), size, selectedIds: ['i1'], assets: {} });
    const group = iconObject();
    if (!group) throw new Error('expected an icon object');

    group.set({ scaleX: group.scaleX * 2, scaleY: group.scaleY * 2 });
    group.setCoords();
    adapter.getFabricCanvas().fire('object:modified', { target: group });

    const [change] = callbacks.onElementsModified.mock.calls[0]?.[0] ?? [];
    expect(change?.elementId).toBe('i1');
    expect(change?.patch.width).toBeCloseTo(192);
    expect(change?.patch.height).toBeCloseTo(192);
  });

  it('renders nothing for an icon id this build does not know, but keeps it selectable', () => {
    const icon = createIconElement({ id: 'i1', iconId: 'future-icon' });
    adapter.render({ page: makePage([icon]), size, selectedIds: [], assets: {} });
    const group = iconObject();
    expect(group).toBeInstanceOf(Group);
    expect(group?.getObjects().filter((child) => child instanceof Path)).toHaveLength(0);
  });
});
