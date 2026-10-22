import {
  createBlankDocument,
  createGroupElement,
  createIconElement,
  createRectElement,
  type DesignDocument,
  type DesignElement,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { iconSvgMarkup, renderPageToSvg } from './svg';

const fixedDate = new Date('2026-10-21T09:00:00.000Z');

function pageWith(...elements: DesignElement[]): DesignDocument {
  const document = createBlankDocument({ name: 'Icons', now: fixedDate });
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

describe('icon rendering', () => {
  it('scales the 24×24 grid into the element box', async () => {
    const svg = await render(
      pageWith(
        createIconElement({ id: 'i1', x: 40, y: 60, iconId: 'heart', width: 240, height: 120 }),
      ),
    );
    // 240/24 = 10 across, 120/24 = 5 down: the element box stretches the icon, like the canvas.
    expect(svg).toContain('<g transform="translate(40 60)">');
    expect(svg).toContain('<g transform="scale(10 5)">');
  });

  it('strokes in the element colour and fills only what the set marks solid', () => {
    const markup = iconSvgMarkup(
      createIconElement({ id: 'k1', iconId: 'key-round', color: '#e11d48', strokeWidth: 2.5 }),
    );
    expect(markup).toContain('stroke="#e11d48"');
    expect(markup).toContain('stroke-width="2.5"');
    // The keyhole dot is marked `fill="currentColor"` in Lucide; a stroked dot would vanish at
    // small sizes, so the solid detail takes the element colour as a fill instead.
    expect(markup).toContain('fill="#e11d48"');
    expect(markup).toContain('stroke-linecap="round"');
  });

  it('renders nothing for an icon id this build does not know', async () => {
    const svg = await render(
      pageWith(createIconElement({ id: 'i9', x: 0, y: 0, iconId: 'from-a-newer-version' })),
    );
    expect(svg).not.toContain('<path');
    // The element is still in the document, so the rest of the page is unaffected.
    expect(svg).toContain('<g transform="translate(0 0)">');
  });

  it('renders inside groups and keeps the group transform', async () => {
    const group = createGroupElement(
      [
        createIconElement({ id: 'g1', x: 100, y: 100, iconId: 'star' }),
        createRectElement({ id: 'g2', x: 400, y: 100, width: 200, height: 200 }),
      ],
      { id: 'grp' },
    );
    const svg = await render(pageWith(group));
    expect(svg).toContain('<g transform="translate(100 100)">');
    expect(svg).toContain('<path');
  });

  it('matches the committed golden file', async () => {
    const icon = createIconElement({
      id: 'icon_1',
      x: 96,
      y: 96,
      iconId: 'heart',
      width: 192,
      height: 192,
    });
    const svg = await render(pageWith(icon));
    // Pinning the exact file catches any change to the markup a user would open — the icon
    // geometry, the scale, the stroke attributes — and forces it to be a reviewed change.
    expect(svg)
      .toBe(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <title>Icons</title>
  <rect width="1080" height="1080" fill="#ffffff"/>
  <g transform="translate(96 96)">
${iconSvgMarkup(icon)}
  </g>
</svg>`);
  });
});
