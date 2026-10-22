import {
  createBlankDocument,
  createEllipseElement,
  createImageAsset,
  createImageElement,
  createRectElement,
  createTextElement,
  type DesignDocument,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { escapeXml, formatNumber, renderPageToSvg } from './svg';
import { TEXT_BASELINE_EM, wrapTextLines } from './textLayout';

const fixedDate = new Date('2026-04-05T06:07:08.000Z');

function makeDocument(): DesignDocument {
  return createBlankDocument({ id: 'doc_export', name: 'Poster', now: fixedDate });
}

function firstPage(document: DesignDocument) {
  const page = document.pages[0];
  if (!page) throw new Error('expected a page');
  return page;
}

async function render(
  document: DesignDocument,
  options: Parameters<typeof renderPageToSvg>[1] = {},
) {
  const rendered = await renderPageToSvg(document, options);
  if (!rendered.ok) throw new Error(rendered.error.message);
  return rendered.value;
}

describe('renderPageToSvg', () => {
  it('renders the page frame, title and background', async () => {
    const svg = await render(makeDocument());
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('width="1080" height="1080" viewBox="0 0 1080 1080"');
    expect(svg).toContain('<title>Poster</title>');
    expect(svg).toContain('<rect width="1080" height="1080" fill="#ffffff"/>');
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('scales the emitted size but keeps document units in the viewBox', async () => {
    const svg = await render(makeDocument(), { scale: 2 });
    expect(svg).toContain('width="2160" height="2160" viewBox="0 0 1080 1080"');
  });

  it('embeds the supplied fonts as @font-face rules inside a <defs> block', async () => {
    const svg = await render(makeDocument(), {
      fontFaces: [{ family: 'Playfair Display', weight: '400 900', style: 'normal', data: 'AAAA' }],
    });
    expect(svg).toContain('  <defs>\n    <style type="text/css">');
    expect(svg).toContain('@font-face { font-family: &quot;Playfair Display&quot;');
    expect(svg).toContain('data:font/woff2;base64,AAAA');
  });

  it('omits the style block when no font is embedded', async () => {
    const svg = await render(makeDocument());
    expect(svg).not.toContain('<style');
    expect(svg).not.toContain('<defs>');
  });

  it('can omit the background', async () => {
    const svg = await render(makeDocument(), { background: false });
    expect(svg).not.toContain('fill="#ffffff"');
  });

  it('renders a rectangle with fill, stroke, corner radius, opacity and rotation', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createRectElement({
        id: 'r1',
        x: 100,
        y: 50,
        width: 200,
        height: 80,
        cornerRadius: 12,
        rotation: 30,
        opacity: 0.5,
        fill: { type: 'solid', color: '#ff0000' },
        stroke: { color: '#00ff00', width: 4 },
      }),
    );

    const svg = await render(document);
    expect(svg).toContain('<g transform="translate(100 50) rotate(30)" opacity="0.5">');
    expect(svg).toContain(
      '<rect width="200" height="80" rx="12" fill="#ff0000" stroke="#00ff00" stroke-width="4"/>',
    );
  });

  it('clamps the corner radius to half of the shorter edge', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createRectElement({ id: 'r1', width: 40, height: 20, cornerRadius: 999 }),
    );
    expect(await render(document)).toContain('rx="10"');
  });

  it('renders an ellipse centered in its box and a no-fill shape', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createEllipseElement({
        id: 'e1',
        x: 10,
        y: 20,
        width: 100,
        height: 60,
        fill: { type: 'none' },
        stroke: { color: '#123456', width: 2 },
      }),
    );
    const svg = await render(document);
    expect(svg).toContain(
      '<ellipse cx="50" cy="30" rx="50" ry="30" fill="none" stroke="#123456" stroke-width="2"/>',
    );
  });

  it('renders text lines with the canvas baseline metric and style', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createTextElement({
        id: 't1',
        x: 20,
        y: 30,
        width: 400,
        height: 200,
        text: 'Spring sale\n50% off',
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: 700,
        fontStyle: 'italic',
        textAlign: 'center',
        lineHeight: 1.5,
        letterSpacing: 2,
        underline: true,
        color: '#112233',
      }),
    );

    const svg = await render(document);
    const firstBaseline = 48 * TEXT_BASELINE_EM;
    expect(svg).toContain('<g transform="translate(20 30)">');
    expect(svg).toContain(
      'font-family="Inter" font-size="48" font-weight="700" font-style="italic" letter-spacing="2" text-decoration="underline" fill="#112233" text-anchor="middle"',
    );
    expect(svg).toContain(`<tspan x="200" y="${formatNumber(firstBaseline)}">Spring sale</tspan>`);
    expect(svg).toContain(
      `<tspan x="200" y="${formatNumber(firstBaseline + 48 * 1.5)}">50% off</tspan>`,
    );
  });

  it('maps text alignment to SVG anchors', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createTextElement({ id: 't1', width: 300, textAlign: 'right', text: 'Right' }),
    );
    const svg = await render(document);
    expect(svg).toContain('text-anchor="end"');
    expect(svg).toContain('<tspan x="300"');
  });

  it('applies text casing to the drawn glyphs and leaves the document text as typed', async () => {
    const document = makeDocument();
    const element = createTextElement({
      id: 't1',
      width: 300,
      text: 'spring sale\nnow on',
      textTransform: 'uppercase',
    });
    firstPage(document).elements.push(element);

    const svg = await render(document);
    expect(svg).toContain('>SPRING SALE</tspan>');
    expect(svg).toContain('>NOW ON</tspan>');
    expect(element.text).toBe('spring sale\nnow on');
  });

  it('keeps measured wrapping identical to the casing the canvas draws', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createTextElement({
        id: 't1',
        width: 100,
        fontSize: 10,
        text: 'one two three',
        textTransform: 'capitalize',
      }),
    );
    // Every character is 10px wide, so ten characters fill the 100px box.
    const svg = await render(document, { measureText: (text) => text.length * 10 });
    expect(svg).toContain('>One Two</tspan>');
    expect(svg).toContain('>Three</tspan>');
  });

  it('wraps text when a measurer is provided', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createTextElement({ id: 't1', width: 100, fontSize: 10, text: 'one two three' }),
    );
    // Every character is 10px wide, so ten characters fill the 100px box.
    const svg = await render(document, { measureText: (text) => text.length * 10 });
    expect(svg).toContain('>one two</tspan>');
    expect(svg).toContain('>three</tspan>');
  });

  it('draws list markers on wrapped lines and keeps the document text unprefixed', async () => {
    const document = makeDocument();
    const element = createTextElement({
      id: 't1',
      width: 100,
      fontSize: 10,
      text: 'one two three',
      listStyle: 'number',
    });
    firstPage(document).elements.push(element);

    // Every character is 10px wide and the 1.5em marker gutter leaves 85px per line.
    const svg = await render(document, { measureText: (text) => text.length * 10 });
    expect(svg).toContain('>1. one two</tspan>');
    expect(svg).toContain('>2. three</tspan>');
    expect(element.text).toBe('one two three');
  });

  it('escapes markup and control characters in text and names', async () => {
    const document = makeDocument();
    document.name = 'A & B <script>';
    firstPage(document).elements.push(
      createTextElement({ id: 't1', text: '<b>&"bold"\u0000</b>' }),
    );
    const svg = await render(document);
    expect(svg).toContain('<title>A &amp; B &lt;script&gt;</title>');
    expect(svg).toContain('&lt;b&gt;&amp;&quot;bold&quot;&lt;/b&gt;');
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('\u0000');
  });

  it('renders images through the injected href resolver', async () => {
    const document = makeDocument();
    document.assets['asset_1'] = createImageAsset({
      id: 'asset_1',
      name: 'logo.png',
      mimeType: 'image/png',
      width: 400,
      height: 200,
    });
    firstPage(document).elements.push(
      createImageElement({ id: 'i1', assetId: 'asset_1', x: 5, y: 6, width: 100, height: 50 }),
      createImageElement({ id: 'i2', assetId: 'asset_1', fit: 'fill', y: 80 }),
    );

    const calls: string[] = [];
    const svg = await render(document, {
      resolveImageHref: (asset) => {
        calls.push(asset.id);
        return 'data:image/png;base64,AAAA';
      },
    });
    // One resolution per asset, not per element.
    expect(calls).toEqual(['asset_1']);
    expect(svg).toContain(
      '<image href="data:image/png;base64,AAAA" width="100" height="50" preserveAspectRatio="xMidYMid slice"/>',
    );
    expect(svg).toContain('preserveAspectRatio="none"');
  });

  it('skips hidden elements unless asked to include them', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(
      createRectElement({ id: 'shown' }),
      createRectElement({ id: 'hidden', visible: false }),
    );
    expect(await render(document)).not.toContain('translate(0 0) rotate(0)');
    const withHidden = await render(document, { includeHidden: true });
    expect(withHidden.match(/<g transform=/g)).toHaveLength(2);
  });

  it('reports a missing page', async () => {
    const failed = await renderPageToSvg(makeDocument(), { pageId: 'nope' });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('page-not-found');
  });

  it('refuses to export images without a resolver', async () => {
    const document = makeDocument();
    document.assets['asset_1'] = createImageAsset({
      id: 'asset_1',
      mimeType: 'image/png',
      width: 10,
      height: 10,
    });
    firstPage(document).elements.push(createImageElement({ id: 'i1', assetId: 'asset_1' }));

    const failed = await renderPageToSvg(document);
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('image-resolver-required');
  });

  it('reports an image element pointing at an unknown asset', async () => {
    const document = makeDocument();
    firstPage(document).elements.push(createImageElement({ id: 'i1', assetId: 'ghost' }));

    const failed = await renderPageToSvg(document, { resolveImageHref: () => 'data:,' });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('asset-missing');
    expect(failed.error.message).toContain('ghost');
  });

  it('reports a resolver failure with its reason', async () => {
    const document = makeDocument();
    document.assets['asset_1'] = createImageAsset({
      id: 'asset_1',
      name: 'broken.png',
      mimeType: 'image/png',
      width: 10,
      height: 10,
    });
    firstPage(document).elements.push(createImageElement({ id: 'i1', assetId: 'asset_1' }));

    const failed = await renderPageToSvg(document, {
      resolveImageHref: () => Promise.reject(new Error('bytes are gone')),
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('image-failed');
    expect(failed.error.message).toContain('broken.png');
    expect(failed.error.message).toContain('bytes are gone');
  });
});

describe('escapeXml', () => {
  it('escapes every XML-sensitive character', () => {
    expect(escapeXml(`<>&'"`)).toBe('&lt;&gt;&amp;&apos;&quot;');
    expect(escapeXml(`"&<>`)).toBe('&quot;&amp;&lt;&gt;');
  });
});

describe('wrapTextLines', () => {
  it('keeps hard breaks without a measurer', () => {
    const element = createTextElement({ id: 't', text: 'a\nb', width: 10 });
    expect(wrapTextLines(element)).toEqual(['a', 'b']);
  });

  it('keeps an unbreakable word on its own line', () => {
    const element = createTextElement({ id: 't', text: 'supercalifragilistic', width: 30 });
    expect(wrapTextLines(element, (text) => text.length * 10)).toEqual(['supercalifragilistic']);
  });

  it('preserves empty lines', () => {
    const element = createTextElement({ id: 't', text: 'a\n\nb', width: 1000 });
    expect(wrapTextLines(element, (text) => text.length)).toEqual(['a', '', 'b']);
  });
});
