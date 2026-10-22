import { describe, expect, it } from 'vitest';

import { applyListMarkers, applyTextTransform, listMarker } from './text';

describe('applyTextTransform', () => {
  it('leaves text alone when no casing is chosen', () => {
    expect(applyTextTransform('Hello World', 'none')).toBe('Hello World');
  });

  it('uppercases and lowercases every character', () => {
    expect(applyTextTransform('Hello World', 'uppercase')).toBe('HELLO WORLD');
    expect(applyTextTransform('Hello World', 'lowercase')).toBe('hello world');
  });

  it('capitalises the first letter of each word and keeps the rest as typed', () => {
    expect(applyTextTransform('hello WORLD', 'capitalize')).toBe('Hello WORLD');
    // Punctuation and line breaks both start a new word, as they do in CSS.
    expect(applyTextTransform('one-two\nthree', 'capitalize')).toBe('One-two\nThree');
  });

  it('handles letters outside ASCII', () => {
    expect(applyTextTransform('éclair à paris', 'capitalize')).toBe('Éclair À Paris');
    expect(applyTextTransform('straße', 'uppercase')).toBe('STRASSE');
  });

  it('is idempotent for the casings that are', () => {
    const upper = applyTextTransform('Mixed Case', 'uppercase');
    expect(applyTextTransform(upper, 'uppercase')).toBe(upper);
  });

  it('never drops characters: the stored text survives a round trip', () => {
    const original = 'Mixed Case — with punctuation!';
    const shown = applyTextTransform(original, 'uppercase');
    expect(shown.length).toBe(original.length);
    expect(applyTextTransform(original, 'none')).toBe(original);
  });
});

describe('applyListMarkers', () => {
  it('leaves text untouched without a list style', () => {
    expect(applyListMarkers(['one', 'two'], 'none')).toEqual(['one', 'two']);
  });

  it('marks every rendered line and skips blank ones', () => {
    expect(applyListMarkers(['one', 'wrapped line', '', 'three'], 'bullet')).toEqual([
      '• one',
      '• wrapped line',
      '',
      '• three',
    ]);
  });

  it('numbers non-empty lines in reading order', () => {
    expect(applyListMarkers(['first', '', 'second'], 'number')).toEqual([
      '1. first',
      '',
      '2. second',
    ]);
    expect(listMarker('number', 3)).toBe('3.');
  });
});
