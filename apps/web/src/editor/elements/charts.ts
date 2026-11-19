import {
  createEllipseElement,
  createGroupElement,
  createPathElement,
  createRectElement,
  createTextElement,
  type DesignElement,
  type GroupElement,
  type PathPoint,
} from '@opencanvas/document';

/**
 * Charts as editable groups.
 *
 * Canva's charts are data-driven; OpenCanvas keeps the document model simple by
 * building each chart from the same primitives users already edit (rects, paths,
 * ellipses, text) grouped together. The group moves, resizes and exports like any
 * other element, and ungrouping reveals the individual bars/slices/points.
 */

export type ChartKind = 'bar' | 'pie' | 'line';

export interface ChartItem {
  kind: ChartKind;
  label: string;
  keywords: string;
  description: string;
}

export const CHART_ITEMS: readonly ChartItem[] = [
  {
    kind: 'bar',
    label: 'Bar chart',
    keywords: 'bar column graph data statistics',
    description: 'Four bars with values and labels — edit each bar after inserting.',
  },
  {
    kind: 'pie',
    label: 'Pie chart',
    keywords: 'pie donut circle share percent data',
    description: 'Four slices with a legend — ungroup to recolor a slice.',
  },
  {
    kind: 'line',
    label: 'Line chart',
    keywords: 'line graph trend data statistics',
    description: 'A trend line with dots and labels — drag the dots to reshape it.',
  },
];

export function matchChart(item: ChartItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return item.label.toLowerCase().includes(q) || item.keywords.includes(q) || item.kind.includes(q);
}

export const CHART_COLORS = ['#6d45e8', '#0ea5a4', '#f59e0b', '#ec4899', '#3b82f6'] as const;

export interface ChartDatum {
  label: string;
  value: number;
  color: string;
}

export const DEFAULT_BAR_DATA: readonly ChartDatum[] = [
  { label: 'Mon', value: 40, color: '#6d45e8' },
  { label: 'Tue', value: 65, color: '#0ea5a4' },
  { label: 'Wed', value: 55, color: '#f59e0b' },
  { label: 'Thu', value: 80, color: '#ec4899' },
];

export const DEFAULT_PIE_DATA: readonly ChartDatum[] = [
  { label: 'Design', value: 40, color: '#6d45e8' },
  { label: 'Marketing', value: 30, color: '#0ea5a4' },
  { label: 'Sales', value: 20, color: '#f59e0b' },
  { label: 'Support', value: 10, color: '#ec4899' },
];

export const DEFAULT_LINE_DATA: readonly ChartDatum[] = [
  { label: 'Jan', value: 20, color: '#6d45e8' },
  { label: 'Feb', value: 45, color: '#6d45e8' },
  { label: 'Mar', value: 35, color: '#6d45e8' },
  { label: 'Apr', value: 60, color: '#6d45e8' },
  { label: 'May', value: 55, color: '#6d45e8' },
];

function labelElement(
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  align: 'left' | 'center' = 'center',
): DesignElement {
  return createTextElement({
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
    text,
    fontSize,
    fontFamily: 'Inter',
    fontWeight: 500,
    textAlign: align,
    color: '#374151',
  });
}

export function buildBarChartElements(
  data: readonly ChartDatum[],
  origin: { x: number; y: number },
  width: number,
  height: number,
): DesignElement[] {
  const { x, y } = origin;
  const padLeft = width * 0.06;
  const padRight = width * 0.06;
  const padTop = height * 0.18;
  const padBottom = height * 0.2;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const gap = chartW * 0.08;
  const barW = (chartW - gap * (data.length - 1)) / data.length;
  const baselineY = y + padTop + chartH;
  const fontSize = Math.max(11, Math.round(height * 0.045));
  const elements: DesignElement[] = [];

  // Baseline axis.
  elements.push(
    createPathElement(
      [
        { x, y: baselineY },
        { x: x + width, y: baselineY },
      ],
      {
        stroke: { color: '#d1d5db', width: Math.max(1, Math.round(height * 0.006)) },
        fill: { type: 'none' },
        closed: false,
      },
    ),
  );

  data.forEach((datum, index) => {
    const barX = x + padLeft + index * (barW + gap);
    const barH = (datum.value / max) * chartH;
    const barY = baselineY - barH;
    const color = datum.color;
    elements.push(
      createRectElement({
        x: Math.round(barX),
        y: Math.round(barY),
        width: Math.round(barW),
        height: Math.round(barH),
        fill: { type: 'solid', color },
        cornerRadius: Math.max(2, Math.round(barW * 0.12)),
      }),
    );
    elements.push(
      labelElement(
        String(datum.value),
        barX - barW * 0.2,
        barY - fontSize * 1.5,
        barW * 1.4,
        fontSize * 1.3,
        fontSize,
      ),
    );
    elements.push(
      labelElement(
        datum.label,
        barX - barW * 0.2,
        baselineY + fontSize * 0.6,
        barW * 1.4,
        fontSize * 1.3,
        fontSize,
      ),
    );
  });

  return elements;
}

function pieSlicePoints(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): PathPoint[] {
  const points: PathPoint[] = [{ x: cx, y: cy }];
  const steps = Math.max(4, Math.round(((endAngle - startAngle) / 360) * 24));
  for (let i = 0; i <= steps; i += 1) {
    const angle = ((startAngle + ((endAngle - startAngle) * i) / steps) * Math.PI) / 180;
    points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
  }
  return points;
}

