import { describe, expect, it } from 'vitest';

import { ICON_ENTRIES } from './index';
import { iconShapeToPathData } from './geometry';
import { shapeToSvg } from './index';

describe('iconShapeToPathData', () => {
  it('passes path data through unchanged', () => {
    expect(iconShapeToPathData(['path', { d: 'M2 2 L22 22' }])).toBe('M2 2 L22 22');
  });

  it('turns a circle into two half arcs that close the shape', () => {
    expect(iconShapeToPathData(['circle', { cx: '12', cy: '12', r: '10' }])).toBe(
      'M 2 12 a 10 10 0 1 0 20 0 a 10 10 0 1 0 -20 0',
    );
  });

  it('builds a sharp rectangle without a radius', () => {
    expect(iconShapeToPathData(['rect', { x: '3', y: '4', width: '18', height: '16' }])).toBe(
      'M 3 4 H 21 V 20 H 3 Z',
    );
  });

  it('rounds rectangle corners and clamps the radius to the box', () => {
    expect(
      iconShapeToPathData(['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }]),
    ).toContain('M 5 3 H 19 A 2 2 0 0 1 21 5');
    expect(
      iconShapeToPathData(['rect', { x: '0', y: '0', width: '10', height: '10', rx: '40' }]),
    ).toContain('M 5 0');
  });

  it('converts lines, polylines and polygons', () => {
    expect(iconShapeToPathData(['line', { x1: '2', y1: '3', x2: '20', y2: '3' }])).toBe(
      'M 2 3 L 20 3',
    );
    expect(iconShapeToPathData(['polyline', { points: '1,2 3,4 5,6' }])).toBe('M 1 2 L 3 4 L 5 6');
    expect(iconShapeToPathData(['polygon', { points: '1,2 3,4 5,6' }])).toBe('M 1 2 L 3 4 L 5 6 Z');
  });

  it('produces non-empty data for every bundled shape', () => {
    for (const entry of ICON_ENTRIES) {
      for (const shape of entry.shapes) {
        const data = iconShapeToPathData(shape);
        expect(data.length).toBeGreaterThan(0);
        // Absolute and relative moves are both valid path openings.
        expect(/^[Mm]/.test(data)).toBe(true);
        expect(data).not.toContain('NaN');
        // The canvas and the exporter must agree, so nothing the catalogue contains may be
        // silently dropped by the converter.
        expect(shapeToSvg(shape)).toContain('<');
      }
    }
  });
});
