import type { PageGuide } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { snapMovingBox, type SnapRect } from './snapping';

const box = (left: number, top = 0, width = 40, height = 40): SnapRect => ({
  left,
  top,
  width,
  height,
});

describe('custom snapping', () => {
  it('snaps either edge or the center to a page guide', () => {
    const guides: PageGuide[] = [
      { id: 'v', axis: 'vertical', position: 100, kind: 'margin' },
      { id: 'h', axis: 'horizontal', position: 200, kind: 'bleed' },
    ];
    expect(snapMovingBox(box(95), [], guides, 6).dx).toBe(5);
    expect(snapMovingBox(box(74), [], guides, 6).dx).toBe(6);
    expect(snapMovingBox(box(65), [], guides, 6).dx).toBe(-5);
    expect(snapMovingBox(box(0, 154, 40, 40), [], guides, 6).dy).toBe(6);
  });

  it('equalizes the gaps between the nearest neighbors on either side', () => {
    const result = snapMovingBox(box(108, 0, 40), [box(0, 0, 50), box(200, 0, 40)], [], 6);
    // Center at 105 leaves 55px on each side.
    expect(result.dx).toBe(-3);
  });

  it('does nothing when no guide or equal gap is within the threshold', () => {
    expect(snapMovingBox(box(20), [], [], 6)).toEqual({ dx: 0, dy: 0 });
  });
});
