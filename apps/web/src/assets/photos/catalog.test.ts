import { describe, expect, it } from 'vitest';

import { BUNDLED_PHOTOS, bundledPhotoUrl, findBundledPhoto, searchBundledPhotos } from './catalog';

describe('bundled photo catalogue', () => {
  it('uses unique slug ids and ships usable dimensions', () => {
    const ids = BUNDLED_PHOTOS.map((photo) => photo.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const photo of BUNDLED_PHOTOS) {
      expect(photo.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
      expect(photo.tags.length).toBeGreaterThanOrEqual(3);
      expect(photo.url).not.toBe('');
    }
  });

  it('looks photos up by id', () => {
    expect(findBundledPhoto('alpine-lake')?.title).toBe('Alpine lake');
    expect(findBundledPhoto('nope')).toBeUndefined();
    expect(bundledPhotoUrl('alpine-lake')).toBe(findBundledPhoto('alpine-lake')?.url);
    expect(bundledPhotoUrl('nope')).toBeNull();
  });

  it('searches titles and tags case-insensitively', () => {
    expect(searchBundledPhotos('')).toHaveLength(BUNDLED_PHOTOS.length);
    expect(searchBundledPhotos('OCEAN').map((photo) => photo.id)).toEqual(['ocean-waves']);
    expect(searchBundledPhotos('texture').map((photo) => photo.id)).toEqual([
      'concrete-wall',
      'paper-texture',
    ]);
    expect(searchBundledPhotos('zzzz')).toEqual([]);
  });
});
