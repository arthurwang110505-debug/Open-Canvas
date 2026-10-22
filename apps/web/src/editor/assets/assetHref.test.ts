import { createImageAsset } from '@opencanvas/document';
import { MemoryAssetBlobStore } from '@opencanvas/storage';
import { describe, expect, it } from 'vitest';

import { bundledPhotoUrl } from '../../assets/photos/catalog';
import { resolveAssetHref, TRANSPARENT_PNG } from './assetHref';

const fixedDate = new Date('2026-10-22T09:00:00.000Z');

function asset(overrides: Parameters<typeof createImageAsset>[0]) {
  return createImageAsset({
    mimeType: 'image/webp',
    width: 100,
    height: 50,
    now: fixedDate,
    ...overrides,
  });
}

describe('resolveAssetHref', () => {
  it('links bundled photos to the file the app ships', async () => {
    const href = await resolveAssetHref(
      asset({ id: 'asset_photo', source: { type: 'bundled', photoId: 'alpine-lake' } }),
      new MemoryAssetBlobStore(),
    );
    expect(href).toBe(bundledPhotoUrl('alpine-lake'));
  });

  it('falls back to a transparent pixel for a photo this build lacks', async () => {
    const href = await resolveAssetHref(
      asset({ id: 'asset_gone', source: { type: 'bundled', photoId: 'gone-photo' } }),
      new MemoryAssetBlobStore(),
    );
    expect(href).toBe(TRANSPARENT_PNG);
  });

  it('keeps remote urls and inlines local uploads', async () => {
    const store = new MemoryAssetBlobStore();
    await store.put('asset_up', new Blob(['bytes'], { type: 'image/png' }));
    expect(
      await resolveAssetHref(
        asset({ id: 'asset_url', source: { type: 'url', url: 'https://x.test/a.webp' } }),
        store,
      ),
    ).toBe('https://x.test/a.webp');
    const local = await resolveAssetHref(asset({ id: 'asset_up' }), store);
    expect(local.startsWith('data:image/png;base64,')).toBe(true);
    // Uploaded bytes that are gone must not break a dashboard thumbnail.
    expect(await resolveAssetHref(asset({ id: 'asset_missing' }), store)).toBe(TRANSPARENT_PNG);
    expect(await resolveAssetHref(asset({ id: 'asset_no_store' }), undefined)).toBe(
      TRANSPARENT_PNG,
    );
  });
});
