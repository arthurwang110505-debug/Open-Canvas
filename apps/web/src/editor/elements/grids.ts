import { createFrameElement, createGroupElement, type GroupElement } from '@opencanvas/document';

/**
 * Photo grids (Canva "Grids"): a group of empty frames in a regular layout.
 * Each frame is a normal frame element, so dropping a photo onto any cell fills
 * just that cell, and the whole grid moves/resizes as one group.
 */

export type GridKind =
  | 'grid-2x2'
  | 'grid-3x3'
  | 'grid-strip-3'
  | 'grid-duo'
  | 'grid-2x3'
  | 'grid-stack-2'
  | 'grid-feature-3';

/** A cell of a non-uniform grid, in unit space (0–1 of the grid box). */
export interface GridCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridItem {
  kind: GridKind;
  label: string;
  keywords: string;
  description: string;
  cols: number;
  rows: number;
  /** Explicit cells for layouts the cols/rows pair cannot describe (e.g. a feature cell). */
  cells?: readonly GridCell[];
}

export const GRID_ITEMS: readonly GridItem[] = [
  {
    kind: 'grid-2x2',
    label: '2 × 2 grid',
    keywords: 'grid 2x2 four photos collage',
    description: 'Four photos in a square collage.',
    cols: 2,
    rows: 2,
  },
  {
    kind: 'grid-3x3',
    label: '3 × 3 grid',
    keywords: 'grid 3x3 nine photos collage mosaic',
    description: 'Nine photos in a mosaic.',
    cols: 3,
    rows: 3,
  },
  {
    kind: 'grid-strip-3',
    label: '3-photo strip',
    keywords: 'strip three photos row collage',
    description: 'Three photos in a horizontal strip.',
    cols: 3,
    rows: 1,
  },
  {
    kind: 'grid-duo',
    label: '2-photo duo',
    keywords: 'duo two photos side by side',
    description: 'Two photos side by side.',
    cols: 2,
    rows: 1,
  },
  {
    kind: 'grid-2x3',
    label: '2 × 3 grid',
    keywords: 'grid 2x3 six photos collage landscape',
    description: 'Six photos in a wide collage.',
    cols: 3,
    rows: 2,
  },
  {
    kind: 'grid-stack-2',
    label: '2-photo stack',
    keywords: 'stack two photos above below vertical',
    description: 'Two photos stacked vertically.',
    cols: 1,
    rows: 2,
  },
  {
    kind: 'grid-feature-3',
    label: 'Feature + 2',
    keywords: 'feature hero three photos asymmetric collage',
    description: 'One large photo with two smaller ones beside it.',
    cols: 2,
    rows: 2,
    cells: [
      { x: 0, y: 0, width: 0.62, height: 1 },
      { x: 0.62, y: 0, width: 0.38, height: 0.5 },
      { x: 0.62, y: 0.5, width: 0.38, height: 0.5 },
    ],
  },
];

export function matchGrid(item: GridItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return item.label.toLowerCase().includes(q) || item.keywords.includes(q) || item.kind.includes(q);
}

/** Builds a photo-grid group centred on `at` (or the page centre when omitted). */
export function buildGridGroup(
  kind: GridKind,
  pageSize: { width: number; height: number },
  at?: { x: number; y: number },
): GroupElement {
  const item = GRID_ITEMS.find((entry) => entry.kind === kind) ?? GRID_ITEMS[0]!;
  const { cols, rows } = item;
  const base = Math.min(pageSize.width, pageSize.height);
  // Single-row strips use the full width; other grids take the cell grid's own aspect and are
  // clamped so a tall stack on a square page still fits inside the canvas.
  let width: number;
  let height: number;
  if (rows === 1) {
    width = Math.round(pageSize.width * 0.8);
    height = Math.round(width / (cols * 0.9));
  } else {
    width = base * 0.72;
    height = (width * rows) / cols;
    const maxW = pageSize.width * 0.86;
    const maxH = pageSize.height * 0.86;
    const scale = Math.min(1, maxW / width, maxH / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const gap = Math.max(6, Math.round(base * 0.015));
  const cellW = Math.round((width - gap * (cols - 1)) / cols);
  const cellH = Math.round((height - gap * (rows - 1)) / rows);
  const origin = at
    ? {
        x: Math.round(Math.min(Math.max(at.x - width / 2, 0), pageSize.width - width)),
        y: Math.round(Math.min(Math.max(at.y - height / 2, 0), pageSize.height - height)),
      }
    : {
        x: Math.round((pageSize.width - width) / 2),
        y: Math.round((pageSize.height - height) / 2),
      };

  const children = [];
  if (item.cells) {
    // Explicit layout: unit cells scaled into the grid box, insets keeping the gap even.
    for (const cell of item.cells) {
      const cx = origin.x + cell.x * width + (cell.x > 0 ? gap / 2 : 0);
      const cy = origin.y + cell.y * height + (cell.y > 0 ? gap / 2 : 0);
      const cw =
        cell.width * width - (cell.x > 0 ? gap / 2 : 0) - (cell.x + cell.width < 1 ? gap / 2 : 0);
      const ch =
        cell.height * height -
        (cell.y > 0 ? gap / 2 : 0) -
        (cell.y + cell.height < 1 ? gap / 2 : 0);
      children.push(
        createFrameElement({
          x: Math.round(cx),
          y: Math.round(cy),
          width: Math.max(1, Math.round(cw)),
          height: Math.max(1, Math.round(ch)),
          shape: 'rect',
          cornerRadius: Math.max(4, Math.round(Math.min(cw, ch) * 0.04)),
          fill: { type: 'solid', color: '#e5e7eb' },
        }),
      );
    }
  } else {
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        children.push(
          createFrameElement({
            x: origin.x + col * (cellW + gap),
            y: origin.y + row * (cellH + gap),
            width: cellW,
            height: cellH,
            shape: 'rect',
            cornerRadius: Math.max(4, Math.round(cellW * 0.04)),
            fill: { type: 'solid', color: '#e5e7eb' },
          }),
        );
      }
    }
  }

  return createGroupElement(children, { name: 'Photo grid' });
}
