import type { PageGuide } from '@opencanvas/document';

export interface SnapRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AxisRect {
  start: number;
  end: number;
  size: number;
}

function axisRect(rect: SnapRect, axis: 'x' | 'y'): AxisRect {
  const start = axis === 'x' ? rect.left : rect.top;
  const size = axis === 'x' ? rect.width : rect.height;
  return { start, end: start + size, size };
}

/** Returns the smallest useful correction on one axis, or zero when nothing is in range. */
function snapAxis(
  moving: AxisRect,
  others: readonly AxisRect[],
  positions: readonly number[],
  threshold: number,
): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  const consider = (delta: number) => {
    const distance = Math.abs(delta);
    if (distance <= threshold && distance < bestDistance) {
      best = delta;
      bestDistance = distance;
    }
  };

  // Custom page guides snap either edge or the center of the dragged bounding box.
  for (const position of positions) {
    consider(position - moving.start);
    consider(position - moving.size / 2 - moving.start);
    consider(position - moving.size - moving.start);
  }

  // Between two neighbors, center the moving box in the available space so both gaps match.
  let left: AxisRect | undefined;
  let right: AxisRect | undefined;
  for (const other of others) {
    if (other.end <= moving.start + threshold && (!left || other.end > left.end)) left = other;
    if (other.start >= moving.end - threshold && (!right || other.start < right.start)) {
      right = other;
    }
  }
  if (left && right && right.start - left.end >= moving.size) {
    consider((left.end + right.start - moving.size) / 2 - moving.start);
  }

  return best;
}

/** Guide and equal-gap snapping in page coordinates; standard alignment remains Fabric's job. */
export function snapMovingBox(
  moving: SnapRect,
  others: readonly SnapRect[],
  guides: readonly PageGuide[],
  threshold: number,
): { dx: number; dy: number } {
  return {
    dx: snapAxis(
      axisRect(moving, 'x'),
      others.map((other) => axisRect(other, 'x')),
      guides.filter((guide) => guide.axis === 'vertical').map((guide) => guide.position),
      threshold,
    ),
    dy: snapAxis(
      axisRect(moving, 'y'),
      others.map((other) => axisRect(other, 'y')),
      guides.filter((guide) => guide.axis === 'horizontal').map((guide) => guide.position),
      threshold,
    ),
  };
}
