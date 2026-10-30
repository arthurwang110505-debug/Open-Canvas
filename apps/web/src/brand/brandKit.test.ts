import {
  createBlankDocument,
  createGroupElement,
  createRectElement,
  createTextElement,
  solidFill,
} from '@opencanvas/document';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  BRAND_KIT_STORAGE_KEY,
  DEFAULT_BRAND_KIT,
  extractPageColors,
  loadBrandKit,
  normalizeBrandColor,
  planBrandFontApplication,
  saveBrandKit,
  type BrandKit,
} from './brandKit';

const kit: BrandKit = { colors: ['#111111'], headingFont: 'Playfair Display', bodyFont: 'Manrope' };

describe('brand kit storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('normalizes hex colors and rejects anything else', () => {
    expect(normalizeBrandColor('#6D45E8')).toBe('#6d45e8');
    expect(normalizeBrandColor('#abc')).toBe('#aabbcc');
    expect(normalizeBrandColor('violet')).toBeNull();
    expect(normalizeBrandColor('#12345')).toBeNull();
    expect(normalizeBrandColor('')).toBeNull();
  });

  it('round-trips a kit through storage', () => {
    saveBrandKit(kit);
    expect(loadBrandKit()).toEqual(kit);
    expect(localStorage.getItem(BRAND_KIT_STORAGE_KEY)).toContain('Playfair Display');
  });

  it('falls back to the default kit when storage is empty or corrupt', () => {
    expect(loadBrandKit()).toEqual(DEFAULT_BRAND_KIT);
    localStorage.setItem(BRAND_KIT_STORAGE_KEY, '{not json');
    expect(loadBrandKit()).toEqual(DEFAULT_BRAND_KIT);
  });

  it('sanitizes invalid entries in a stored kit', () => {
    localStorage.setItem(
      BRAND_KIT_STORAGE_KEY,
      JSON.stringify({ colors: ['#ABC', 'red', '#abc', 42], headingFont: '', bodyFont: 'Inter' }),
    );
    expect(loadBrandKit()).toEqual({
      colors: ['#aabbcc'],
      headingFont: DEFAULT_BRAND_KIT.headingFont,
      bodyFont: 'Inter',
    });
  });
});

describe('extractPageColors', () => {
  it('collects fills, text colors, and the page background in first-use order', () => {
    const document = createBlankDocument({ name: 'Swatches' });
    const page = document.pages[0]!;
    page.background = solidFill('#fafafa');
    page.elements.push(
      createRectElement({ id: 'r1', fill: solidFill('#FF0000') }),
      createTextElement({ id: 't1', text: 'Hello', color: '#00ff00' }),
      createRectElement({ id: 'r2', fill: solidFill('#ff0000') }),
    );

    expect(extractPageColors(page)).toEqual(['#ff0000', '#00ff00', '#fafafa']);
  });
});

describe('planBrandFontApplication', () => {
  it('assigns the heading font to the largest text and the body font to the rest', () => {
    const elements = [
      createTextElement({ id: 'title', text: 'Big', fontSize: 64, fontFamily: 'Inter' }),
      createTextElement({ id: 'body', text: 'Small', fontSize: 16, fontFamily: 'Inter' }),
    ];

    const plan = planBrandFontApplication(elements, kit);

    expect(plan.headingCount).toBe(1);
    expect(plan.bodyCount).toBe(1);
    expect(plan.changedCount).toBe(2);
    expect(plan.elements[0]).toMatchObject({ fontFamily: 'Playfair Display' });
    expect(plan.elements[1]).toMatchObject({ fontFamily: 'Manrope' });
    // The input elements are never mutated.
    expect(elements[0]?.fontFamily).toBe('Inter');
  });

  it('reaches text inside groups', () => {
    const grouped = createGroupElement([
      createTextElement({ id: 'grouped', text: 'Nested', fontSize: 40, fontFamily: 'Inter' }),
    ]);
    const elements = [
      createTextElement({ id: 'title', text: 'Top', fontSize: 64, fontFamily: 'Inter' }),
      grouped,
    ];

    const plan = planBrandFontApplication(elements, kit);

    expect(plan.textCount).toBe(2);
    expect(plan.headingCount).toBe(2);
    const [group] = plan.elements.filter((element) => element.type === 'group');
    expect(group?.type === 'group' ? group.children[0] : undefined).toMatchObject({
      fontFamily: 'Playfair Display',
    });
  });

  it('reports no change when the page already uses the brand fonts', () => {
    const elements = [
      createTextElement({ id: 'title', text: 'Big', fontSize: 64, fontFamily: 'Playfair Display' }),
      createTextElement({ id: 'body', text: 'Small', fontSize: 16, fontFamily: 'Manrope' }),
    ];

    const plan = planBrandFontApplication(elements, kit);

    expect(plan.changedCount).toBe(0);
    expect(plan.textCount).toBe(2);
  });

  it('handles a page without text', () => {
    const plan = planBrandFontApplication([createRectElement({ id: 'r1' })], kit);
    expect(plan.textCount).toBe(0);
    expect(plan.changedCount).toBe(0);
  });
});
