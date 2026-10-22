import { createTextElement } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import { textToFabricProps } from './mapping';
import { DocumentTextbox } from './textbox';

function makeBox(
  text: string,
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize',
  listStyle: 'none' | 'bullet' | 'number' = 'none',
) {
  const element = createTextElement({ id: 't', text, textTransform, listStyle });
  return new DocumentTextbox(element.text, {
    ...textToFabricProps(element),
    splitByGrapheme: false,
  });
}

describe('DocumentTextbox', () => {
  it('draws uppercased lines without rewriting the stored text', () => {
    const box = makeBox('Spring Sale', 'uppercase');
    expect(box.textLines).toEqual(['SPRING SALE']);
    // The document text is what the inline editor commits, so it must stay as typed.
    expect(box.text).toBe('Spring Sale');
  });

  it('capitalizes the first letter of every word and keeps hard breaks', () => {
    const box = makeBox('hello wORLD\nsecond line', 'capitalize');
    expect(box.textLines).toEqual(['Hello WORLD', 'Second Line']);
  });

  it('draws list markers on every visual line and skips blank ones', () => {
    const box = makeBox('one\ntwo\n\nfour', 'none', 'bullet');
    expect(box.textLines).toEqual(['• one', '• two', '', '• four']);
    expect(box.text).toBe('one\ntwo\n\nfour');
  });

  it('numbers list lines and re-splits when the style changes', () => {
    const box = makeBox('one\ntwo', 'none', 'number');
    expect(box.textLines).toEqual(['1. one', '2. two']);
    expect(box.setListStyle('bullet')).toBe(true);
    expect(box.textLines).toEqual(['• one', '• two']);
    expect(box.setListStyle('bullet')).toBe(false);
    expect(box.setListStyle('none')).toBe(true);
    expect(box.textLines).toEqual(['one', 'two']);
  });

  it('changes casing on an existing object and reports whether it did', () => {
    const box = makeBox('Hello', 'none');
    expect(box.textLines).toEqual(['Hello']);
    expect(box.setTextTransform('lowercase')).toBe(true);
    expect(box.textLines).toEqual(['hello']);
    expect(box.text).toBe('Hello');
    expect(box.setTextTransform('lowercase')).toBe(false);
  });
});
