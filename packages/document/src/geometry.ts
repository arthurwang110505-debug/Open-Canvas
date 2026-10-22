/**
 * Axis-aligned geometry helpers shared by alignment tools, exporters and hit-testing.
 * Rotation follows the document convention: degrees, clockwise, around the top-left corner.
 */

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export interface BoxLike {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

const DEG_TO_RAD = Math.PI / 180;

export function boundsFromEdges(left: number, top: number, right: number, bottom: number): Bounds {
  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

/**
 * Endpoints of a CSS-style linear gradient inside a unit box (objectBoundingBox coordinates),
 * given an angle in degrees where 0 points up and 90 points right. The line runs through the
 * centre and is long enough for the gradient to reach every corner, per the CSS Images spec.
 */
export function linearGradientCoords(angle: number): {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
} {
  const radians = (angle * Math.PI) / 180;
  const dx = Math.sin(radians);
  const dy = -Math.cos(radians);
  const length = Math.abs(dx) + Math.abs(dy);
  return {
    x1: 0.5 - (dx * length) / 2,
    y1: 0.5 - (dy * length) / 2,
    x2: 0.5 + (dx * length) / 2,
    y2: 0.5 + (dy * length) / 2,
  };
}

/** Smallest axis-aligned box containing the (possibly rotated) element. */
export function getElementBounds(box: BoxLike): Bounds {
  if (box.rotation % 360 === 0) {
    return boundsFromEdges(box.x, box.y, box.x + box.width, box.y + box.height);
  }
  const rad = box.rotation * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [0, 0],
    [box.width, 0],
    [box.width, box.height],
    [0, box.height],
  ].map(([cx = 0, cy = 0]) => ({
    x: box.x + cx * cos - cy * sin,
    y: box.y + cx * sin + cy * cos,
  }));
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return boundsFromEdges(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
}

/** Union of several bounds. Throws for an empty list because an empty union has no position. */
export function unionBounds(list: readonly Bounds[]): Bounds {
  const first = list[0];
  if (!first) throw new Error('unionBounds requires at least one bounds object.');
  let { left, top, right, bottom } = first;
  for (const bounds of list.slice(1)) {
    left = Math.min(left, bounds.left);
    top = Math.min(top, bounds.top);
    right = Math.max(right, bounds.right);
    bottom = Math.max(bottom, bounds.bottom);
  }
  return boundsFromEdges(left, top, right, bottom);
}

export function pageBounds(size: { width: number; height: number }): Bounds {
  return boundsFromEdges(0, 0, size.width, size.height);
}
