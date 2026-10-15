import {
  getElementBounds,
  pageBounds,
  unionBounds,
  type Bounds,
  type DesignElement,
} from '@opencanvas/document';

export type AlignMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type DistributeAxis = 'horizontal' | 'vertical';

export interface PositionUpdate {
  elementId: string;
  patch: { x: number; y: number };
}

const EPSILON = 0.005;

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Elements that alignment tools may move. Locked elements keep their position. */
export function movableElements(elements: readonly DesignElement[]): DesignElement[] {
  return elements.filter((element) => !element.locked);
}

/**
 * What a selection aligns against: the page for a single element, the selection's own
 * bounding box for several (the convention design tools share).
 */
export function alignmentTarget(
  elements: readonly DesignElement[],
  pageSize: { width: number; height: number },
): Bounds {
  if (elements.length <= 1) return pageBounds(pageSize);
  return unionBounds(elements.map(getElementBounds));
}

function shiftFor(
  element: DesignElement,
  mode: AlignMode,
  target: Bounds,
): { dx: number; dy: number } {
  const bounds = getElementBounds(element);
  switch (mode) {
    case 'left':
      return { dx: target.left - bounds.left, dy: 0 };
    case 'center':
      return { dx: target.centerX - bounds.centerX, dy: 0 };
    case 'right':
      return { dx: target.right - bounds.right, dy: 0 };
    case 'top':
      return { dx: 0, dy: target.top - bounds.top };
    case 'middle':
      return { dx: 0, dy: target.centerY - bounds.centerY };
    case 'bottom':
      return { dx: 0, dy: target.bottom - bounds.bottom };
  }
}

/**
 * Position patches that align the movable elements to `target`. Elements are translated, so
 * rotation and size are untouched; elements already in place produce no update.
 */
export function alignElements(
  elements: readonly DesignElement[],
  mode: AlignMode,
  target: Bounds,
): PositionUpdate[] {
  const updates: PositionUpdate[] = [];
  for (const element of movableElements(elements)) {
    const { dx, dy } = shiftFor(element, mode, target);
    if (Math.abs(dx) < EPSILON && Math.abs(dy) < EPSILON) continue;
    updates.push({
      elementId: element.id,
      patch: { x: round(element.x + dx), y: round(element.y + dy) },
    });
  }
  return updates;
}

/**
 * Spreads three or more movable elements so the gaps between their bounding boxes are equal
 * along one axis. The outermost elements stay where they are.
 */
export function distributeElements(
  elements: readonly DesignElement[],
  axis: DistributeAxis,
): PositionUpdate[] {
  const movable = movableElements(elements);
  if (movable.length < 3) return [];

  const items = movable
    .map((element) => ({ element, bounds: getElementBounds(element) }))
    .sort((a, b) =>
      axis === 'horizontal'
        ? a.bounds.centerX - b.bounds.centerX || a.bounds.left - b.bounds.left
        : a.bounds.centerY - b.bounds.centerY || a.bounds.top - b.bounds.top,
    );
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return [];

  const extent = (bounds: Bounds) => (axis === 'horizontal' ? bounds.width : bounds.height);
  const start = axis === 'horizontal' ? first.bounds.left : first.bounds.top;
  const end = axis === 'horizontal' ? last.bounds.right : last.bounds.bottom;
  const occupied = items.reduce((sum, item) => sum + extent(item.bounds), 0);
  const gap = (end - start - occupied) / (items.length - 1);

  const updates: PositionUpdate[] = [];
  let cursor = start;
  items.forEach((item, index) => {
    const isEdge = index === 0 || index === items.length - 1;
    if (!isEdge) {
      const currentStart = axis === 'horizontal' ? item.bounds.left : item.bounds.top;
      const delta = cursor - currentStart;
      if (Math.abs(delta) >= EPSILON) {
        updates.push({
          elementId: item.element.id,
          patch: {
            x: round(item.element.x + (axis === 'horizontal' ? delta : 0)),
            y: round(item.element.y + (axis === 'vertical' ? delta : 0)),
          },
        });
      }
    }
    cursor += extent(item.bounds) + gap;
  });
  return updates;
}
