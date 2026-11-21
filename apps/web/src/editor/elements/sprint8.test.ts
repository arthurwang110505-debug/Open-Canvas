import {
  CANVAS_PRESETS,
  createBlankDocument,
  createPathElement,
  validateDocument,
} from '@opencanvas/document';
import { renderPageToSvg } from '@opencanvas/export';
import { describe, expect, it } from 'vitest';

import {
  buildAreaChartElements,
  buildChartGroup,
  buildDonutChartElements,
  CHART_GROUP_NAMES,
  DEFAULT_AREA_DATA,
  DEFAULT_DONUT_DATA,
} from './charts';
import { parseChartGroup, regenerateChartGroup } from './chartData';
import { buildGridGroup, GRID_ITEMS } from './grids';
import {
  boltPoints,
  burstPoints,
  chevronPoints,
  crossPoints,
  flagPoints,
  parallelogramPoints,
  shieldPoints,
  trapezoidPoints,
} from './shapeGeometry';

const fixedDate = new Date('2026-11-20T09:30:00.000Z');

describe('Sprint 8 shape geometry', () => {
  const builders = {
    cross: crossPoints,
    chevron: chevronPoints,
    bolt: boltPoints,
    shield: shieldPoints,
    flag: flagPoints,
    parallelogram: parallelogramPoints,
    trapezoid: trapezoidPoints,
    burst: burstPoints,
  };

  it('keeps every silhouette finite and inside its own box', () => {
    for (const [name, build] of Object.entries(builders)) {
      const points = build(10, 20, 100);
      expect(points.length, name).toBeGreaterThanOrEqual(4);
      for (const point of points) {
        expect(Number.isFinite(point.x), name).toBe(true);
        expect(Number.isFinite(point.y), name).toBe(true);
        expect(point.x, name).toBeGreaterThanOrEqual(10);
        expect(point.x, name).toBeLessThanOrEqual(110);
        expect(point.y, name).toBeGreaterThanOrEqual(20);
        expect(point.y, name).toBeLessThanOrEqual(120);
      }
    }
  });

  it('uses the whole box for the shapes that should fill it', () => {
    for (const build of [chevronPoints, parallelogramPoints, trapezoidPoints, burstPoints]) {
      const points = build(0, 0, 100);
      const xs = points.map((point) => point.x);
      const ys = points.map((point) => point.y);
      expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(70);
      expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(60);
    }
  });

  it('scales with the requested side', () => {
    const small = burstPoints(0, 0, 50);
    const large = burstPoints(0, 0, 200);
    const spread = (points: { x: number }[]) =>
      Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    expect(spread(large)).toBeCloseTo(spread(small) * 4, 5);
  });
});

describe('Sprint 8 charts', () => {
  it('names every chart kind', () => {
    expect(CHART_GROUP_NAMES.donut).toBe('Donut chart');
    expect(CHART_GROUP_NAMES.area).toBe('Area chart');
  });

  it('builds a donut as a ring, a legend and a total', () => {
    const group = buildChartGroup('donut', { width: 1080, height: 1080 });
    expect(group.name).toBe('Donut chart');
    // 4 ring slices + 4 swatches + 4 legend rows + the total in the hole.
    expect(group.children.filter((child) => child.type === 'path')).toHaveLength(4);
    expect(group.children.filter((child) => child.type === 'rect')).toHaveLength(4);
    expect(group.children.filter((child) => child.type === 'text')).toHaveLength(5);
  });

  it('builds an area chart with a filled body under the trend', () => {
    const group = buildChartGroup('area', { width: 1080, height: 1080 });
    expect(group.name).toBe('Area chart');
    const paths = group.children.filter((child) => child.type === 'path');
    // Filled area + baseline + trend line.
    expect(paths).toHaveLength(3);
    const filled = paths.find((path) => path.fill.type === 'solid' && path.closed);
    expect(filled).toBeDefined();
    expect(filled!.opacity).toBeLessThan(1);
    expect(group.children.filter((child) => child.type === 'ellipse')).toHaveLength(
      DEFAULT_AREA_DATA.length,
    );
  });

  it('round-trips donut data through the data editor', () => {
    const group = buildChartGroup('donut', { width: 1080, height: 1080 });
    const parsed = parseChartGroup(group);
    expect(parsed?.kind).toBe('donut');
    expect(parsed?.data.map((datum) => datum.label)).toEqual(
      DEFAULT_DONUT_DATA.map((datum) => datum.label),
    );

    const edited = parsed!.data.map((datum, index) =>
      index === 0 ? { ...datum, value: 70 } : datum,
    );
    const next = regenerateChartGroup(group, edited);
    expect(next.id).toBe(group.id);
    expect(next.width).toBe(group.width);
    const reparsed = parseChartGroup(next);
    expect(reparsed?.kind).toBe('donut');
    // Percentages are recomputed against the new total, so the edited slice leads.
    expect(reparsed!.data[0]!.value).toBeGreaterThan(reparsed!.data[1]!.value);
  });

  it('round-trips area data through the data editor', () => {
    const group = buildChartGroup('area', { width: 1080, height: 1080 });
    const parsed = parseChartGroup(group);
    expect(parsed?.kind).toBe('area');
    expect(parsed?.data.map((datum) => datum.value)).toEqual(
      DEFAULT_AREA_DATA.map((datum) => datum.value),
    );

    const next = regenerateChartGroup(
      group,
      parsed!.data.map((datum) => ({ ...datum, value: datum.value + 5 })),
    );
    expect(parseChartGroup(next)?.data.map((datum) => datum.value)).toEqual(
      DEFAULT_AREA_DATA.map((datum) => datum.value + 5),
    );
  });

  it('builds the new charts in group-relative space when regenerating', () => {
    for (const kind of ['donut', 'area'] as const) {
      const elements =
        kind === 'donut'
          ? buildDonutChartElements(DEFAULT_DONUT_DATA, { x: 0, y: 0 }, 600, 400)
          : buildAreaChartElements(DEFAULT_AREA_DATA, { x: 0, y: 0 }, 600, 400);
      for (const element of elements) {
        expect(element.x, kind).toBeGreaterThanOrEqual(-1);
        expect(element.y, kind).toBeGreaterThanOrEqual(-1);
      }
    }
  });
});

