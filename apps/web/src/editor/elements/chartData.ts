import type { DesignElement, GroupElement } from '@opencanvas/document';

import {
  buildBarChartElements,
  buildLineChartElements,
  buildPieChartElements,
  type ChartDatum,
  type ChartKind,
} from './charts';

/**
 * Chart data editing (Canva "Edit data").
 *
 * Charts are groups of primitives, so the data is recovered from the visible
 * labels (value labels hold the numbers, category/legend labels hold the names)
 * and the bar/slice/dot fills hold the colors. Regeneration rebuilds the group's
 * children at the group's current bounds, so moving/resizing a chart first and
 * then editing its data keeps its place and size. A chart whose children were
 * manually rearranged beyond recognition returns null and the panel explains
 * that data editing is unavailable.
 */

export interface ParsedChart {
  kind: ChartKind;
  data: ChartDatum[];
}

function isText(element: DesignElement): element is Extract<DesignElement, { type: 'text' }> {
  return element.type === 'text';
}

function solidFillColor(element: DesignElement): string | null {
  if ('fill' in element && element.fill.type === 'solid') return element.fill.color;
  return null;
}

function parseNumber(text: string): number | null {
  const trimmed = text.trim().replace(/,/g, '');
  if (trimmed.length === 0) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function parseBarChart(group: GroupElement): ChartDatum[] | null {
  const children = group.children;
  const rects = children.filter((child) => child.type === 'rect').sort((a, b) => a.x - b.x);
  const texts = children.filter(isText);
  if (rects.length < 2 || rects.length > 8) return null;
  if (texts.length !== rects.length * 2) return null;

  const baselineY = Math.max(...rects.map((rect) => rect.y + rect.height));
  const data: ChartDatum[] = [];
  for (const rect of rects) {
    const centerX = rect.x + rect.width / 2;
    const valueText = texts
      .filter((text) => text.y < rect.y)
      .sort(
        (a, b) => Math.abs(a.x + a.width / 2 - centerX) - Math.abs(b.x + b.width / 2 - centerX),
      )[0];
    const labelText = texts
      .filter((text) => text.y > baselineY)
      .sort(
        (a, b) => Math.abs(a.x + a.width / 2 - centerX) - Math.abs(b.x + b.width / 2 - centerX),
      )[0];
    if (!valueText || !labelText) return null;
    const value = parseNumber(valueText.text);
    if (value === null || value <= 0) return null;
    const color = solidFillColor(rect);
    if (!color) return null;
    data.push({ label: labelText.text.trim() || 'Item', value, color });
  }
  return data;
}

function parsePieChart(group: GroupElement): ChartDatum[] | null {
  const children = group.children;
  const texts = children.filter(isText).sort((a, b) => a.y - b.y);
  const swatches = children.filter((child) => child.type === 'rect').sort((a, b) => a.y - b.y);
  if (texts.length < 2 || texts.length > 8) return null;
  if (swatches.length !== texts.length) return null;

  const data: ChartDatum[] = [];
  for (let index = 0; index < texts.length; index += 1) {
    const text = texts[index]!;
    const swatch = swatches[index]!;
    // Legend reads "Label · 40%".
    const separator = text.text.lastIndexOf('·');
    if (separator < 0) return null;
    const label = text.text.slice(0, separator).trim();
    const percentText = text.text
      .slice(separator + 1)
      .trim()
      .replace('%', '')
      .trim();
    const percent = parseNumber(percentText);
    if (!label || percent === null || percent <= 0) return null;
    const color = solidFillColor(swatch);
    if (!color) return null;
    data.push({ label, value: percent, color });
  }
  return data;
}

function parseLineChart(group: GroupElement): ChartDatum[] | null {
  const children = group.children;
  const dots = children.filter((child) => child.type === 'ellipse').sort((a, b) => a.x - b.x);
  const texts = children.filter(isText);
  if (dots.length < 2 || dots.length > 8) return null;
  if (texts.length !== dots.length * 2) return null;

  const baselineY = Math.max(...dots.map((dot) => dot.y + dot.height)) + 1;
  const trend = children.find(
    (child) => child.type === 'path' && child.fill.type === 'none' && !child.closed,
  );
  const lineColor = trend?.type === 'path' ? trend.stroke.color : '#6d45e8';

  const data: ChartDatum[] = [];
  for (const dot of dots) {
    const centerX = dot.x + dot.width / 2;
    const centerY = dot.y + dot.height / 2;
    const valueText = texts
      .filter((text) => text.y < centerY)
      .sort(
        (a, b) => Math.abs(a.x + a.width / 2 - centerX) - Math.abs(b.x + b.width / 2 - centerX),
      )[0];
    const labelText = texts
      .filter((text) => text.y > baselineY)
      .sort(
        (a, b) => Math.abs(a.x + a.width / 2 - centerX) - Math.abs(b.x + b.width / 2 - centerX),
      )[0];
    if (!valueText || !labelText) return null;
    const value = parseNumber(valueText.text);
    if (value === null || value <= 0) return null;
    data.push({ label: labelText.text.trim() || 'Item', value, color: lineColor });
  }
  return data;
}

/** Recovers chart data from a group, or null when it is not a recognizable chart. */
export function parseChartGroup(group: GroupElement): ParsedChart | null {
  const name = group.name ?? '';
  const kind: ChartKind | null =
    name === 'Bar chart'
      ? 'bar'
      : name === 'Pie chart'
        ? 'pie'
        : name === 'Line chart'
          ? 'line'
          : null;
  if (!kind) return null;
  const data =
    kind === 'bar'
      ? parseBarChart(group)
      : kind === 'pie'
        ? parsePieChart(group)
        : parseLineChart(group);
  return data ? { kind, data } : null;
}

/**
 * Rebuilds a chart group's children from edited data, keeping the group's id,
 * position and size. Children are built in group-relative coordinates.
 */
export function regenerateChartGroup(
  group: GroupElement,
  data: readonly ChartDatum[],
): GroupElement {
  const parsed = parseChartGroup(group);
  const kind =
    parsed?.kind ??
    (group.name === 'Pie chart' ? 'pie' : group.name === 'Line chart' ? 'line' : 'bar');
  const origin = { x: 0, y: 0 };
  const children =
    kind === 'bar'
      ? buildBarChartElements(data, origin, group.width, group.height)
      : kind === 'pie'
        ? buildPieChartElements(data, origin, group.width, group.height)
        : buildLineChartElements(data, origin, group.width, group.height);
  return { ...group, children };
}
