import { createRectElement, type DesignElement, type Page } from '@opencanvas/document';
import type { FabricObject } from 'fabric';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FabricCanvasAdapter } from './adapter';

const size = { width: 1000, height: 1000 };

function makePage(elements: DesignElement[]): Page {
  return { id: 'page_1', background: { type: 'solid', color: '#ffffff' }, elements, guides: [] };
}

function mouse(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    button: 0,
    altKey: true,
  });
}

describe('FabricCanvasAdapter Alt-drag duplication', () => {
  let canvasElement: HTMLCanvasElement;
  let adapter: FabricCanvasAdapter | null = null;

  beforeEach(() => {
    canvasElement = document.createElement('canvas');
    document.body.appendChild(canvasElement);
  });

  afterEach(() => {
    adapter?.dispose();
    adapter = null;
    canvasElement.remove();
  });

  it('re-resolves Fabric’s cached target and moves the copy instead of the original', () => {
    const original = createRectElement({ id: 'original', width: 100, height: 100 });
    let elements: DesignElement[] = [original];
    const onElementsModified = vi.fn();
    const onDuplicateRequested = vi.fn((ids: readonly string[]) => {
      const copies = ids.map((id) => {
        const source = elements.find((element) => element.id === id);
        if (!source) throw new Error(`missing source ${id}`);
        return { ...source, id: `copy-${id}` };
      });
      elements = [...elements, ...copies];
      adapter?.render({
        page: makePage(elements),
        size,
        selectedIds: ['copy-original'],
        assets: {},
      });
      return true;
    });

    adapter = new FabricCanvasAdapter(canvasElement, {
      onElementsModified,
      onDuplicateRequested,
      onTextCommitted: vi.fn(),
      onTextMeasured: vi.fn(),
      onSelectionChanged: vi.fn(),
      onZoomChanged: vi.fn(),
      onAssetError: vi.fn(),
    });
    adapter.setViewportSize(800, 600);
    adapter.render({
      page: makePage(elements),
      size,
      selectedIds: ['original'],
      assets: {},
    });

    const canvas = adapter.getFabricCanvas();
    const internal = canvas as unknown as {
      _onMouseDown: (event: MouseEvent) => void;
      _onMouseMove: (event: MouseEvent) => void;
      _onMouseUp: (event: MouseEvent) => void;
      _currentTransform: { target: FabricObject } | null;
    };
    const originalObject = canvas.getObjects()[1];
    if (!originalObject) throw new Error('expected source object');

    internal._onMouseDown(mouse('mousedown', 50, 50));
    const copyObject = canvas.getObjects()[2];
    if (!copyObject) throw new Error('expected copied object');
    expect(onDuplicateRequested).toHaveBeenCalledWith(['original']);
    expect(internal._currentTransform?.target).toBe(copyObject);

    internal._onMouseMove(mouse('mousemove', 80, 70));
    internal._onMouseUp(mouse('mouseup', 80, 70));

    expect(originalObject.left).toBe(50);
    expect(originalObject.top).toBe(50);
    expect(copyObject.left).toBe(80);
    expect(copyObject.top).toBe(70);
    expect(onElementsModified).toHaveBeenCalledTimes(1);
    expect(onElementsModified).toHaveBeenCalledWith([
      {
        elementId: 'copy-original',
        patch: { x: 30, y: 20, width: 100, height: 100, rotation: 0 },
      },
    ]);
  });

  it('duplicates and moves every object in a multi-selection', () => {
    const first = createRectElement({ id: 'first', width: 100, height: 100 });
    const second = createRectElement({ id: 'second', x: 200, width: 100, height: 100 });
    let elements: DesignElement[] = [first, second];
    const onElementsModified = vi.fn();
    const onDuplicateRequested = vi.fn((ids: readonly string[]) => {
      const copies = ids.map((id) => {
        const source = elements.find((element) => element.id === id);
        if (!source) throw new Error(`missing source ${id}`);
        return { ...source, id: `copy-${id}` };
      });
      elements = [...elements, ...copies];
      adapter?.render({
        page: makePage(elements),
        size,
        selectedIds: copies.map((copy) => copy.id),
        assets: {},
      });
      return true;
    });

    adapter = new FabricCanvasAdapter(canvasElement, {
      onElementsModified,
      onDuplicateRequested,
      onTextCommitted: vi.fn(),
      onTextMeasured: vi.fn(),
      onSelectionChanged: vi.fn(),
      onZoomChanged: vi.fn(),
      onAssetError: vi.fn(),
    });
    adapter.setViewportSize(800, 600);
    adapter.render({
      page: makePage(elements),
      size,
      selectedIds: ['first', 'second'],
      assets: {},
    });

    const canvas = adapter.getFabricCanvas();
    const internal = canvas as unknown as {
      _onMouseDown: (event: MouseEvent) => void;
      _onMouseMove: (event: MouseEvent) => void;
      _onMouseUp: (event: MouseEvent) => void;
      _currentTransform: { target: FabricObject } | null;
    };
    internal._onMouseDown(mouse('mousedown', 50, 50));

    const copyFirst = canvas.getObjects()[3];
    const copySecond = canvas.getObjects()[4];
    if (!copyFirst || !copySecond) throw new Error('expected copied objects');
    expect(onDuplicateRequested).toHaveBeenCalledWith(['first', 'second']);
    expect(internal._currentTransform?.target).toBe(canvas.getActiveObject());

    internal._onMouseMove(mouse('mousemove', 80, 70));
    internal._onMouseUp(mouse('mouseup', 80, 70));

    expect(canvas.getObjects()[1]?.left).toBe(50);
    expect(canvas.getObjects()[2]?.left).toBe(250);
    // ActiveSelection stores child positions relative to its own center; transforms are absolute.
    expect(copyFirst.calcTransformMatrix()[4]).toBe(80);
    expect(copyFirst.calcTransformMatrix()[5]).toBe(70);
    expect(copySecond.calcTransformMatrix()[4]).toBe(280);
    expect(copySecond.calcTransformMatrix()[5]).toBe(70);
    expect(onElementsModified).toHaveBeenCalledTimes(1);
    expect(onElementsModified).toHaveBeenCalledWith([
      {
        elementId: 'copy-first',
        patch: { x: 30, y: 20, width: 100, height: 100, rotation: 0 },
      },
      {
        elementId: 'copy-second',
        patch: { x: 230, y: 20, width: 100, height: 100, rotation: 0 },
      },
    ]);
  });
});
