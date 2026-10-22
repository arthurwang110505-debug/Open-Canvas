import { createImageElement, type ImageElement } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { cropAspect, cropScale, panCrop, resizeCrop, visibleSourceRect } from './crop';

const natural = { width: 400, height: 200 };

function image(overrides: Partial<Omit<ImageElement, 'type'>> = {}) {
  return createImageElement({
    id: 'img',
    assetId: 'asset_1',
    x: 100,
    y: 50,
    width: 200,
    height: 200,
    ...overrides,
  });
}

describe('crop geometry', () => {
  it('reports the window cover leaves visible and the scale it draws at', () => {
    const element = image();
    expect(visibleSourceRect(element, natural)).toEqual({ x: 100, y: 0, width: 200, height: 200 });
    expect(cropScale(element, natural)).toBe(1);
  });

  it('accounts for an existing crop window', () => {
    const element = image({ crop: { x: 0, y: 0, width: 0.5, height: 1 } });
    // The window is the left half (200x200 at 1:1), which is exactly what the square box shows.
    expect(visibleSourceRect(element, natural)).toEqual({ x: 0, y: 0, width: 200, height: 200 });
  });
});

describe('resizeCrop', () => {
  it('reveals photo on the side a handle drags, without moving the other edges', () => {
    const element = image();
    const layout = resizeCrop(element, natural, 'e', { x: 100, y: 50, width: 250, height: 200 });
    expect(layout.box).toEqual({ x: 100, y: 50, width: 250, height: 200 });
    // The left edge is still source x=100; the right edge moved 50px into the photo.
    expect(layout.crop).toEqual({ x: 0.25, y: 0, width: 0.625, height: 1 });
  });

  it('stops at the edge of the bitmap instead of showing empty space', () => {
    const element = image();
    const layout = resizeCrop(element, natural, 'e', { x: 100, y: 50, width: 900, height: 200 });
    // Only 300px of photo are left to the right of x=100.
    expect(layout.box).toEqual({ x: 100, y: 50, width: 300, height: 200 });
    expect(layout.crop).toEqual({ x: 0.25, y: 0, width: 0.75, height: 1 });
  });

  it('moves the box when the west or north edge is dragged', () => {
    const element = image();
    const layout = resizeCrop(element, natural, 'w', { x: 50, y: 50, width: 250, height: 200 });
    // Revealing 50px to the left moves the box left and drops the crop origin to 0.125.
    expect(layout.box).toEqual({ x: 50, y: 50, width: 250, height: 200 });
    expect(layout.crop).toMatchObject({ x: 0.125, width: 0.625 });

    const north = resizeCrop(element, natural, 'n', { x: 100, y: 80, width: 200, height: 170 });
    expect(north.box).toEqual({ x: 100, y: 80, width: 200, height: 170 });
    // Pulling the top edge down crops the picture rather than moving it.
    expect(north.crop).toMatchObject({ y: 0.15, height: 0.85 });
  });

  it('shrinks into a crop on a photo that had no overflow', () => {
    const square = image({ width: 200, height: 200 });
    const layout = resizeCrop(square, { width: 200, height: 200 }, 's', {
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    });
    expect(layout.box).toEqual({ x: 100, y: 50, width: 200, height: 150 });
    expect(layout.crop).toEqual({ x: 0, y: 0, width: 1, height: 0.75 });
  });

  it('refuses to shrink below the schema minimum', () => {
    const element = image();
    const layout = resizeCrop(element, natural, 'e', { x: 100, y: 50, width: 2, height: 200 });
    // 5% of 400px is the smallest window the document can store.
    expect(layout.box?.width ?? layout.box.width).toBe(20);
  });

  it('drops the crop once the whole photo fits again', () => {
    // A box exactly the photo's aspect and size: nothing is cropped away.
    const element = image({ width: 400, height: 200 });
    const layout = resizeCrop(element, natural, 'e', { x: 100, y: 50, width: 400, height: 200 });
    expect(layout.crop).toBeUndefined();
  });

  it('keeps the visible window stable across a resize', () => {
    const element = image();
    const layout = resizeCrop(element, natural, 'se', { x: 100, y: 50, width: 260, height: 240 });
    // Re-applying the result reproduces the same part of the photo at the new size.
    const resized = { ...element, ...layout.box, crop: layout.crop };
    const before = visibleSourceRect(element, natural);
    const after = visibleSourceRect(resized, natural);
    expect(after.width / after.height).toBeCloseTo(layout.box.width / layout.box.height, 2);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});

describe('cropAspect', () => {
  it('keeps a window that already has the ratio', () => {
    const element = image();
    const layout = cropAspect(element, natural, 1);
    expect(layout.box).toEqual({ x: 100, y: 50, width: 200, height: 200 });
  });

  it('reshapes towards the photo instead of zooming in', () => {
    // A 16:9 box over a 2:1 photo: 1:1 keeps the height and narrows the window.
    const element = image({ width: 320, height: 180 });
    const layout = cropAspect(element, natural, 1);
    expect(layout.box.width).toBe(layout.box.height);
    expect(layout.box.height).toBe(180);
    // Still centred on the photo.
    expect(layout.box.x + layout.box.width / 2).toBeCloseTo(100 + 160, 0);
    expect(layout.crop?.width).toBeCloseTo(0.5, 6);
    expect(layout.crop?.height).toBe(1);
  });

  it('stops at the bitmap when the ratio asks for more than exists', () => {
    const element = image({ width: 100, height: 200 });
    const layout = cropAspect(element, natural, 4);
    // A 4:1 window 200px tall would need 800px of a 400px photo: it takes the full width and
    // gives up the height instead, growing around the element's centre.
    expect(layout.box).toEqual({ x: -50, y: 100, width: 400, height: 100 });
    expect(layout.crop).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
  });

  it('widens a tall window into the photo when the ratio allows it', () => {
    const element = image({ width: 100, height: 200 });
    const layout = cropAspect(element, natural, 2);
    // 2:1 at the current height is 400 wide: exactly the photo.
    expect(layout.box.width).toBe(400);
    expect(layout.box.height).toBe(200);
    expect(layout.crop).toBeUndefined();
  });
});

describe('panCrop', () => {
  it('moves the window opposite to the drag and keeps the box', () => {
    const element = image();
    const layout = panCrop(element, natural, { x: 40, y: 0 });
    expect(layout.box).toEqual({ x: 100, y: 50, width: 200, height: 200 });
    expect(layout.crop).toEqual({ x: 0.15, y: 0, width: 0.5, height: 1 });
  });

  it('cannot pan when the whole photo is visible', () => {
    const element = image({ width: 400, height: 200 });
    expect(panCrop(element, natural, { x: 40, y: 0 }).crop).toBeUndefined();
  });
});
