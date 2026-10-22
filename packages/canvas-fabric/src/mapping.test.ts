import {
  createEllipseElement,
  createRectElement,
  createTextElement,
  linearFill,
  radialFill,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import {
  FABRIC_FONT_SIZE_MULT,
  centerToTopLeft,
  elementToFabricProps,
  fillSignature,
  fillToFabric,
  geometryFromTransform,
  normalizeAngle,
  patchFromTransform,
  roundTo,
  topLeftToCenter,
} from './mapping';

describe('geometry conversion', () => {
  it('maps an un-rotated box to its center and back', () => {
    const box = { x: 10, y: 20, width: 100, height: 50, rotation: 0 };
    const center = topLeftToCenter(box);
    expect(center).toEqual({ x: 60, y: 45 });
    expect(centerToTopLeft(center, box, box.rotation)).toEqual({ x: 10, y: 20 });
  });

  it('rotates the half-size vector for rotated boxes', () => {
    // 90° clockwise: the (w/2, h/2) offset becomes (-h/2, w/2).
    const box = { x: 0, y: 0, width: 100, height: 50, rotation: 90 };
    const center = topLeftToCenter(box);
    expect(center.x).toBeCloseTo(-25);
    expect(center.y).toBeCloseTo(50);
  });

  it.each([0, 15, 45, 90, 137.5, 180, 270, 359])('round-trips at %s degrees', (rotation) => {
    const box = { x: 123.4, y: -56.7, width: 321, height: 87, rotation };
    const center = topLeftToCenter(box);
    const back = centerToTopLeft(center, box, rotation);
    expect(back.x).toBeCloseTo(box.x, 6);
    expect(back.y).toBeCloseTo(box.y, 6);
  });

  it('normalizes angles into [0, 360)', () => {
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(450)).toBe(90);
    expect(normalizeAngle(360)).toBe(0);
  });

  it('rounds interaction noise away', () => {
    expect(roundTo(10.004999)).toBe(10);
    expect(roundTo(10.005001)).toBe(10.01);
  });
});

describe('geometryFromTransform', () => {
  it('bakes scale into width/height and derives the top-left corner', () => {
    const geometry = geometryFromTransform(
      { translateX: 100, translateY: 100, angle: 0, scaleX: 2, scaleY: 0.5 },
      { width: 50, height: 40 },
    );
    expect(geometry).toEqual({ x: 50, y: 90, width: 100, height: 20, rotation: 0 });
  });

  it('agrees with topLeftToCenter for rotated elements', () => {
    const element = createRectElement({ x: 40, y: 60, width: 200, height: 80, rotation: 30 });
    const center = topLeftToCenter(element);
    const geometry = geometryFromTransform(
      { translateX: center.x, translateY: center.y, angle: 30, scaleX: 1, scaleY: 1 },
      { width: 200, height: 80 },
    );
    expect(geometry).toEqual({ x: 40, y: 60, width: 200, height: 80, rotation: 30 });
  });

  it('never produces degenerate sizes', () => {
    const geometry = geometryFromTransform(
      { translateX: 0, translateY: 0, angle: 0, scaleX: 0, scaleY: 0 },
      { width: 50, height: 40 },
    );
    expect(geometry.width).toBe(1);
    expect(geometry.height).toBe(1);
  });
});

