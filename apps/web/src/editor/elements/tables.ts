import {
  createGroupElement,
  createRectElement,
  createTextElement,
  type DesignElement,
  type GroupElement,
} from '@opencanvas/document';

/**
 * Tables as editable groups (Canva "Tables").
 *
 * A table is a group of cell rectangles and cell texts. The first row is a
 * header (light fill, semibold). Cell text is recovered from the texts sorted
 * into rows/columns, so the properties panel can offer a data editor that
 * rebuilds the group — the same pattern as charts.
 */

export const TABLE_GROUP_NAME = 'Table';

/**
 * How a table is painted. Canva's table styles boil down to three decisions — does the first row
 * read as a header, do body rows alternate, and what colour ties it together — so those are the
 * three knobs here. The style is recovered from the drawn cells (see `parseTableStyle`), which
 * keeps it out of the document schema: a table stays a plain group of rects and texts.
 */
export interface TableStyle {
  /** Tint used for the header fill and the banded rows. */
  accent: string;
  /** Paints the first row and sets its text semibold. */
  header: boolean;
  /** Tints every other body row. */
  banded: boolean;
}

export const DEFAULT_TABLE_STYLE: TableStyle = {
  accent: '#f3f4f6',
  header: true,
  banded: false,
};

/** Mixes `color` with white; used so a banded row reads lighter than the header. */
function lighten(color: string, amount: number): string {
  const hex = color.replace('#', '');
  if (hex.length !== 6) return color;
  const channel = (index: number) => {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    if (!Number.isFinite(value)) return 255;
    return Math.round(value + (255 - value) * amount);
  };
  return `#${[0, 1, 2].map((i) => channel(i).toString(16).padStart(2, '0')).join('')}`;
}

export const DEFAULT_TABLE_DATA: readonly (readonly string[])[] = [
  ['Item', 'Qty', 'Price'],
  ['Apples', '12', '$24'],
  ['Bread', '8', '$16'],
  ['Milk', '5', '$10'],
];

export function buildTableElements(
  rows: readonly (readonly string[])[],
  origin: { x: number; y: number },
  width: number,
  height: number,
  style: TableStyle = DEFAULT_TABLE_STYLE,
): DesignElement[] {
  const { x, y } = origin;
  const rowCount = rows.length;
  const colCount = rows[0]?.length ?? 0;
  if (rowCount === 0 || colCount === 0) return [];
  const cellW = width / colCount;
  const cellH = height / rowCount;
  const fontSize = Math.max(11, Math.round(cellH * 0.32));
  const elements: DesignElement[] = [];

  // Outer background + border.
  elements.push(
    createRectElement({
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
      fill: { type: 'solid', color: '#ffffff' },
      stroke: { color: '#d1d5db', width: Math.max(1, Math.round(height * 0.004)) },
      cornerRadius: Math.max(2, Math.round(height * 0.02)),
    }),
  );

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const cellX = x + colIndex * cellW;
      const cellY = y + rowIndex * cellH;
      const isHeader = style.header && rowIndex === 0;
      // Cell fill: header tint, banded body rows a lighter wash, everything else transparent so
      // the page background shows through.
      const banded = style.banded && !isHeader && (rowIndex - (style.header ? 1 : 0)) % 2 === 1;
      const fill = isHeader
        ? ({ type: 'solid', color: style.accent } as const)
        : banded
          ? ({ type: 'solid', color: lighten(style.accent, 0.5) } as const)
          : ({ type: 'none' } as const);
      elements.push(
        createRectElement({
          x: Math.round(cellX),
          y: Math.round(cellY),
          width: Math.round(cellW),
          height: Math.round(cellH),
          fill,
          stroke: { color: '#e5e7eb', width: 1 },
          cornerRadius: 0,
        }),
      );
      const pad = cellW * 0.08;
      elements.push(
        createTextElement({
          x: Math.round(cellX + pad),
          y: Math.round(cellY + (cellH - fontSize * 1.3) / 2),
          width: Math.round(cellW - pad * 2),
          height: Math.round(fontSize * 1.3),
          text: cell,
          fontSize,
          fontFamily: 'Inter',
          fontWeight: isHeader ? 600 : 400,
          textAlign: colIndex === 0 ? 'left' : 'center',
          color: '#1f2937',
        }),
      );
    });
  });

  return elements;
}

