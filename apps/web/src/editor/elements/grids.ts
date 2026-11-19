import { createFrameElement, createGroupElement, type GroupElement } from '@opencanvas/document';

/**
 * Photo grids (Canva "Grids"): a group of empty frames in a regular layout.
 * Each frame is a normal frame element, so dropping a photo onto any cell fills
 * just that cell, and the whole grid moves/resizes as one group.
 */

export type GridKind = 'grid-2x2' | 'grid-3x3' | 'grid-strip-3' | 'grid-duo';

export interface GridItem {
  kind: GridKind;
  label: string;
  keywords: string;
  description: string;
  cols: number;
  rows: number;
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
  // Single-row strips use the full width; square grids use a square box.
  const width = rows === 1 ? Math.round(pageSize.width * 0.8) : Math.round(base * 0.72);
  const height = rows === 1 ? Math.round(width / (cols * 0.9)) : Math.round(base * 0.72);
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

  return createGroupElement(children, { name: 'Photo grid' });
}