describe('Sprint 8 grids and presets', () => {
  it('keeps every grid inside the page', () => {
    const page = { width: 1080, height: 1350 };
    for (const item of GRID_ITEMS) {
      const group = buildGridGroup(item.kind, page);
      expect(group.x, item.kind).toBeGreaterThanOrEqual(0);
      expect(group.y, item.kind).toBeGreaterThanOrEqual(0);
      expect(group.x + group.width, item.kind).toBeLessThanOrEqual(page.width);
      expect(group.y + group.height, item.kind).toBeLessThanOrEqual(page.height);
      for (const child of group.children) {
        expect(child.type).toBe('frame');
        expect(child.width).toBeGreaterThan(0);
        expect(child.height).toBeGreaterThan(0);
      }
    }
  });

  it('gives the feature grid one large cell and two smaller ones', () => {
    const cells = buildGridGroup('grid-feature-3', { width: 1080, height: 1080 }).children;
    const areas = cells.map((cell) => cell.width * cell.height).sort((a, b) => b - a);
    expect(areas[0]!).toBeGreaterThan(areas[1]! * 1.5);
    expect(areas[1]!).toBeCloseTo(areas[2]!, -3);
  });

  it('ships 24 canvas presets with unique ids and sane sizes', () => {
    expect(CANVAS_PRESETS).toHaveLength(24);
    const ids = CANVAS_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        'logo',
        'poster-a3',
        'postcard',
        'resume',
        'invitation',
        'video-background',
      ]),
    );
    for (const preset of CANVAS_PRESETS) {
      expect(preset.width).toBeGreaterThan(0);
      expect(preset.height).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(2);
    }
  });

  it('exports the new shapes, charts and grids to vector files with no broken numbers', async () => {
    const document = createBlankDocument({ id: 'doc_s8_svg', name: 'Vector', now: fixedDate });
    const builders = [
      crossPoints,
      chevronPoints,
      boltPoints,
      shieldPoints,
      flagPoints,
      parallelogramPoints,
      trapezoidPoints,
      burstPoints,
    ];
    builders.forEach((build, index) => {
      document.pages[0]!.elements.push(
        createPathElement(build(40 + index * 110, 40, 100), {
          fill: { type: 'solid', color: '#6d45e8' },
          stroke: { color: '#6d45e8', width: 0 },
          closed: true,
        }),
      );
    });
    document.pages[0]!.elements.push(
      buildChartGroup('donut', document.size),
      buildChartGroup('area', document.size),
      buildGridGroup('grid-feature-3', document.size),
    );

    const result = await renderPageToSvg(document);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).not.toContain('NaN');
    expect(result.value).not.toContain('Infinity');
    const drawn = result.value.match(/<(rect|ellipse|path|circle|line|text|g)\b/g) ?? [];
    expect(drawn.length).toBeGreaterThan(builders.length);
  });

  it('produces schema-valid documents for the new charts and grids', () => {
    const document = createBlankDocument({ id: 'doc_s8', name: 'Sprint 8', now: fixedDate });
    document.pages[0]!.elements.push(
      buildChartGroup('donut', document.size),
      buildChartGroup('area', document.size),
      buildGridGroup('grid-feature-3', document.size),
      buildGridGroup('grid-2x3', document.size),
    );
    expect(validateDocument(document).ok).toBe(true);
  });
});