/** Builds a table group centred on `at` (or the page centre when omitted). */
export function buildTableGroup(
  pageSize: { width: number; height: number },
  at?: { x: number; y: number },
  rows: readonly (readonly string[])[] = DEFAULT_TABLE_DATA,
  style: TableStyle = DEFAULT_TABLE_STYLE,
): GroupElement {
  const width = Math.round(Math.min(pageSize.width, pageSize.height) * 0.68);
  const height = Math.round(width * 0.55);
  const origin = at
    ? {
        x: Math.round(Math.min(Math.max(at.x - width / 2, 0), pageSize.width - width)),
        y: Math.round(Math.min(Math.max(at.y - height / 2, 0), pageSize.height - height)),
      }
    : {
        x: Math.round((pageSize.width - width) / 2),
        y: Math.round((pageSize.height - height) / 2),
      };
  const children = buildTableElements(rows, origin, width, height, style);
  return createGroupElement(children, { name: TABLE_GROUP_NAME });
}

/**
 * Recovers cell text from a table group by sorting texts into rows/columns.
 * Returns null when the group is not a recognizable table.
 */
export function parseTableGroup(group: GroupElement): string[][] | null {
  if (group.name !== TABLE_GROUP_NAME) return null;
  const texts = group.children.filter(
    (child): child is Extract<DesignElement, { type: 'text' }> => child.type === 'text',
  );
  if (texts.length < 4) return null;

  // Group texts into rows by y (tolerance: half a text height).
  const sorted = [...texts].sort((a, b) => a.y - b.y);
  const rows: Extract<DesignElement, { type: 'text' }>[][] = [];
  for (const text of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(text.y - row[0]!.y) < text.height * 0.6) {
      row.push(text);
    } else {
      rows.push([text]);
    }
  }
  const colCount = Math.max(...rows.map((row) => row.length));
  if (colCount < 2 || colCount > 6 || rows.length < 2 || rows.length > 8) return null;
  // Every row must have the same number of cells.
  if (rows.some((row) => row.length !== colCount)) return null;

  return rows.map((row) => [...row].sort((a, b) => a.x - b.x).map((text) => text.text));
}

/**
 * Recovers the painted style from a table group so the panel can show what is actually drawn
 * rather than a remembered guess. Falls back to the default when the group is unreadable.
 */
export function parseTableStyle(group: GroupElement): TableStyle {
  const rects = group.children.filter(
    (child): child is Extract<DesignElement, { type: 'rect' }> => child.type === 'rect',
  );
  // The first rect is the table's outer background; cells follow in row order.
  const cells = rects.slice(1);
  if (cells.length === 0) return DEFAULT_TABLE_STYLE;

  const topY = Math.min(...cells.map((cell) => cell.y));
  const firstRow = cells.filter((cell) => Math.abs(cell.y - topY) < 1);
  const headerFill = firstRow.find((cell) => cell.fill.type === 'solid');
  const header = headerFill !== undefined;

  const bodyFills = cells
    .filter((cell) => Math.abs(cell.y - topY) >= 1)
    .filter((cell) => cell.fill.type === 'solid');
  return {
    accent: headerFill?.fill.type === 'solid' ? headerFill.fill.color : DEFAULT_TABLE_STYLE.accent,
    header,
    banded: bodyFills.length > 0,
  };
}

/** Rebuilds a table group's children from edited rows, keeping id/position/size. */
export function regenerateTableGroup(
  group: GroupElement,
  rows: readonly (readonly string[])[],
  style: TableStyle = parseTableStyle(group),
): GroupElement {
  const children = buildTableElements(rows, { x: 0, y: 0 }, group.width, group.height, style);
  return { ...group, children };
}
