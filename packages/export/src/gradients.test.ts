import {
  createBlankDocument,
  createEllipseElement,
  createRectElement,
  linearFill,
  radialFill,
  type DesignDocument,
  type DesignElement,
  type Fill,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { renderPageToSvg } from './svg';

const fixedDate = new Date('2026-10-22T09:00:00.000Z');

function pageWith(...elements: DesignElement[]): DesignDocument {
  const document = createBlankDocument({ name: 'Gradients', now: fixedDate });
  const page = document.pages[0];
  if (!page) throw new Error('expected a page');
  page.elements.push(...elements);
  return document;
}

async function render(document: DesignDocument): Promise<string> {
  const result = await renderPageToSvg(document);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

describe('gradient fills in SVG', () => {
  it('declares a gradient in <defs> and references it from the shape', async () => {
    const svg = await render(
      pageWith(
        createRectElement({
          id: 'r1',
          x: 100,
          y: 100,
          width: 400,
          height: 200,
          fill: linearFill(90, ['#0f172a', '#38bdf8']),
        }),
      ),
    );

    expect(svg).toContain('<defs>');
    // 90° runs left to right through the box: x from 0 to 1, y at the middle.
    expect(svg).toContain('<linearGradient id="grad-1" x1="0" y1="0.5" x2="1" y2="0.5">');
    expect(svg).toContain('<stop offset="0" stop-color="#0f172a"/>');
    expect(svg).toContain('<stop offset="1" stop-color="#38bdf8"/>');
    expect(svg).toContain('fill="url(#grad-1)"');
  });

  it('shares one definition between identical paints and numbers the rest', async () => {
    const fill = linearFill(180, ['#fef3c7', '#b45309']);
    const svg = await render(
      pageWith(
        createRectElement({ id: 'r1', fill }),
        createRectElement({ id: 'r2', x: 20, fill }),
        createEllipseElement({ id: 'e1', fill: radialFill(['#ffffff', '#000000']) }),
      ),
    );

    expect(svg.match(/<linearGradient/g)).toHaveLength(1);
    expect(svg.match(/<radialGradient/g)).toHaveLength(1);
    expect(svg).toContain('fill="url(#grad-1)"');
    expect(svg).toContain('fill="url(#grad-2)"');
    expect(svg).toContain('<radialGradient id="grad-2" cx="0.5" cy="0.5" r="0.5">');
  });

  it('paints gradient page backgrounds, including behind the elements', async () => {
    const document = pageWith(createRectElement({ id: 'r1', x: 40, y: 40 }));
    const page = document.pages[0];
    if (!page) throw new Error('expected a page');
    page.background = linearFill(135, ['#fdf2f8', '#c7d2fe']);

    const svg = await render(document);
    const background = svg.indexOf('<rect width="1080" height="1080" fill="url(#');
    const element = svg.indexOf('<g transform="translate(40 40)">');
    expect(background).toBeGreaterThan(-1);
    expect(background).toBeLessThan(element);
    expect(svg.match(/<linearGradient/g)).toHaveLength(1);
  });

  it('escapes stop colours, because the exporter does not assume the schema ran', async () => {
    const hostile = {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#000000' },
        { offset: 1, color: '#ffffff" onload="alert(1)' },
      ],
    } as unknown as Fill;

    const svg = await render(pageWith(createRectElement({ id: 'r1', fill: hostile })));

    expect(svg).not.toContain('onload="alert(1)"');
    expect(svg).toContain('stop-color="#ffffff&quot; onload=&quot;alert(1)"');
  });

  it('matches the committed golden file', async () => {
    const svg = await render(
      pageWith(
        createRectElement({
          id: 'rect_1',
          x: 96,
          y: 96,
          width: 400,
          height: 200,
          fill: linearFill(90, ['#0f172a', '#38bdf8']),
        }),
      ),
    );

    // Pinning the exact file makes any change to gradient markup a reviewed change: the canvas
    // adapter reads the same numbers, so a mismatch here is a mismatch on screen.
    expect(svg)
      .toBe(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <title>Gradients</title>
  <defs>
    <linearGradient id="grad-1" x1="0" y1="0.5" x2="1" y2="0.5">
      <stop offset="0" stop-color="#0f172a"/>
      <stop offset="1" stop-color="#38bdf8"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="#ffffff"/>
  <g transform="translate(96 96)">
    <rect width="400" height="200" fill="url(#grad-1)"/>
  </g>
</svg>`);
  });
});
