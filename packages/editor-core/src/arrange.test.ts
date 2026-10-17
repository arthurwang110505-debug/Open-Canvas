import { createRectElement, pageBounds } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { alignElements, alignmentTarget, distributeElements } from './arrange';

const page = { width: 1000, height: 500 };
const rect = (id: string, x: number, y: number, width = 100, height = 50, extra = {}) =>
  createRectElement({ id, x, y, width, height, ...extra });

describe('alignmentTarget', () => {
  it('uses the page for a single element and the selection box for several', () => {
    expect(alignmentTarget([rect('a', 10, 10)], page)).toEqual(pageBounds(page));
    const target = alignmentTarget([rect('a', 10, 10), rect('b', 300, 200)], page);
    expect(target).toMatchObject({ left: 10, top: 10, right: 400, bottom: 250 });
  });
});

describe('alignElements', () => {
  it('aligns a single element to each page edge and center', () => {
    const element = rect('a', 10, 10);
    const target = pageBounds(page);
    expect(alignElements([element], 'left', target)).toEqual([
      { elementId: 'a', patch: { x: 0, y: 10 } },
    ]);
    expect(alignElements([element], 'center', target)).toEqual([
      { elementId: 'a', patch: { x: 450, y: 10 } },
    ]);
    expect(alignElements([element], 'right', target)).toEqual([
      { elementId: 'a', patch: { x: 900, y: 10 } },
    ]);
    expect(alignElements([element], 'top', target)).toEqual([
      { elementId: 'a', patch: { x: 10, y: 0 } },
    ]);
    expect(alignElements([element], 'middle', target)).toEqual([
      { elementId: 'a', patch: { x: 10, y: 225 } },
    ]);
    expect(alignElements([element], 'bottom', target)).toEqual([
      { elementId: 'a', patch: { x: 10, y: 450 } },
    ]);
  });

  it('aligns several elements to their shared bounding box', () => {
    const elements = [rect('a', 10, 10), rect('b', 300, 200, 50, 50)];
    const target = alignmentTarget(elements, page);
    expect(alignElements(elements, 'right', target)).toEqual([
      { elementId: 'a', patch: { x: 250, y: 10 } },
    ]);
    expect(alignElements(elements, 'middle', target)).toEqual([
      { elementId: 'a', patch: { x: 10, y: 105 } },
      { elementId: 'b', patch: { x: 300, y: 105 } },
    ]);
  });

  it('uses the rotated bounding box, moving the element by translation only', () => {
    // 100x50 rotated 90° around its corner occupies x ∈ [x-50, x], so its left edge is 50.
    const element = rect('a', 100, 0, 100, 50, { rotation: 90 });
    const updates = alignElements([element], 'left', pageBounds(page));
    expect(updates).toEqual([{ elementId: 'a', patch: { x: 50, y: 0 } }]);
    expect(alignElements([element], 'top', pageBounds(page))).toEqual([]);
  });

  it('never moves locked elements', () => {
    const elements = [rect('a', 10, 10, 100, 50, { locked: true }), rect('b', 300, 200)];
    const target = alignmentTarget(elements, page);
    const updates = alignElements(elements, 'left', target);
    expect(updates.map((update) => update.elementId)).toEqual(['b']);
  });
});

describe('distributeElements', () => {
  it('needs at least three movable elements', () => {
    expect(distributeElements([rect('a', 0, 0), rect('b', 500, 0)], 'horizontal')).toEqual([]);
    expect(
      distributeElements(
        [rect('a', 0, 0), rect('b', 100, 0, 100, 50, { locked: true }), rect('c', 500, 0)],
        'horizontal',
      ),
    ).toEqual([]);
  });

  it('equalizes horizontal gaps and keeps the outer elements fixed', () => {
    const elements = [
      rect('a', 0, 0, 100, 50),
      rect('b', 120, 0, 50, 50),
      rect('c', 500, 0, 100, 50),
    ];
    const updates = distributeElements(elements, 'horizontal');
    // Span 0..600, occupied 250, two gaps of 175 → b starts at 275.
    expect(updates).toEqual([{ elementId: 'b', patch: { x: 275, y: 0 } }]);
  });

  it('distributes vertically regardless of input order', () => {
    const elements = [
      rect('c', 0, 400, 10, 100),
      rect('a', 0, 0, 10, 100),
      rect('b', 0, 110, 10, 100),
    ];
    const updates = distributeElements(elements, 'vertical');
    // Span 0..500, occupied 300, gaps of 100 → b starts at 200.
    expect(updates).toEqual([{ elementId: 'b', patch: { x: 0, y: 200 } }]);
  });

  it('returns nothing when gaps are already equal', () => {
    const elements = [rect('a', 0, 0), rect('b', 200, 0), rect('c', 400, 0)];
    expect(distributeElements(elements, 'horizontal')).toEqual([]);
  });
});
