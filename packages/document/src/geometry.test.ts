import { describe, expect, it } from 'vitest';

import { getElementBounds, pageBounds, unionBounds } from './geometry';

describe('getElementBounds', () => {
  it('returns the box itself when not rotated', () => {
    expect(getElementBounds({ x: 10, y: 20, width: 100, height: 50, rotation: 0 })).toEqual({
      left: 10,
      top: 20,
      right: 110,
      bottom: 70,
      width: 100,
      height: 50,
      centerX: 60,
      centerY: 45,
    });
  });

  it('swaps extents for a 90° rotation around the top-left corner', () => {
    const bounds = getElementBounds({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    // Rotating clockwise moves the box to the left of the origin: x ∈ [-50, 0], y ∈ [0, 100].
    expect(bounds.left).toBeCloseTo(-50);
    expect(bounds.right).toBeCloseTo(0);
    expect(bounds.top).toBeCloseTo(0);
    expect(bounds.bottom).toBeCloseTo(100);
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(100);
  });

  it('grows the axis-aligned box for a 45° rotation', () => {
    const side = 100;
    const bounds = getElementBounds({ x: 0, y: 0, width: side, height: side, rotation: 45 });
    const diagonal = side * Math.SQRT2;
    expect(bounds.width).toBeCloseTo(diagonal);
    expect(bounds.height).toBeCloseTo(diagonal);
    expect(bounds.top).toBeCloseTo(0);
    expect(bounds.centerX).toBeCloseTo(0);
  });

  it('treats full turns as unrotated', () => {
    expect(getElementBounds({ x: 5, y: 5, width: 10, height: 10, rotation: 360 }).left).toBe(5);
  });
});

describe('unionBounds / pageBounds', () => {
  it('unions bounds and exposes center', () => {
    const union = unionBounds([
      getElementBounds({ x: 0, y: 0, width: 10, height: 10, rotation: 0 }),
      getElementBounds({ x: 50, y: 20, width: 10, height: 30, rotation: 0 }),
    ]);
    expect(union).toMatchObject({ left: 0, top: 0, right: 60, bottom: 50, centerX: 30 });
  });

  it('rejects an empty union', () => {
    expect(() => unionBounds([])).toThrow(/at least one/);
  });

  it('describes the page as bounds', () => {
    expect(pageBounds({ width: 1080, height: 1920 })).toMatchObject({
      right: 1080,
      bottom: 1920,
      centerX: 540,
      centerY: 960,
    });
  });
});
