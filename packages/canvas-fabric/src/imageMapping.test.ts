import { createImageElement } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import {
  computeImageFit,
  elementToFabricProps,
  geometryFromTransform,
  imageToFabricProps,
} from './mapping';

describe('computeImageFit', () => {
  it('cover: scales a wide bitmap to fill a square box and crops the sides', () => {
    const fit = computeImageFit({ width: 100, height: 100 }, { width: 400, height: 200 }, 'cover');
    // Scale so the shorter side (200) fills 100 → 0.5; the visible source is 200x200.
    expect(fit.scaleX).toBe(0.5);
    expect(fit.scaleY).toBe(0.5);
    expect(fit.width).toBe(200);
    expect(fit.height).toBe(200);
    expect(fit.cropX).toBe(100);
    expect(fit.cropY).toBe(0);
  });

  it('cover: crops top and bottom for a tall bitmap in a wide box', () => {
    const fit = computeImageFit({ width: 300, height: 100 }, { width: 300, height: 600 }, 'cover');
    expect(fit.scaleX).toBe(1);
    expect(fit.width).toBe(300);
    expect(fit.height).toBe(100);
    expect(fit.cropX).toBe(0);
    expect(fit.cropY).toBe(250);
  });

  it('cover: shows the whole bitmap when aspect ratios match', () => {
    const fit = computeImageFit({ width: 50, height: 25 }, { width: 400, height: 200 }, 'cover');
    expect(fit).toEqual({
      width: 400,
      height: 200,
      cropX: 0,
      cropY: 0,
      scaleX: 0.125,
      scaleY: 0.125,
    });
  });

  it('fill: stretches the full bitmap non-uniformly', () => {
    const fit = computeImageFit({ width: 100, height: 300 }, { width: 400, height: 200 }, 'fill');
    expect(fit).toEqual({ width: 400, height: 200, cropX: 0, cropY: 0, scaleX: 0.25, scaleY: 1.5 });
  });

  it('never divides by zero for degenerate sizes', () => {
    const fit = computeImageFit({ width: 0, height: 0 }, { width: 0, height: 0 }, 'cover');
    expect(Number.isFinite(fit.scaleX)).toBe(true);
    expect(fit.width).toBeGreaterThan(0);
  });

  it('drawn size equals the box in both modes', () => {
    const box = { width: 123, height: 77 };
    for (const fit of ['cover', 'fill'] as const) {
      const props = computeImageFit(box, { width: 999, height: 333 }, fit);
      expect(props.width * props.scaleX).toBeCloseTo(box.width, 6);
      expect(props.height * props.scaleY).toBeCloseTo(box.height, 6);
    }
  });
});

describe('imageToFabricProps', () => {
  const element = createImageElement({
    id: 'img',
    assetId: 'a',
    x: 10,
    y: 20,
    width: 200,
    height: 100,
    rotation: 0,
    opacity: 0.5,
  });

  it('positions by center and carries the fit transform', () => {
    const props = imageToFabricProps(element, { width: 400, height: 400 });
    expect(props.left).toBe(110);
    expect(props.top).toBe(70);
    expect(props.opacity).toBe(0.5);
    // cover of a square bitmap into 2:1 → scale 0.5, crop vertically.
    expect(props.scaleX).toBe(0.5);
    expect(props.width).toBe(400);
    expect(props.height).toBe(200);
    expect(props.cropY).toBe(100);
  });

  it('can be forced to fill (placeholder mode) regardless of element fit', () => {
    const props = imageToFabricProps(element, { width: 64, height: 64 }, 'fill');
    expect(props.scaleX).toBe(200 / 64);
    expect(props.scaleY).toBe(100 / 64);
    expect(props.cropX).toBe(0);
  });

  it('round-trips through geometryFromTransform after a user scale', () => {
    const props = imageToFabricProps(element, { width: 400, height: 400 });
    // The user drags a corner, doubling the object scale that Fabric already applied.
    const geometry = geometryFromTransform(
      {
        translateX: props.left,
        translateY: props.top,
        angle: 0,
        scaleX: props.scaleX * 2,
        scaleY: props.scaleY * 2,
      },
      { width: props.width, height: props.height },
    );
    expect(geometry.width).toBe(400);
    expect(geometry.height).toBe(200);
  });

  it('elementToFabricProps uses the provided image source and falls back to fill', () => {
    const withContext = elementToFabricProps(element, {
      imageSource: () => ({ natural: { width: 400, height: 400 }, fit: 'cover' }),
    });
    expect(withContext.kind).toBe('image');
    if (withContext.kind !== 'image') return;
    expect(withContext.props.cropY).toBe(100);

    const fallback = elementToFabricProps(element);
    if (fallback.kind !== 'image') throw new Error('expected image props');
    expect(fallback.props.scaleX).toBe(1);
    expect(fallback.props.width).toBe(200);
  });
});