export function buildPieChartElements(
  data: readonly ChartDatum[],
  origin: { x: number; y: number },
  width: number,
  height: number,
): DesignElement[] {
  const { x, y } = origin;
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const pieSize = Math.min(height * 0.86, width * 0.52);
  const cx = x + pieSize / 2 + width * 0.04;
  const cy = y + height / 2;
  const radius = pieSize / 2;
  const elements: DesignElement[] = [];
  let angle = -90;

  data.forEach((datum) => {
    const sweep = (datum.value / total) * 360;
    const color = datum.color;
    elements.push(
      createPathElement(pieSlicePoints(cx, cy, radius, angle, angle + sweep), {
        fill: { type: 'solid', color },
        stroke: { color: '#ffffff', width: Math.max(1, Math.round(radius * 0.03)) },
        closed: true,
      }),
    );
    angle += sweep;
  });

  // Legend to the right of the pie.
  const legendX = cx + radius + width * 0.08;
  const legendW = x + width - legendX - width * 0.04;
  const rowH = height / (data.length + 0.5);
  const fontSize = Math.max(11, Math.round(height * 0.045));
  const swatch = Math.max(10, Math.round(rowH * 0.42));
  data.forEach((datum, index) => {
    const rowY = y + height * 0.14 + index * rowH;
    const color = datum.color;
    const pct = Math.round((datum.value / total) * 100);
    elements.push(
      createRectElement({
        x: Math.round(legendX),
        y: Math.round(rowY + (rowH - swatch) / 2),
        width: swatch,
        height: swatch,
        fill: { type: 'solid', color },
        cornerRadius: Math.max(2, Math.round(swatch * 0.25)),
      }),
    );
    elements.push(
      labelElement(
        `${datum.label} · ${pct}%`,
        legendX + swatch + fontSize * 0.6,
        rowY,
        Math.max(40, legendW - swatch - fontSize),
        rowH,
        fontSize,
        'left',
      ),
    );
  });

  return elements;
}

export function buildLineChartElements(
  data: readonly ChartDatum[],
  origin: { x: number; y: number },
  width: number,
  height: number,
): DesignElement[] {
  const { x, y } = origin;
  const padLeft = width * 0.08;
  const padRight = width * 0.08;
  const padTop = height * 0.2;
  const padBottom = height * 0.2;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;
  const max = Math.max(...data.map((d) => d.value), 1);
  const min = 0;
  const baselineY = y + padTop + chartH;
  const fontSize = Math.max(11, Math.round(height * 0.045));
  const color = data[0]?.color ?? '#6d45e8';
  const elements: DesignElement[] = [];

  const points = data.map((datum, index) => {
    const px =
      data.length === 1
        ? x + padLeft + chartW / 2
        : x + padLeft + (index / (data.length - 1)) * chartW;
    const py = baselineY - ((datum.value - min) / (max - min)) * chartH;
    return { px, py, datum };
  });

  elements.push(
    createPathElement(
      [
        { x, y: baselineY },
        { x: x + width, y: baselineY },
      ],
      {
        stroke: { color: '#d1d5db', width: Math.max(1, Math.round(height * 0.006)) },
        fill: { type: 'none' },
        closed: false,
      },
    ),
  );

  elements.push(
    createPathElement(
      points.map(({ px, py }) => ({ x: px, y: py })),
      {
        stroke: { color, width: Math.max(2, Math.round(height * 0.012)) },
        fill: { type: 'none' },
        closed: false,
      },
    ),
  );

  const dotR = Math.max(5, Math.round(height * 0.022));
  points.forEach(({ px, py, datum }) => {
    elements.push(
      createEllipseElement({
        x: Math.round(px - dotR),
        y: Math.round(py - dotR),
        width: dotR * 2,
        height: dotR * 2,
        fill: { type: 'solid', color: '#ffffff' },
        stroke: { color, width: Math.max(2, Math.round(dotR * 0.45)) },
      }),
    );
    elements.push(
      labelElement(
        String(datum.value),
        px - fontSize * 1.2,
        py - fontSize * 2.1,
        fontSize * 2.4,
        fontSize * 1.3,
        fontSize,
      ),
    );
    elements.push(
      labelElement(
        datum.label,
        px - fontSize * 1.2,
        baselineY + fontSize * 0.6,
        fontSize * 2.4,
        fontSize * 1.3,
        fontSize,
      ),
    );
  });

  return elements;
}

/**
 * Builds a chart group centred on `at` (or the page centre when omitted).
 * Children are created in page coordinates; `createGroupElement` re-bases them.
 */
export function buildChartGroup(
  kind: ChartKind,
  pageSize: { width: number; height: number },
  at?: { x: number; y: number },
): GroupElement {
  const width = Math.round(Math.min(pageSize.width, pageSize.height) * 0.62);
  const height = Math.round(width * 0.66);
  const origin = at
    ? {
        x: Math.round(Math.min(Math.max(at.x - width / 2, 0), pageSize.width - width)),
        y: Math.round(Math.min(Math.max(at.y - height / 2, 0), pageSize.height - height)),
      }
    : {
        x: Math.round((pageSize.width - width) / 2),
        y: Math.round((pageSize.height - height) / 2),
      };

  const children =
    kind === 'bar'
      ? buildBarChartElements(DEFAULT_BAR_DATA, origin, width, height)
      : kind === 'pie'
        ? buildPieChartElements(DEFAULT_PIE_DATA, origin, width, height)
        : buildLineChartElements(DEFAULT_LINE_DATA, origin, width, height);

  const name = kind === 'bar' ? 'Bar chart' : kind === 'pie' ? 'Pie chart' : 'Line chart';
  return createGroupElement(children, { name });
}
