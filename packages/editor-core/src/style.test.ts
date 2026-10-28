import {
  createIconElement,
  createImageElement,
  createRectElement,
  createTextElement,
} from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { compatibleStylePatch } from './style';

describe('compatibleStylePatch', () => {
  it('copies typography and colour without copying text or layout', () => {
    const source = createTextElement({
      text: 'Source',
      fontFamily: 'Playfair Display',
      fontSize: 72,
      fontWeight: 700,
      fontStyle: 'italic',
      lineHeight: 1.4,
      letterSpacing: 3,
      underline: true,
      textTransform: 'uppercase',
      listStyle: 'bullet',
      color: '#123456',
    });
    const target = createTextElement({ text: 'Keep me', x: 400, width: 250 });
    const patch = compatibleStylePatch(source, target);

    expect(patch).toMatchObject({
      fontFamily: 'Playfair Display',
      fontSize: 72,
      fontWeight: 700,
      fontStyle: 'italic',
      lineHeight: 1.4,
      letterSpacing: 3,
      underline: true,
      textTransform: 'uppercase',
      listStyle: 'bullet',
      color: '#123456',
    });
    expect(patch).not.toHaveProperty('text');
    expect(patch).not.toHaveProperty('x');
    expect(patch).not.toHaveProperty('width');
  });

  it('shares only meaningful properties across element types', () => {
    const text = createTextElement({ color: '#abcdef', fontSize: 80 });
    const icon = createIconElement({ iconId: 'heart' });
    expect(compatibleStylePatch(text, icon)).toEqual({ opacity: 1, color: '#abcdef' });

    const image = createImageElement({
      assetId: 'asset',
      filters: { brightness: 120, contrast: 90, saturate: 110, blur: 2 },
    });
    expect(compatibleStylePatch(icon, image)).toEqual({ opacity: 1 });
    expect(compatibleStylePatch(image, image)).toEqual({
      opacity: 1,
      filters: { brightness: 120, contrast: 90, saturate: 110, blur: 2 },
    });
  });

  it('can clear a target stroke when the copied shape has none', () => {
    const source = createRectElement();
    const target = createRectElement({ stroke: { color: '#000000', width: 4 } });
    expect(compatibleStylePatch(source, target)).toHaveProperty('stroke', undefined);
  });
});
