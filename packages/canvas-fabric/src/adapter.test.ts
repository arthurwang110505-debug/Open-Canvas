import {
  createEllipseElement,
  createRectElement,
  createTextElement,
  linearFill,
  radialFill,
  type DesignElement,
  type Page,
} from '@opencanvas/document';
import { ActiveSelection, Gradient, Rect, Textbox } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { FabricCanvasAdapter, type CanvasAdapterCallbacks } from './adapter';

function makePage(elements: DesignElement[]): Page {
  return { id: 'page_1', background: { type: 'solid', color: '#fafafa' }, elements };
}

const size = { width: 1080, height: 1080 };

describe('FabricCanvasAdapter', () => {
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

  const elementObjects = () => adapter.getFabricCanvas().getObjects().slice(1);

  it('creates one Fabric object per element, positioned by center', () => {
    const rect = createRectElement({ id: 'r1', x: 100, y: 50, width: 200, height: 100 });
    adapter.render({ page: makePage([rect]), size, selectedIds: [], assets: {} });
    const objects = elementObjects();
    expect(objects).toHaveLength(1);
    const object = objects[0];
    expect(object).toBeInstanceOf(Rect);
    expect(object?.left).toBe(200);
    expect(object?.top).toBe(100);
    expect(object?.width).toBe(200);
    expect(object?.height).toBe(100);
    expect(object?.strokeWidth).toBe(0);
  });

  it('sizes the page background and clip path from the document size', () => {
    adapter.render({
      page: makePage([]),
      size: { width: 400, height: 300 },
      selectedIds: [],
      assets: {},
    });
    const background = adapter.getFabricCanvas().getObjects()[0];
    expect(background?.width).toBe(400);
    expect(background?.height).toBe(300);
    expect(background?.fill).toBe('#fafafa');
    expect(background?.selectable).toBe(false);
    expect(adapter.getFabricCanvas().clipPath?.width).toBe(400);
  });

  it('preserves object identity across renders and removes deleted elements', () => {
    const a = createRectElement({ id: 'a' });
    const b = createEllipseElement({ id: 'b' });
    adapter.render({ page: makePage([a, b]), size, selectedIds: [], assets: {} });
    const [objA, objB] = elementObjects();

    const movedA = { ...a, x: 500 };
    adapter.render({ page: makePage([movedA, b]), size, selectedIds: [], assets: {} });
    const [objA2, objB2] = elementObjects();
    expect(objA2).toBe(objA);
    expect(objB2).toBe(objB);
    expect(objA2?.left).toBe(600);

    adapter.render({ page: makePage([b]), size, selectedIds: [], assets: {} });
    expect(elementObjects()).toEqual([objB]);
  });

  it('keeps Fabric stacking order in sync with the element array', () => {
    const a = createRectElement({ id: 'a' });
    const b = createRectElement({ id: 'b' });
    const c = createRectElement({ id: 'c' });
    adapter.render({ page: makePage([a, b, c]), size, selectedIds: [], assets: {} });
    const [objA, objB, objC] = elementObjects();
    adapter.render({ page: makePage([c, a, b]), size, selectedIds: [], assets: {} });
    expect(elementObjects()).toEqual([objC, objA, objB]);
  });

  it('applies document selection without echoing it back', () => {
    const a = createRectElement({ id: 'a' });
    const b = createRectElement({ id: 'b' });
    adapter.render({ page: makePage([a, b]), size, selectedIds: ['a'], assets: {} });
    expect(adapter.getFabricCanvas().getActiveObject()).toBe(elementObjects()[0]);

    adapter.render({ page: makePage([a, b]), size, selectedIds: ['a', 'b'], assets: {} });
    expect(adapter.getFabricCanvas().getActiveObject()).toBeInstanceOf(ActiveSelection);
    expect(adapter.getFabricCanvas().getActiveObjects()).toHaveLength(2);

    adapter.render({ page: makePage([a, b]), size, selectedIds: [], assets: {} });
    expect(adapter.getFabricCanvas().getActiveObject()).toBeUndefined();
    expect(callbacks.onSelectionChanged).not.toHaveBeenCalled();
  });

  it('reports the selection box in client space so floating UI can follow the object', () => {
    expect(adapter.getSelectionClientRect()).toBeNull();

    const rect = createRectElement({ id: 'r1', x: 100, y: 50, width: 200, height: 100 });
    adapter.render({ page: makePage([rect]), size, selectedIds: ['r1'], assets: {} });

    const active = adapter.getFabricCanvas().getActiveObject();
    if (!active) throw new Error('expected an active object');
    const bounds = active.getBoundingRect();
    const client = adapter.getSelectionClientRect();
    expect(client).not.toBeNull();
    expect(client?.width).toBeCloseTo(bounds.width);
    expect(client?.height).toBeCloseTo(bounds.height);
    expect(client?.left).toBeCloseTo(bounds.left);
    expect(client?.top).toBeCloseTo(bounds.top);
  });

  it('signals viewport, pointer and text-editing changes to the host', () => {
    adapter.setZoom(2);
    expect(callbacks.onViewportChanged).toHaveBeenCalled();

    adapter.getFabricCanvas().fire('mouse:down');
    expect(callbacks.onInteractionChanged).toHaveBeenLastCalledWith(true);
    adapter.getFabricCanvas().fire('mouse:up');
    expect(callbacks.onInteractionChanged).toHaveBeenLastCalledWith(false);

    adapter.getFabricCanvas().fire('text:editing:entered');
    expect(callbacks.onTextEditingChanged).toHaveBeenLastCalledWith(true);
  });

  it('reports user selection changes', () => {
    const a = createRectElement({ id: 'a' });
    adapter.render({ page: makePage([a]), size, selectedIds: [], assets: {} });
    const object = elementObjects()[0];
    if (!object) throw new Error('missing object');
    adapter.getFabricCanvas().setActiveObject(object);
    expect(callbacks.onSelectionChanged).toHaveBeenLastCalledWith(['a']);
    adapter.getFabricCanvas().discardActiveObject();
    expect(callbacks.onSelectionChanged).toHaveBeenLastCalledWith([]);
  });

  it('translates a move interaction into a top-left patch', () => {
    const a = createRectElement({ id: 'a', x: 0, y: 0, width: 100, height: 50 });
    adapter.render({ page: makePage([a]), size, selectedIds: [], assets: {} });
    const object = elementObjects()[0];
    if (!object) throw new Error('missing object');
    // Simulate the end of a drag: Fabric has moved the object's center.
    object.set({ left: 300, top: 200 });
    object.setCoords();
    adapter.getFabricCanvas().fire('object:modified', { target: object });
    expect(callbacks.onElementsModified).toHaveBeenCalledTimes(1);
    expect(callbacks.onElementsModified).toHaveBeenCalledWith([
      { elementId: 'a', patch: { x: 250, y: 175, width: 100, height: 50, rotation: 0 } },
    ]);
  });

  it('bakes scaling into width/height and normalizes rotation', () => {
    const a = createRectElement({ id: 'a', x: 0, y: 0, width: 100, height: 50 });
    adapter.render({ page: makePage([a]), size, selectedIds: [], assets: {} });
    const object = elementObjects()[0];
    if (!object) throw new Error('missing object');
    object.set({ scaleX: 2, scaleY: 3, angle: -90 });
    object.setCoords();
    adapter.getFabricCanvas().fire('object:modified', { target: object });
    const changes = callbacks.onElementsModified.mock.calls[0]?.[0];
    expect(changes?.[0]?.patch).toMatchObject({ width: 200, height: 150, rotation: 270 });
  });

  it('reports every member of a multi-selection transform', () => {
    const a = createRectElement({ id: 'a', x: 0, y: 0, width: 100, height: 100 });
    const b = createRectElement({ id: 'b', x: 200, y: 0, width: 100, height: 100 });
    adapter.render({ page: makePage([a, b]), size, selectedIds: ['a', 'b'], assets: {} });
    const selection = adapter.getFabricCanvas().getActiveObject();
    if (!(selection instanceof ActiveSelection)) throw new Error('expected selection');
    selection.set({ left: selection.left + 50, top: selection.top + 10 });
    selection.setCoords();
    adapter.getFabricCanvas().fire('object:modified', { target: selection });
    const changes = callbacks.onElementsModified.mock.calls[0]?.[0] ?? [];
    expect(changes.map((c) => c.elementId)).toEqual(['a', 'b']);
    expect(changes[0]?.patch).toMatchObject({ x: 50, y: 10 });
    expect(changes[1]?.patch).toMatchObject({ x: 250, y: 10 });
  });

  it('does not emit modifications while applying state', () => {
    const a = createRectElement({ id: 'a' });
    adapter.render({ page: makePage([a]), size, selectedIds: [], assets: {} });
    adapter.render({ page: makePage([{ ...a, x: 10 }]), size, selectedIds: ['a'], assets: {} });
    expect(callbacks.onElementsModified).not.toHaveBeenCalled();
    expect(callbacks.onSelectionChanged).not.toHaveBeenCalled();
  });

  it('renders text with a Textbox and reports its measured height', () => {
    const text = createTextElement({ id: 't', text: 'Hello', height: 1 });
    adapter.render({ page: makePage([text]), size, selectedIds: [], assets: {} });
    const object = elementObjects()[0];
    expect(object).toBeInstanceOf(Textbox);
    expect(callbacks.onTextMeasured).toHaveBeenCalledWith('t', expect.any(Number));
    const measured = callbacks.onTextMeasured.mock.calls[0]?.[1];
    expect(measured).toBeGreaterThan(1);
  });

  it('commits edited text when editing ends', () => {
    const text = createTextElement({ id: 't', text: 'Hello' });
    adapter.render({ page: makePage([text]), size, selectedIds: [], assets: {} });
    const object = elementObjects()[0];
    if (!(object instanceof Textbox)) throw new Error('expected textbox');
    // Drive the real editing lifecycle instead of firing synthetic events.
    object.enterEditing();
    object.set({ text: 'Edited' });
    object.exitEditing();
    expect(callbacks.onTextCommitted).toHaveBeenCalledWith('t', 'Edited', expect.any(Number));
  });

  it('replaces the Fabric object when an element changes type', () => {
    const rect = createRectElement({ id: 'x' });
    adapter.render({ page: makePage([rect]), size, selectedIds: [], assets: {} });
    const ellipse = createEllipseElement({ id: 'x' });
    adapter.render({ page: makePage([ellipse]), size, selectedIds: [], assets: {} });
    expect(elementObjects()).toHaveLength(1);
    expect(elementObjects()[0]).not.toBeInstanceOf(Rect);
  });

  it('zooms around the viewport and reports the level', () => {
    adapter.render({ page: makePage([]), size, selectedIds: [], assets: {} });
    adapter.setZoom(2);
    expect(adapter.getZoom()).toBe(2);
    expect(callbacks.onZoomChanged).toHaveBeenLastCalledWith(2);
    adapter.setZoom(100);
    expect(adapter.getZoom()).toBe(8);
  });

  it('maps client coordinates to page coordinates through zoom and pan', () => {
    adapter.render({ page: makePage([]), size, selectedIds: [], assets: {} });
    adapter.getFabricCanvas().setViewportTransform([2, 0, 0, 2, 100, 50]);
    // jsdom reports a 0x0 box at the origin for the canvas element.
    expect(adapter.clientToPage(100, 50)).toEqual({ x: 0, y: 0 });
    expect(adapter.clientToPage(300, 250)).toEqual({ x: 100, y: 100 });
  });

  it('paints gradient fills with a Fabric gradient in percentage units', () => {
    const rect = createRectElement({
      id: 'grad_rect',
      x: 0,
      y: 0,
      width: 300,
      height: 150,
      fill: linearFill(90, ['#0f172a', '#38bdf8']),
    });
    adapter.render({ page: makePage([rect]), size, selectedIds: [], assets: {} });

    const object = elementObjects()[0];
    expect(object?.fill).toBeInstanceOf(Gradient);
    const gradient = object?.fill as Gradient<'linear'>;
    expect(gradient.type).toBe('linear');
    // Fractions, not pixels: resizing the shape must not move the gradient's endpoints.
    expect(gradient.gradientUnits).toBe('percentage');
    expect(gradient.coords.x1).toBeCloseTo(0);
    expect(gradient.coords.x2).toBeCloseTo(1);
    expect(gradient.colorStops.map((stop) => stop.color)).toEqual(['#0f172a', '#38bdf8']);
  });

  it('reuses a gradient while the fill is unchanged and replaces it when it changes', () => {
    const render = (fill: ReturnType<typeof linearFill>) => {
      const rect = createRectElement({ id: 'grad_rect', width: 200, height: 100, fill });
      adapter.render({ page: makePage([rect]), size, selectedIds: [], assets: {} });
      return elementObjects()[0];
    };

    const first = render(linearFill(90, ['#000000', '#ffffff']));
    const samePaint = render(linearFill(90, ['#000000', '#ffffff']));
    // Same element and same paint: the existing object (and its gradient) is kept.
    expect(samePaint).toBe(first);

    const different = render(linearFill(180, ['#000000', '#ffffff']));
    expect(different).toBe(first);
    const gradient = different?.fill as Gradient<'linear'>;
    expect(gradient.coords.y1).toBeCloseTo(0);
    expect(gradient.coords.y2).toBeCloseTo(1);
  });

  it('paints a radial gradient background behind the elements', () => {
    const page: Page = {
      id: 'page_1',
      background: radialFill(['#ffffff', '#c7d2fe']),
      elements: [createRectElement({ id: 'r1' })],
    };
    adapter.render({ page, size, selectedIds: [], assets: {} });

    const background = adapter.getFabricCanvas().getObjects()[0];
    expect(background?.fill).toBeInstanceOf(Gradient);
    expect((background?.fill as Gradient<'radial'>).type).toBe('radial');
  });

  it('keeps the page white rather than transparent when the background is none', () => {
    const page: Page = { id: 'page_1', background: { type: 'none' }, elements: [] };
    adapter.render({ page, size, selectedIds: [], assets: {} });
    expect(adapter.getFabricCanvas().getObjects()[0]?.fill).toBe('#ffffff');
  });

  it('fits the page into the viewport with padding', () => {
    adapter.render({ page: makePage([]), size, selectedIds: [], assets: {} });
    adapter.fitToViewport(40);
    // viewport 800x600, page 1080x1080 -> limited by height: (600-80)/1080
    expect(adapter.getZoom()).toBeCloseTo(520 / 1080, 5);
    const vpt = adapter.getFabricCanvas().viewportTransform;
    expect(vpt[4]).toBeCloseTo((800 - 1080 * (520 / 1080)) / 2, 5);
    expect(vpt[5]).toBeCloseTo(40, 5);
  });
});
