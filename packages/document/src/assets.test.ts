import { describe, expect, it } from 'vitest';

import { LIMITS } from './constants';
import { createBlankDocument, createImageAsset, createImageElement } from './factories';
import { collectReferencedAssetIds, findAsset, fitWithin } from './queries';
import { DocumentSchema, ImageAssetSchema, ImageElementSchema } from './schema';
import { parseDocument, serializeDocument } from './serialization';

const fixedDate = new Date('2026-01-02T03:04:05.000Z');

function documentWithImage() {
  const doc = createBlankDocument({ id: 'doc_1', name: 'Images', now: fixedDate });
  const asset = createImageAsset({
    id: 'asset_1',
    name: 'photo.png',
    mimeType: 'image/png',
    width: 640,
    height: 480,
    byteSize: 1234,
    now: fixedDate,
  });
  doc.assets[asset.id] = asset;
  const page = doc.pages[0];
  if (!page) throw new Error('fixture page missing');
  page.elements.push(
    createImageElement({ id: 'img_1', assetId: 'asset_1', x: 10, y: 20, width: 320, height: 240 }),
  );
  return doc;
}

describe('ImageAssetSchema', () => {
  it('accepts assets created by the factory', () => {
    const asset = createImageAsset({ mimeType: 'image/jpeg', width: 10, height: 20 });
    const parsed = ImageAssetSchema.parse(asset);
    expect(parsed.source).toEqual({ type: 'local' });
    expect(parsed.kind).toBe('image');
  });

  it('accepts url sources and rejects empty urls', () => {
    const ok = ImageAssetSchema.safeParse(
      createImageAsset({
        mimeType: 'image/webp',
        width: 1,
        height: 1,
        source: { type: 'url', url: 'https://example.com/a.webp' },
      }),
    );
    expect(ok.success).toBe(true);
    const bad = ImageAssetSchema.safeParse(
      createImageAsset({
        mimeType: 'image/webp',
        width: 1,
        height: 1,
        source: { type: 'url', url: '' },
      }),
    );
    expect(bad.success).toBe(false);
  });

  it('accepts a bundled photo source and rejects ids that are not slugs', () => {
    const bundled = createImageAsset({
      mimeType: 'image/webp',
      width: 1408,
      height: 768,
      source: { type: 'bundled', photoId: 'alpine-lake' },
    });
    expect(ImageAssetSchema.safeParse(bundled).success).toBe(true);
    for (const photoId of ['Alpine Lake', '', '../etc/passwd', 'a'.repeat(65)]) {
      const bad = { ...bundled, source: { type: 'bundled', photoId } };
      expect(ImageAssetSchema.safeParse(bad).success).toBe(false);
    }
  });

  it.each(['image/svg+xml', 'image/bmp', 'text/html', ''])('rejects mime type %j', (mimeType) => {
    const result = ImageAssetSchema.safeParse({
      ...createImageAsset({ mimeType: 'image/png', width: 1, height: 1 }),
      mimeType,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero, fractional and oversized dimensions', () => {
    const base = createImageAsset({ mimeType: 'image/png', width: 1, height: 1 });
    expect(ImageAssetSchema.safeParse({ ...base, width: 0 }).success).toBe(false);
    expect(ImageAssetSchema.safeParse({ ...base, height: 1.5 }).success).toBe(false);
    expect(
      ImageAssetSchema.safeParse({ ...base, width: LIMITS.maxAssetDimension + 1 }).success,
    ).toBe(false);
  });
});

describe('ImageElementSchema', () => {
  it('defaults fit to cover', () => {
    const parsed = ImageElementSchema.parse({
      type: 'image',
      id: 'i1',
      assetId: 'a1',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    });
    expect(parsed.fit).toBe('cover');
  });

  it('rejects unsupported fit modes', () => {
    expect(
      ImageElementSchema.safeParse({
        ...createImageElement({ assetId: 'a1' }),
        fit: 'contain',
      }).success,
    ).toBe(false);
  });
});

describe('DocumentSchema assets', () => {
  it('defaults assets to an empty record for documents without the field', () => {
    const doc = createBlankDocument({ now: fixedDate });
    const { assets: _assets, ...withoutAssets } = doc;
    const parsed = DocumentSchema.parse(withoutAssets);
    expect(parsed.assets).toEqual({});
  });

  it('accepts a document whose image references a registered asset', () => {
    const doc = documentWithImage();
    expect(DocumentSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects images that reference unknown assets', () => {
    const doc = documentWithImage();
    doc.assets = {};
    const result = DocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.path).toEqual(['pages', 0, 'elements', 0, 'assetId']);
    expect(result.error.issues[0]?.message).toContain('asset_1');
  });

  it('rejects asset records whose key does not match the asset id', () => {
    const doc = documentWithImage();
    const asset = doc.assets['asset_1'];
    if (!asset) throw new Error('fixture asset missing');
    doc.assets = { other: asset };
    const result = DocumentSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });

  it('round-trips assets through serialization', () => {
    const doc = documentWithImage();
    const parsed = parseDocument(serializeDocument(doc));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.document.assets).toEqual(doc.assets);
    expect(parsed.value.document.pages[0]?.elements[0]).toMatchObject({
      type: 'image',
      assetId: 'asset_1',
      fit: 'cover',
    });
  });
});

describe('asset queries', () => {
  it('finds assets and collects referenced ids', () => {
    const doc = documentWithImage();
    expect(findAsset(doc, 'asset_1')?.name).toBe('photo.png');
    expect(findAsset(doc, 'missing')).toBeUndefined();
    expect([...collectReferencedAssetIds(doc)]).toEqual(['asset_1']);
  });

  it('fits sizes within bounds without upscaling', () => {
    expect(fitWithin({ width: 4000, height: 2000 }, 1000, 1000)).toEqual({
      width: 1000,
      height: 500,
    });
    expect(fitWithin({ width: 300, height: 600 }, 1000, 500)).toEqual({ width: 250, height: 500 });
    expect(fitWithin({ width: 10, height: 10 }, 1000, 1000)).toEqual({ width: 10, height: 10 });
  });
});
