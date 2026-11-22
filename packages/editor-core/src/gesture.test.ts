import { describe, expect, it } from 'vitest';

import { beginPinch, pinchExceedsSlop, updatePinch, type TouchPoint, PINCH_SLOP } from './gesture';
import { MAX_ZOOM, MIN_ZOOM } from './zoom';

const at = (id: number, x: number, y: number): TouchPoint => ({ id, x, y });

describe('starting a pinch', () => {
  it('needs two fingers', () => {
    expect(beginPinch([], 1)).toBeNull();
    expect(beginPinch([at(1, 10, 10)], 1)).toBeNull();
    expect(beginPinch([at(1, 0, 0), at(2, 100, 0)], 1)).not.toBeNull();
  });

  it('waits for two fingers in the same spot to separate', () => {
    // Zero span carries no scale information; dividing by it would send the zoom to infinity.
    expect(beginPinch([at(1, 50, 50), at(2, 50, 50)], 1)).toBeNull();
  });

  it('remembers the fingers it adopted, the span, and the zoom it started from', () => {
    const state = beginPinch([at(7, 0, 0), at(9, 60, 80)], 2);
    expect(state?.ids).toEqual([7, 9]);
    expect(state?.distance).toBe(100);
    expect(state?.center).toEqual({ x: 30, y: 40 });
    expect(state?.zoom).toBe(2);
  });

  it('ignores a third finger rather than tracking a moving target', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0), at(3, 50, 50)], 1);
    expect(state?.ids).toEqual([1, 2]);
  });
});

describe('moving the fingers', () => {
  it('zooms by how much the span changed', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    const update = updatePinch(state!, [at(1, 0, 0), at(2, 200, 0)]);
    expect(update?.zoom).toBeCloseTo(2, 5);

    const back = updatePinch(update!.state, [at(1, 0, 0), at(2, 100, 0)]);
    expect(back?.zoom).toBeCloseTo(1, 5);
  });

  it('zooms about the point between the fingers, so the content stays under them', () => {
    const state = beginPinch([at(1, 100, 100), at(2, 300, 100)], 1);
    const update = updatePinch(state!, [at(1, 50, 100), at(2, 350, 100)]);
    expect(update?.focus).toEqual({ x: 200, y: 100 });
  });

  it('pans when the fingers move together without spreading', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    const update = updatePinch(state!, [at(1, 40, 25), at(2, 140, 25)]);
    expect(update?.zoom).toBeCloseTo(1, 5);
    expect(update?.panX).toBe(40);
    expect(update?.panY).toBe(25);
  });

  it('pans and zooms at once when the fingers do both', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    const update = updatePinch(state!, [at(1, 50, 0), at(2, 250, 0)]);
    expect(update?.zoom).toBeCloseTo(2, 5);
    expect(update?.panX).toBe(100);
  });

  it('ends the gesture when a tracked finger lifts', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    expect(updatePinch(state!, [at(1, 0, 0)])).toBeNull();
    expect(updatePinch(state!, [])).toBeNull();
    // A different finger landing is not a substitute for the one that left.
    expect(updatePinch(state!, [at(1, 0, 0), at(5, 100, 0)])).toBeNull();
  });

  it('keeps following the same two fingers while a third wanders about', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    const update = updatePinch(state!, [at(3, 500, 500), at(2, 200, 0), at(1, 0, 0)]);
    expect(update?.zoom).toBeCloseTo(2, 5);
  });
});

describe('the zoom limits', () => {
  it('cannot be pinched past the maximum', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 10, 0)], MAX_ZOOM);
    const update = updatePinch(state!, [at(1, 0, 0), at(2, 2000, 0)]);
    expect(update?.zoom).toBe(MAX_ZOOM);
  });

  it('cannot be pinched below the minimum', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 1000, 0)], MIN_ZOOM);
    const update = updatePinch(state!, [at(1, 0, 0), at(2, 5, 0)]);
    expect(update?.zoom).toBe(MIN_ZOOM);
  });

  it('responds immediately when the fingers reverse at the limit', () => {
    // Zoom banked past the limit would have to be unwound before anything moved, which feels
    // like the gesture has jammed. The state tracks the clamped value instead.
    let state = beginPinch([at(1, 0, 0), at(2, 100, 0)], MAX_ZOOM)!;
    state = updatePinch(state, [at(1, 0, 0), at(2, 400, 0)])!.state;
    const back = updatePinch(state, [at(1, 0, 0), at(2, 200, 0)]);
    expect(back?.zoom).toBeCloseTo(MAX_ZOOM / 2, 5);
  });
});

describe('telling a gesture from a rest', () => {
  it('ignores two fingers that have barely moved', () => {
    const state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1);
    const update = updatePinch(state!, [at(1, 1, 0), at(2, 101, 0)]);
    expect(pinchExceedsSlop(update!.state)).toBe(false);
  });

  it('counts a drag once the fingers have travelled far enough', () => {
    let state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1)!;
    state = updatePinch(state, [at(1, PINCH_SLOP, 0), at(2, 100 + PINCH_SLOP, 0)])!.state;
    expect(pinchExceedsSlop(state)).toBe(true);
  });

  it('counts a spread even when the midpoint never moves', () => {
    let state = beginPinch([at(1, -50, 0), at(2, 50, 0)], 1)!;
    state = updatePinch(state, [at(1, -53, 0), at(2, 53, 0)])!.state;
    expect(state.travel).toBe(0);
    expect(pinchExceedsSlop(state)).toBe(true);
  });

  it('accumulates small movements rather than forgetting them', () => {
    let state = beginPinch([at(1, 0, 0), at(2, 100, 0)], 1)!;
    for (let step = 1; step <= 4; step += 1) {
      state = updatePinch(state, [at(1, step * 2, 0), at(2, 100 + step * 2, 0)])!.state;
    }
    expect(state.travel).toBe(8);
    expect(pinchExceedsSlop(state)).toBe(true);
  });
});