describe('elementToFabricProps', () => {
  it('maps rectangles with center origin and explicit stroke handling', () => {
    const rect = createRectElement({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      cornerRadius: 500,
      fill: { type: 'solid', color: '#ff0000' },
    });
    const mapped = elementToFabricProps(rect);
    expect(mapped.kind).toBe('rect');
    if (mapped.kind !== 'rect') return;
    expect(mapped.props).toMatchObject({
      left: 50,
      top: 25,
      width: 100,
      height: 50,
      fill: '#ff0000',
      stroke: '',
      strokeWidth: 0,
      strokeUniform: true,
      scaleX: 1,
      scaleY: 1,
      rx: 25, // clamped to half the shortest side
      ry: 25,
    });
  });

  it('maps strokes and no-fill shapes', () => {
    const rect = createRectElement({
      fill: { type: 'none' },
      stroke: { color: '#00ff00', width: 4 },
    });
    const mapped = elementToFabricProps(rect);
    if (mapped.kind !== 'rect') throw new Error('expected rect');
    expect(mapped.props.fill).toBe('');
    expect(mapped.props.stroke).toBe('#00ff00');
    expect(mapped.props.strokeWidth).toBe(4);
  });

  it('maps ellipses through radii', () => {
    const ellipse = createEllipseElement({ x: 10, y: 10, width: 80, height: 40 });
    const mapped = elementToFabricProps(ellipse);
    if (mapped.kind !== 'ellipse') throw new Error('expected ellipse');
    expect(mapped.props).toMatchObject({ rx: 40, ry: 20, left: 50, top: 30 });
  });

  it('maps typography, converting line height and letter spacing units', () => {
    const text = createTextElement({
      fontSize: 40,
      lineHeight: 1.5,
      letterSpacing: 4,
      fontWeight: 700,
      textAlign: 'center',
      color: '#123456',
    });
    const mapped = elementToFabricProps(text);
    if (mapped.kind !== 'text') throw new Error('expected text');
    expect(mapped.props.lineHeight).toBeCloseTo(1.5 / FABRIC_FONT_SIZE_MULT);
    expect(mapped.props.charSpacing).toBeCloseTo(100);
    expect(mapped.props).toMatchObject({
      fontWeight: 700,
      textAlign: 'center',
      fill: '#123456',
      editable: true,
      textTransform: 'none',
      listStyle: 'none',
    });
  });

  it('passes the document casing through without touching the text', () => {
    const text = createTextElement({ text: 'Spring Sale', textTransform: 'uppercase' });
    const mapped = elementToFabricProps(text);
    if (mapped.kind !== 'text') throw new Error('expected text');
    expect(mapped.props).toMatchObject({ text: 'Spring Sale', textTransform: 'uppercase' });
  });

  it('locks interaction for locked elements', () => {
    const mapped = elementToFabricProps(createRectElement({ locked: true }));
    expect(mapped.props).toMatchObject({
      lockMovementX: true,
      lockMovementY: true,
      lockRotation: true,
      lockScalingX: true,
      lockScalingY: true,
      hasControls: false,
    });
  });
});

describe('patchFromTransform', () => {
  it('returns plain geometry for shapes', () => {
    const rect = createRectElement({ width: 100, height: 100 });
    const patch = patchFromTransform(
      rect,
      { translateX: 100, translateY: 100, angle: 0, scaleX: 1.5, scaleY: 1.5 },
      { width: 100, height: 100 },
    );
    expect(patch).toEqual({ x: 25, y: 25, width: 150, height: 150, rotation: 0 });
  });

  it('scales font size for text instead of stretching', () => {
    const text = createTextElement({ fontSize: 20, width: 200, height: 30 });
    const patch = patchFromTransform(
      text,
      { translateX: 0, translateY: 0, angle: 0, scaleX: 2, scaleY: 2 },
      { width: 200, height: 30 },
    );
    expect(patch.fontSize).toBe(40);
    expect(patch.width).toBe(400);
  });
});

describe('gradient fills', () => {
  it('converts a linear fill into fraction coordinates the SVG exporter also uses', () => {
    const fill = fillToFabric(linearFill(90, ['#0f172a', '#38bdf8']));
    // 90° runs left to right; percentages are object-bounding-box fractions, matching SVG.
    if (typeof fill === 'string') throw new Error('expected a gradient spec');
    expect(fill).toMatchObject({
      type: 'linear',
      colorStops: [
        { offset: 0, color: '#0f172a' },
        { offset: 1, color: '#38bdf8' },
      ],
    });
    expect(fill.coords.x1).toBeCloseTo(0);
    expect(fill.coords.x2).toBeCloseTo(1);
    expect(fill.coords.y1).toBeCloseTo(0.5);
    expect(fill.coords.y2).toBeCloseTo(0.5);
  });

  it('converts a radial fill into a centred circle', () => {
    expect(fillToFabric(radialFill(['#ffffff', '#000000']))).toMatchObject({
      type: 'radial',
      coords: { x1: 0.5, y1: 0.5, r1: 0, x2: 0.5, y2: 0.5, r2: 0.5 },
    });
  });

  it('passes solid and empty fills through unchanged', () => {
    expect(fillToFabric({ type: 'solid', color: '#ff0000' })).toBe('#ff0000');
    expect(fillToFabric({ type: 'none' })).toBe('');
  });

  it('gives identical paints the same signature and different ones a different signature', () => {
    const a = fillToFabric(linearFill(90, ['#000000', '#ffffff']));
    const b = fillToFabric(linearFill(90, ['#000000', '#ffffff']));
    const c = fillToFabric(linearFill(91, ['#000000', '#ffffff']));
    expect(fillSignature(a)).toBe(fillSignature(b));
    expect(fillSignature(a)).not.toBe(fillSignature(c));
  });

  it('carries the gradient into the mapped element properties', () => {
    const mapped = elementToFabricProps(
      createRectElement({ id: 'r1', fill: linearFill(180, ['#fef3c7', '#b45309']) }),
    );
    if (mapped.kind !== 'rect') throw new Error('expected a rect');
    expect(mapped.props.fill).toMatchObject({ type: 'linear' });
  });
});
