import { describe, expect, it } from 'vitest';

import { buildFontFaceCss, collectFontUsages, type EmbeddedFontFace } from './fonts';
import type { DesignElement, TextElement } from '@opencanvas/document';
import { createGroupElement, createTextElement } from '@opencanvas/document';

function text(overrides: Partial<TextElement> = {}): TextElement {
  return createTextElement({ x: 0, y: 0, text: 'Hello', ...overrides });
}

const face = (overrides: Partial<EmbeddedFontFace> = {}): EmbeddedFontFace => ({
  family: 'Playfair Display',
  weight: '700',
  style: 'normal',
  data: 'AAAA',
  ...overrides,
});

describe('collectFontUsages', () => {
  it('collapses duplicate styles and walks nested groups', () => {
    const elements: DesignElement[] = [
      text({ fontFamily: 'Inter', fontWeight: 400 }),
      text({ fontFamily: 'Inter', fontWeight: 400 }),
      createGroupElement([
        text({
          x: 20,
          y: 20,
          fontFamily: 'Fraunces',
          fontWeight: 600,
          fontStyle: 'italic',
        }),
      ]),
    ];

    expect(collectFontUsages(elements)).toEqual([
      { family: 'Inter', weight: 400, style: 'normal' },
      { family: 'Fraunces', weight: 600, style: 'italic' },
    ]);
  });

  it('returns nothing for a page without text', () => {
    expect(collectFontUsages([])).toEqual([]);
  });
});

describe('buildFontFaceCss', () => {
  it('emits a data-URL face per rule', () => {
    const css = buildFontFaceCss([face()]);
    expect(css).toContain('font-family: "Playfair Display";');
    expect(css).toContain('font-weight: 700;');
    expect(css).toContain('src: url(data:font/woff2;base64,AAAA) format("woff2");');
  });

  it('keeps variable ranges and italic styles intact', () => {
    const css = buildFontFaceCss([
      face({ weight: '100 900', style: 'italic', format: 'woff', data: 'BBBB' }),
    ]);
    expect(css).toContain('font-style: italic;');
    expect(css).toContain('font-weight: 100 900;');
    expect(css).toContain('data:font/woff;base64,BBBB');
  });

  it('deduplicates faces and drops invalid payloads', () => {
    const css = buildFontFaceCss([
      face(),
      face(),
      face({ data: 'not base64!' }),
      face({ weight: '700; } body { color: red' }),
      face({ family: '   ' }),
      face({ format: 'woff2; }' as EmbeddedFontFace['format'] }),
    ]);
    expect(css.match(/@font-face/g) ?? []).toHaveLength(1);
    expect(css).not.toContain('color: red');
  });

  it('keeps a hostile family name inside its quoted string', () => {
    const css = buildFontFaceCss([face({ family: 'Bad" ); } body { color: red } .x {' })]);
    expect(css).toContain('font-family: "Bad\\" ); } body { color: red } .x {";');
    expect(css.match(/@font-face/g) ?? []).toHaveLength(1);
    expect(css.match(/src:/g) ?? []).toHaveLength(1);
  });

  it('is empty without faces', () => {
    expect(buildFontFaceCss([])).toBe('');
  });
});
