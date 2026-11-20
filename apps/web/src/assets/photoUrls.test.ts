import { beforeEach, describe, expect, it } from 'vitest';

import {
  forgetPhotoUrl,
  listPhotoUrls,
  MAX_REMEMBERED_PHOTO_URLS,
  rememberPhotoUrl,
} from './photoUrls';

describe('remembered photo URLs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('remembers a URL at the front of the list', () => {
    expect(rememberPhotoUrl('https://example.com/a.jpg')).toEqual(['https://example.com/a.jpg']);
    expect(rememberPhotoUrl('https://example.com/b.jpg')).toEqual([
      'https://example.com/b.jpg',
      'https://example.com/a.jpg',
    ]);
    expect(listPhotoUrls()).toEqual(['https://example.com/b.jpg', 'https://example.com/a.jpg']);
  });

  it('moves a re-remembered URL to the front without duplicating it', () => {
    rememberPhotoUrl('https://example.com/a.jpg');
    rememberPhotoUrl('https://example.com/b.jpg');
    expect(rememberPhotoUrl('https://example.com/a.jpg')).toEqual([
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]);
  });

  it('ignores non-http URLs', () => {
    expect(rememberPhotoUrl('ftp://example.com/a.jpg')).toEqual([]);
    expect(rememberPhotoUrl('not a url')).toEqual([]);
    expect(listPhotoUrls()).toEqual([]);
  });

  it('caps the list and forgets on request', () => {
    for (let index = 0; index < MAX_REMEMBERED_PHOTO_URLS + 5; index += 1) {
      rememberPhotoUrl(`https://example.com/${index}.jpg`);
    }
    expect(listPhotoUrls()).toHaveLength(MAX_REMEMBERED_PHOTO_URLS);
    expect(listPhotoUrls()[0]).toBe(`https://example.com/${MAX_REMEMBERED_PHOTO_URLS + 4}.jpg`);

    expect(forgetPhotoUrl(`https://example.com/${MAX_REMEMBERED_PHOTO_URLS + 4}.jpg`)).toHaveLength(
      MAX_REMEMBERED_PHOTO_URLS - 1,
    );
  });

  it('drops corrupt entries', () => {
    localStorage.setItem(
      'opencanvas:photo-urls:v1',
      JSON.stringify(['https://ok.example/a.jpg', 42, 'ftp://bad', null]),
    );
    expect(listPhotoUrls()).toEqual(['https://ok.example/a.jpg']);
    localStorage.setItem('opencanvas:photo-urls:v1', '{not json');
    expect(listPhotoUrls()).toEqual([]);
  });
});
