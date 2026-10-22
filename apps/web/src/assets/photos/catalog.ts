import alpineLake from './alpine-lake.webp?url';
import cityDusk from './city-dusk.webp?url';
import concreteWall from './concrete-wall.webp?url';
import desertDunes from './desert-dunes.webp?url';
import mistyForest from './misty-forest.webp?url';
import oceanWaves from './ocean-waves.webp?url';
import paperTexture from './paper-texture.webp?url';
import snowRidge from './snow-ridge.webp?url';
import tropicalCoast from './tropical-coast.webp?url';
import whiteArchitecture from './white-architecture.webp?url';

/**
 * The photos that ship with the editor.
 *
 * Each file is served by the app itself (Vite copies it into the build), so a design that uses a
 * photo keeps working offline and needs no account, CDN or upload. Documents reference a photo by
 * `photoId` only — the bytes stay in the bundle, which keeps project files small and lets the same
 * photo be reused on any page without duplicating it.
 *
 * Every image here was made for this project and is dedicated to the public domain under
 * CC0-1.0; see `docs/photos.md`.
 */
export interface BundledPhoto {
  /** Stable id stored in `source.photoId`; never rename a shipped photo. */
  id: string;
  title: string;
  tags: readonly string[];
  width: number;
  height: number;
  /** Build-time URL of the WebP file. */
  url: string;
}

export const BUNDLED_PHOTO_LICENCE = {
  name: 'CC0 1.0',
  summary: 'Made for OpenCanvas and placed in the public domain — free to use, no attribution.',
  href: 'https://creativecommons.org/publicdomain/zero/1.0/',
} as const;

export const BUNDLED_PHOTOS: readonly BundledPhoto[] = [
  {
    id: 'alpine-lake',
    title: 'Alpine lake',
    tags: ['lake', 'mountain', 'sunrise', 'water', 'nature', 'landscape'],
    width: 1408,
    height: 768,
    url: alpineLake,
  },
  {
    id: 'city-dusk',
    title: 'City at dusk',
    tags: ['city', 'skyline', 'blue hour', 'urban', 'architecture', 'night'],
    width: 1408,
    height: 768,
    url: cityDusk,
  },
  {
    id: 'concrete-wall',
    title: 'Concrete wall',
    tags: ['concrete', 'texture', 'grey', 'wall', 'background', 'minimal'],
    width: 1408,
    height: 768,
    url: concreteWall,
  },
  {
    id: 'desert-dunes',
    title: 'Desert dunes',
    tags: ['desert', 'sand', 'dunes', 'warm', 'minimal', 'landscape'],
    width: 1408,
    height: 768,
    url: desertDunes,
  },
  {
    id: 'misty-forest',
    title: 'Misty forest',
    tags: ['forest', 'fog', 'trees', 'green', 'nature', 'moody'],
    width: 1408,
    height: 768,
    url: mistyForest,
  },
  {
    id: 'ocean-waves',
    title: 'Ocean waves',
    tags: ['ocean', 'sea', 'waves', 'beach', 'aerial', 'travel'],
    width: 1408,
    height: 768,
    url: oceanWaves,
  },
  {
    id: 'paper-texture',
    title: 'Paper texture',
    tags: ['paper', 'texture', 'white', 'background', 'craft', 'minimal'],
    width: 1408,
    height: 768,
    url: paperTexture,
  },
  {
    id: 'snow-ridge',
    title: 'Snow ridge',
    tags: ['snow', 'mountain', 'clouds', 'cold', 'landscape', 'travel'],
    width: 1408,
    height: 768,
    url: snowRidge,
  },
  {
    id: 'tropical-coast',
    title: 'Tropical coast',
    tags: ['beach', 'coast', 'palms', 'sand', 'summer', 'travel'],
    width: 1376,
    height: 768,
    url: tropicalCoast,
  },
  {
    id: 'white-architecture',
    title: 'White architecture',
    tags: ['architecture', 'minimal', 'white', 'building', 'geometric', 'sky'],
    width: 1408,
    height: 768,
    url: whiteArchitecture,
  },
];

const PHOTOS_BY_ID = new Map(BUNDLED_PHOTOS.map((photo) => [photo.id, photo]));

export function findBundledPhoto(id: string): BundledPhoto | undefined {
  return PHOTOS_BY_ID.get(id);
}

/** The URL an asset with this `photoId` should display, or `null` when this build lacks it. */
export function bundledPhotoUrl(photoId: string): string | null {
  return findBundledPhoto(photoId)?.url ?? null;
}

/**
 * Case-insensitive search over titles and tags. An empty query returns every photo, so the panel
 * has something to show before anyone types.
 */
export function searchBundledPhotos(query: string): readonly BundledPhoto[] {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return BUNDLED_PHOTOS;
  return BUNDLED_PHOTOS.filter(
    (photo) =>
      photo.title.toLowerCase().includes(term) ||
      photo.tags.some((tag) => tag.toLowerCase().includes(term)),
  );
}
