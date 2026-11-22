import type { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { MAX_ZOOM } from '@opencanvas/editor-core';
import { render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it } from 'vitest';

import { usePinchZoom } from './usePinchZoom';

interface Gesture {
  zoom: number;
  focus: { x: number; y: number };
  panX: number;
  panY: number;
}

/**
 * Fabric does not run in jsdom, so the adapter is a recorder. Everything above it — claiming
 * the touches, the gesture maths, the slop, handing the canvas over and back — is real.
 */
function fakeAdapter() {
  const gestures: Gesture[] = [];
  const calls: string[] = [];
  let zoom = 1;
  const adapter = {
    getZoom: () => zoom,
    beginViewportGesture: () => calls.push('begin'),
    endViewportGesture: () => calls.push('end'),
    applyViewportGesture: (gesture: Gesture) => {
      gestures.push(gesture);
      zoom = gesture.zoom;
    },
  };
  return {
    gestures,
    calls,
    setZoom: (next: number) => {
      zoom = next;
    },
    ref: { current: adapter as unknown as FabricCanvasAdapter },
  };
}

function Harness({ adapterRef }: { adapterRef: { current: FabricCanvasAdapter | null } }) {
  const containerRef = useRef<HTMLDivElement>(null);
  usePinchZoom(containerRef, adapterRef);
  return <div ref={containerRef} data-testid="stage" style={{ width: 400, height: 400 }} />;
}

/** jsdom has no Touch constructor, and the hook only ever reads `touches`. */
function touch(type: string, points: { id: number; x: number; y: number }[]): Event {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'touches', {
    value: points.map((point) => ({
      identifier: point.id,
      clientX: point.x,
      clientY: point.y,
    })),
  });
  return event;
}

function setup() {
  const adapter = fakeAdapter();
  const { getByTestId } = render(<Harness adapterRef={adapter.ref} />);
  const stage = getByTestId('stage');
  // jsdom reports a zero rect; the hook subtracts it, so client coords are canvas coords.
  return { adapter, stage };
}

describe('pinching the canvas', () => {
  it('zooms by how far the fingers spread', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(touch('touchstart', [{ id: 1, x: 100, y: 200 }]));
    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 200 },
        { id: 2, x: 300, y: 200 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 50, y: 200 },
        { id: 2, x: 350, y: 200 },
      ]),
    );

    expect(adapter.gestures).toHaveLength(1);
    expect(adapter.gestures[0]?.zoom).toBeCloseTo(1.5, 5);
    // About the midpoint, so whatever was between the fingers stays between them.
    expect(adapter.gestures[0]?.focus).toEqual({ x: 200, y: 200 });
  });

  it('pans the view when two fingers move together', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 130, y: 140 },
        { id: 2, x: 230, y: 140 },
      ]),
    );

    const gesture = adapter.gestures[0];
    expect(gesture?.zoom).toBeCloseTo(1, 5);
    expect(gesture?.panX).toBe(30);
    expect(gesture?.panY).toBe(40);
  });

  it('leaves a single finger to the canvas, so dragging still works', () => {
    const { adapter, stage } = setup();

    const start = touch('touchstart', [{ id: 1, x: 100, y: 100 }]);
    stage.dispatchEvent(start);
    const move = touch('touchmove', [{ id: 1, x: 180, y: 160 }]);
    stage.dispatchEvent(move);

    expect(adapter.gestures).toHaveLength(0);
    expect(adapter.calls).toEqual([]);
    // Not claimed: Fabric still receives the event and moves the selected object.
    expect(move.defaultPrevented).toBe(false);
  });

  it('claims a two-finger touch away from the canvas', () => {
    const { stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    const move = touch('touchmove', [
      { id: 1, x: 60, y: 100 },
      { id: 2, x: 240, y: 100 },
    ]);
    stage.dispatchEvent(move);

    // Without this the browser pans the page and Fabric drags whatever is underneath.
    expect(move.defaultPrevented).toBe(true);
  });

  it('ignores two fingers resting on the glass', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 101, y: 100 },
        { id: 2, x: 201, y: 100 },
      ]),
    );

    expect(adapter.gestures).toHaveLength(0);
    expect(adapter.calls).toEqual([]);
  });

  it('hands the canvas over for the gesture and gives it back at the end', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 50, y: 100 },
        { id: 2, x: 250, y: 100 },
      ]),
    );
    expect(adapter.calls).toEqual(['begin']);

    stage.dispatchEvent(touch('touchend', [{ id: 1, x: 50, y: 100 }]));
    expect(adapter.calls).toEqual(['begin', 'end']);
  });

  it('keeps zooming across several moves instead of snapping back', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    for (const span of [150, 200, 300]) {
      stage.dispatchEvent(
        touch('touchmove', [
          { id: 1, x: 150 - span / 2, y: 100 },
          { id: 2, x: 150 + span / 2, y: 100 },
        ]),
      );
    }

    expect(adapter.gestures.map((gesture) => Number(gesture.zoom.toFixed(2)))).toEqual([1.5, 2, 3]);
  });

  it('stops at the zoom ceiling rather than running away', () => {
    const { adapter, stage } = setup();
    adapter.setZoom(MAX_ZOOM);

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 120, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 0, y: 100 },
        { id: 2, x: 400, y: 100 },
      ]),
    );

    expect(adapter.gestures[0]?.zoom).toBe(MAX_ZOOM);
  });

  it('survives a finger lifting mid-pinch and carries on with the rest', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
        { id: 3, x: 300, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 50, y: 100 },
        { id: 2, x: 250, y: 100 },
        { id: 3, x: 300, y: 100 },
      ]),
    );
    const zoomed = adapter.gestures.at(-1)?.zoom ?? 0;
    expect(zoomed).toBeCloseTo(2, 5);

    // Finger 1 goes; the gesture re-seeds on 2 and 3 without a jump.
    stage.dispatchEvent(
      touch('touchend', [
        { id: 2, x: 250, y: 100 },
        { id: 3, x: 300, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 2, x: 250, y: 100 },
        { id: 3, x: 350, y: 100 },
      ]),
    );
    expect(adapter.gestures.at(-1)?.zoom).toBeCloseTo(zoomed * 2, 5);
  });

  it('releases the canvas when the gesture is cancelled', () => {
    const { adapter, stage } = setup();

    stage.dispatchEvent(
      touch('touchstart', [
        { id: 1, x: 100, y: 100 },
        { id: 2, x: 200, y: 100 },
      ]),
    );
    stage.dispatchEvent(
      touch('touchmove', [
        { id: 1, x: 50, y: 100 },
        { id: 2, x: 250, y: 100 },
      ]),
    );
    stage.dispatchEvent(touch('touchcancel', []));

    expect(adapter.calls).toEqual(['begin', 'end']);
  });
});
