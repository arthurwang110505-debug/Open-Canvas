import {
  createGroupElement,
  createPathElement,
  createRectElement,
  createTextElement,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { adaptElementsToSize, fitElementsToSize, scaleElementsToSize } from './layout';

const square = { width: 1080, height: 1080 };

describe('fitElementsToSize', () => {
  it('keeps same-size content untouched apart from rounding', () => {
    const rect = createRectElement({ id: 'r', x: 100, y: 200, width: 300, height: 150 });
    expect(fitElementsToSize([rect], square, square)).toEqual([rect]);
  });

  it('scales uniformly and centres when the page grows in one direction', () => {
    const rect = createRectElement({ id: 'r', x: 0, y: 0, width: 1080, height: 540 });
    const [fitted] = fitElementsToSize([rect], square, { width: 1080, height: 1920 });
    // Scale is 1 (width is the limiting side); the 1080-tall composition is centred vertically.
    expect(fitted).toMatchObject({ x: 0, y: 420, width: 1080, height: 540 });
  });

  it('scales text, letter spacing, stroke widths and path points together', () => {
    const text = createTextElement({ id: 't', x: 100, y: 100, width: 400, text: 'Hello' });
    const path = createPathElement(
      [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
      ],
      { id: 'p', stroke: { color: '#000000', width: 10 } },
    );
    const [fittedText, fittedPath] = fitElementsToSize([text, path], square, {
      width: 540,
      height: 540,
    });

    if (fittedText?.type !== 'text' || fittedPath?.type !== 'path') {
      throw new Error('expected a text and a path element');
    }
    expect(fittedText.fontSize).toBe(round(text.fontSize / 2));
    expect(fittedText.letterSpacing).toBe(round(text.letterSpacing / 2));
    expect(fittedText.x).toBe(50);
    expect(fittedText.width).toBe(200);
    expect(fittedPath.stroke.width).toBe(5);
    expect(fittedPath.points).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 25 },
    ]);
  });

  it('scales nested group children with the group', () => {
    const child = createRectElement({ id: 'child', x: 20, y: 20, width: 100, height: 100 });
    const group = createGroupElement([child], { id: 'g' });
    const [fitted] = fitElementsToSize([group], square, { width: 540, height: 540 });

    if (fitted?.type !== 'group') throw new Error('expected a group');
    expect(fitted.width).toBe(group.width / 2);
    expect(fitted.children[0]).toMatchObject({ x: 0, y: 0, width: 50, height: 50 });
  });
});

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

describe('scaleElementsToSize', () => {
  it('stretches boxes per axis to fill the new page', () => {
    const rect = createRectElement({ id: 'r', x: 100, y: 100, width: 200, height: 100 });
    const [scaled] = scaleElementsToSize([rect], square, { width: 1080, height: 1920 });
    // Horizontal factor 1, vertical factor 16/9: the box keeps its width and position-x,
    // and grows vertically with no letterbox offset.
    expect(scaled).toMatchObject({ x: 100, y: 177.78, width: 200, height: 177.78 });
  });

  it('scales text with the horizontal factor so wrapping is preserved', () => {
    const text = createTextElement({
      id: 't',
      x: 0,
      y: 0,
      width: 400,
      height: 100,
      text: 'Hello',
      fontSize: 40,
      letterSpacing: 2,
    });
    const [scaled] = scaleElementsToSize([text], square, { width: 540, height: 1920 });
    if (scaled?.type !== 'text') throw new Error('expected a text element');
    expect(scaled.fontSize).toBe(20);
    expect(scaled.letterSpacing).toBe(1);
    expect(scaled.width).toBe(200);
    expect(scaled.height).toBe(177.78);
  });

  it('scales group children per axis with the group', () => {
    const child = createRectElement({ id: 'child', x: 20, y: 20, width: 100, height: 100 });
    const group = createGroupElement([child], { id: 'g' });
    const [scaled] = scaleElementsToSize([group], square, { width: 2160, height: 1080 });
    if (scaled?.type !== 'group') throw new Error('expected a group');
    expect(scaled.width).toBe(group.width * 2);
    expect(scaled.children[0]).toMatchObject({ x: 0, y: 0, width: 200, height: 100 });
  });

  it('keeps elements visible at extreme reductions and leaves the input untouched', () => {
    const rect = createRectElement({ id: 'r', x: 10, y: 10, width: 2, height: 2 });
    const [scaled] = scaleElementsToSize([rect], square, { width: 54, height: 54 });
    expect(scaled?.width).toBeGreaterThanOrEqual(1);
    expect(scaled?.height).toBeGreaterThanOrEqual(1);
    expect(rect.width).toBe(2);
  });
});

describe('adaptElementsToSize', () => {
  it('dispatches to the chosen strategy', () => {
    const rect = createRectElement({ id: 'r', x: 0, y: 0, width: 1080, height: 540 });
    const story = { width: 1080, height: 1920 };
    expect(adaptElementsToSize([rect], square, story, 'fit')).toEqual(
      fitElementsToSize([rect], square, story),
    );
    expect(adaptElementsToSize([rect], square, story, 'scale')).toEqual(
      scaleElementsToSize([rect], square, story),
    );
  });
});

describe('fitElementsToSize at extreme reductions', () => {
  it('keeps a hairline rule and small type visible instead of rounding them to zero', () => {
    const rule = createPathElement(
      [
        { x: 100, y: 100 },
        { x: 900, y: 100 },
      ],
      { stroke: { color: '#111827', width: 1 } },
    );
    const label = createTextElement({ id: 't', x: 0, y: 0, width: 400, fontSize: 3, text: 'hi' });

    const fitted = fitElementsToSize([rule, label], { width: 2480, height: 3508 }, square);

    for (const element of fitted) {
      expect(element.width).toBeGreaterThanOrEqual(1);
      expect(element.height).toBeGreaterThanOrEqual(1);
      if (element.type === 'text') expect(element.fontSize).toBeGreaterThanOrEqual(1);
    }
  });
});
