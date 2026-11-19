import type { PathPoint } from '@opencanvas/document';

/**
 * Pure geometry for the path-based shapes in the Elements panel.
 *
 * Every helper returns points in page coordinates for a `side`×`side` box whose
 * top-left is (`x`, `y`). Keeping the maths here (instead of inline in actions)
 * makes each silhouette unit-testable without rendering the editor.
 */

function toPoints(
  unit: readonly (readonly [number, number])[],
  x: number,
  y: number,
  side: number,
): PathPoint[] {
  return unit.map(([ux, uy]) => ({ x: x + ux * side, y: y + uy * side }));
}

/** Regular polygon centred on (`cx`, `cy`). `startAngleDeg` defaults to pointing up. */
export function regularPolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  sides: number,
  startAngleDeg = -90,
): PathPoint[] {
  const points: PathPoint[] = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = ((startAngleDeg + (360 / sides) * i) * Math.PI) / 180;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}

/** Diamond (a square rotated 45°): top, right, bottom, left. */
export function diamondPoints(x: number, y: number, side: number): PathPoint[] {
  return toPoints(
    [
      [0.5, 0],
      [1, 0.5],
      [0.5, 1],
      [0, 0.5],
    ],
    x,
    y,
    side,
  );
}

export type ArrowDirection = 'right' | 'left' | 'up' | 'down' | 'both';

/**
 * Block arrows (shaft + triangular head) as a single closed polygon.
 * `both` is a horizontal double-headed arrow.
 */
export function arrowPoints(
  direction: ArrowDirection,
  x: number,
  y: number,
  side: number,
): PathPoint[] {
  const right: readonly (readonly [number, number])[] = [
    [0, 0.35],
    [0.6, 0.35],
    [0.6, 0.1],
    [1, 0.5],
    [0.6, 0.9],
    [0.6, 0.65],
    [0, 0.65],
  ];
  const left: readonly (readonly [number, number])[] = [
    [1, 0.35],
    [0.4, 0.35],
    [0.4, 0.1],
    [0, 0.5],
    [0.4, 0.9],
    [0.4, 0.65],
    [1, 0.65],
  ];
  const up: readonly (readonly [number, number])[] = [
    [0.35, 1],
    [0.35, 0.4],
    [0.1, 0.4],
    [0.5, 0],
    [0.9, 0.4],
    [0.65, 0.4],
    [0.65, 1],
  ];
  const down: readonly (readonly [number, number])[] = [
    [0.35, 0],
    [0.35, 0.6],
    [0.1, 0.6],
    [0.5, 1],
    [0.9, 0.6],
    [0.65, 0.6],
    [0.65, 0],
  ];
  const both: readonly (readonly [number, number])[] = [
    [0, 0.5],
    [0.2, 0.2],
    [0.2, 0.35],
    [0.8, 0.35],
    [0.8, 0.2],
    [1, 0.5],
    [0.8, 0.8],
    [0.8, 0.65],
    [0.2, 0.65],
    [0.2, 0.8],
  ];
  switch (direction) {
    case 'right':
      return toPoints(right, x, y, side);
    case 'left':
      return toPoints(left, x, y, side);
    case 'up':
      return toPoints(up, x, y, side);
    case 'down':
      return toPoints(down, x, y, side);
    case 'both':
      return toPoints(both, x, y, side);
  }
}

/** Heart from the classic parametric curve, sampled into a polyline. */
export function heartPoints(x: number, y: number, side: number): PathPoint[] {
  const samples = 36;
  const raw: [number, number][] = [];
  for (let i = 0; i < samples; i += 1) {
    const t = (i / samples) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    raw.push([hx, hy]);
  }
  const xs = raw.map(([hx]) => hx);
  const ys = raw.map(([, hy]) => hy);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  // Heart y grows upward in the formula; flip so the point faces down.
  return raw.map(([hx, hy]) => ({
    x: x + ((hx - minX) / rangeX) * side,
    y: y + (1 - (hy - minY) / rangeY) * side,
  }));
}

/** Plus / cross: a vertical bar and a horizontal bar as one outline. */
export function plusPoints(x: number, y: number, side: number): PathPoint[] {
  return toPoints(
    [
      [0.35, 0],
      [0.65, 0],
      [0.65, 0.35],
      [1, 0.35],
      [1, 0.65],
      [0.65, 0.65],
      [0.65, 1],
      [0.35, 1],
      [0.35, 0.65],
      [0, 0.65],
      [0, 0.35],
      [0.35, 0.35],
    ],
    x,
    y,
    side,
  );
}

/**
 * Crescent moon: an outer arc on the left and an inner arc on the right,
 * sampled so the polyline reads as a smooth crescent.
 */
export function moonPoints(x: number, y: number, side: number): PathPoint[] {
  const points: PathPoint[] = [];
  const outerCx = x + side * 0.5;
  const outerCy = y + side * 0.5;
  const outerR = side * 0.48;
  // Outer edge: from top (90°) around the left to bottom (270°).
  for (let i = 0; i <= 16; i += 1) {
    const angle = ((90 + (180 * i) / 16) * Math.PI) / 180;
    points.push({
      x: outerCx + outerR * Math.cos(angle),
      y: outerCy + outerR * Math.sin(angle),
    });
  }
  // Inner edge: back from bottom to top, bowed right.
  const innerCx = x + side * 0.68;
  const innerCy = y + side * 0.5;
  const innerR = side * 0.4;
  for (let i = 16; i >= 0; i -= 1) {
    const angle = ((90 + (180 * i) / 16) * Math.PI) / 180;
    points.push({
      x: innerCx + innerR * Math.cos(angle),
      y: innerCy + innerR * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Cloud: a flat bottom and a top edge made of two Gaussian bumps,
 * sampled into a smooth polyline.
 */
export function cloudPoints(x: number, y: number, side: number): PathPoint[] {
  const top: PathPoint[] = [];
  const steps = 24;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const bump =
      Math.exp(-(((t - 0.32) / 0.22) ** 2)) * 0.38 + Math.exp(-(((t - 0.68) / 0.26) ** 2)) * 0.46;
    const topY = 0.82 - bump;
    top.push({ x: x + t * side, y: y + topY * side });
  }
  // Bottom edge back to the start (flat, slightly inset so the ends round off).
  return [
    ...top,
    { x: x + side * 0.92, y: y + side * 0.82 },
    { x: x + side * 0.08, y: y + side * 0.82 },
  ];
}

/** Speech bubble: a rectangle with a triangular tail at the bottom. */
export function speechBubblePoints(x: number, y: number, side: number): PathPoint[] {
  return toPoints(
    [
      [0.08, 0.08],
      [0.92, 0.08],
      [0.92, 0.68],
      [0.52, 0.68],
      [0.32, 1],
      [0.32, 0.68],
      [0.08, 0.68],
    ],
    x,
    y,
    side,
  );
}

/** Ribbon banner: a central band with notched folded ends. */
export function ribbonPoints(x: number, y: number, side: number): PathPoint[] {
  return toPoints(
    [
      [0, 0.28],
      [0.18, 0.28],
      [0.18, 0.02],
      [0.82, 0.02],
      [0.82, 0.28],
      [1, 0.28],
      [1, 0.72],
      [0.82, 0.72],
      [0.82, 0.98],
      [0.18, 0.98],
      [0.18, 0.72],
      [0, 0.72],
    ],
    x,
    y,
    side,
  );
}
