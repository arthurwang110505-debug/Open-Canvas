import { createBlankDocument, validateDocument, type DesignDocument } from '@opencanvas/document';
import { TooltipProvider } from '@opencanvas/ui';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { EditorPage } from './EditorPage';
import { activateSidebarTab, openPropertiesPanel } from './testHelpers';
import { buildChartGroup } from './elements/charts';
import { buildGridGroup } from './elements/grids';
import {
  arrowPoints,
  cloudPoints,
  diamondPoints,
  heartPoints,
  moonPoints,
  plusPoints,
  regularPolygonPoints,
  ribbonPoints,
  speechBubblePoints,
} from './elements/shapeGeometry';
import { SHAPE_ITEMS } from './elements/shapeItems';
import { CHART_ITEMS } from './elements/charts';
import { GRID_ITEMS } from './elements/grids';

const fixedDate = new Date('2026-10-21T09:30:00.000Z');

function renderEditor(document?: DesignDocument) {
  const doc = document ?? createBlankDocument({ id: 'doc_charts', name: 'Charts', now: fixedDate });
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <EditorPage document={doc} />
    </TooltipProvider>,
  );
  return { user };
}

describe('shape geometry (Sprint 4)', () => {
  it('ships 22 shapes with unique kinds', () => {
    expect(SHAPE_ITEMS).toHaveLength(22);
    const kinds = SHAPE_ITEMS.map((item) => item.kind);
    expect(new Set(kinds).size).toBe(22);
    expect(kinds).toContain('pentagon');
    expect(kinds).toContain('heart');
    expect(kinds).toContain('arrow-right');
    expect(kinds).toContain('ribbon');
  });

  it('generates the right point counts for polygons and arrows', () => {
    expect(regularPolygonPoints(50, 50, 50, 5)).toHaveLength(5);
    expect(regularPolygonPoints(50, 50, 50, 8)).toHaveLength(8);
    expect(diamondPoints(0, 0, 100)).toHaveLength(4);
    expect(arrowPoints('right', 0, 0, 100)).toHaveLength(7);
    expect(arrowPoints('both', 0, 0, 100)).toHaveLength(10);
    expect(plusPoints(0, 0, 100)).toHaveLength(12);
    expect(speechBubblePoints(0, 0, 100)).toHaveLength(7);
    expect(ribbonPoints(0, 0, 100)).toHaveLength(12);
  });

  it('generates smooth silhouettes for heart, moon and cloud', () => {
    expect(heartPoints(0, 0, 100).length).toBeGreaterThanOrEqual(24);
    expect(moonPoints(0, 0, 100).length).toBeGreaterThanOrEqual(20);
    expect(cloudPoints(0, 0, 100).length).toBeGreaterThanOrEqual(20);
    for (const points of [
      heartPoints(10, 20, 100),
      moonPoints(10, 20, 100),
      cloudPoints(10, 20, 100),
    ]) {
      for (const point of points) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(10);
        expect(point.x).toBeLessThanOrEqual(110);
        expect(point.y).toBeGreaterThanOrEqual(20);
        expect(point.y).toBeLessThanOrEqual(120);
      }
    }
  });
});

describe('chart and grid builders (Sprint 4)', () => {
  it('ships 3 charts and 4 grids', () => {
    expect(CHART_ITEMS).toHaveLength(3);
    expect(GRID_ITEMS).toHaveLength(4);
  });

  it('builds a bar chart group with bars, values and labels', () => {
    const group = buildChartGroup('bar', { width: 1080, height: 1080 });
    expect(group.type).toBe('group');
    expect(group.name).toBe('Bar chart');
    // 4 bars + 4 value labels + 4 category labels + 1 baseline.
    expect(group.children).toHaveLength(13);
    const rects = group.children.filter((child) => child.type === 'rect');
    expect(rects).toHaveLength(4);
    const texts = group.children.filter((child) => child.type === 'text');
    expect(texts).toHaveLength(8);
  });

  it('builds a pie chart group with slices and a legend', () => {
    const group = buildChartGroup('pie', { width: 1080, height: 1080 });
    expect(group.name).toBe('Pie chart');
    // 4 slices + 4 swatches + 4 legend labels.
    expect(group.children).toHaveLength(12);
    expect(group.children.filter((child) => child.type === 'path')).toHaveLength(4);
  });

  it('builds a line chart group with a trend line, dots and labels', () => {
    const group = buildChartGroup('line', { width: 1080, height: 1080 });
    expect(group.name).toBe('Line chart');
    // baseline + trend + 5 dots + 5 values + 5 labels.
    expect(group.children).toHaveLength(17);
    expect(group.children.filter((child) => child.type === 'ellipse')).toHaveLength(5);
  });

  it('builds photo grids with the right number of frames', () => {
    expect(buildGridGroup('grid-2x2', { width: 1080, height: 1080 }).children).toHaveLength(4);
    expect(buildGridGroup('grid-3x3', { width: 1080, height: 1080 }).children).toHaveLength(9);
    expect(buildGridGroup('grid-strip-3', { width: 1080, height: 1080 }).children).toHaveLength(3);
    expect(buildGridGroup('grid-duo', { width: 1080, height: 1080 }).children).toHaveLength(2);
    for (const child of buildGridGroup('grid-2x2', { width: 1080, height: 1080 }).children) {
      expect(child.type).toBe('frame');
    }
  });

  it('produces schema-valid documents when charts and grids are inserted', () => {
    const document = createBlankDocument({ id: 'doc_valid', name: 'Valid', now: fixedDate });
    document.pages[0]!.elements.push(
      buildChartGroup('bar', document.size),
      buildGridGroup('grid-2x2', document.size),
    );
    expect(validateDocument(document).ok).toBe(true);
  });
});

describe('elements panel — charts and grids (Sprint 4)', () => {
  it('shows Charts and Grids sections and inserts them on click', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');

    expect(screen.getByRole('region', { name: 'Charts' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Grids' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Bar chart' }));
    let properties = openPropertiesPanel();
    expect(
      within(properties).getByRole('heading', { level: 2, name: 'Group' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();

    // Opening Properties switches the drawer away from Elements; go back for the grid.
    await activateSidebarTab(user, 'Elements');
    await user.click(screen.getByRole('button', { name: '2 × 2 grid' }));
    properties = openPropertiesPanel();
    expect(
      within(properties).getByRole('heading', { level: 2, name: 'Group' }),
    ).toBeInTheDocument();
  });

  it('filters charts and grids with the category chips', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');

    await user.click(screen.getByRole('button', { name: 'Charts' }));
    expect(screen.getByRole('region', { name: 'Charts' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Shapes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Grids' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Grids' }));
    expect(screen.getByRole('region', { name: 'Grids' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Charts' })).not.toBeInTheDocument();
  });

  it('inserts a new Sprint 4 shape (heart) as a path', async () => {
    const { user } = renderEditor();
    await activateSidebarTab(user, 'Elements');
    const shapes = screen.getByRole('region', { name: 'Shapes' });

    await user.click(within(shapes).getByRole('button', { name: 'Heart' }));
    const properties = openPropertiesPanel();
    // 30% of a 1080 square, centred — same placement as every other shape.
    expect(within(properties).getByLabelText('Width')).toHaveValue('324');
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled();
  });
});
