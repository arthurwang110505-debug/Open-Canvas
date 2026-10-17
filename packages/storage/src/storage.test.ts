import { LIMITS } from '@opencanvas/document';
import { describe, expect, it, vi } from 'vitest';

import { MemoryAssetBlobStore } from './assetBlobStore';
import { createAssetResolver, isSafeAssetUrl } from './assetResolver';
import { importImageFile } from './importImage';
import { ObjectUrlCache } from './objectUrlCache';
import { sniffImageMimeType } from './sniff';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46];
const GIF_HEADER = [...'GIF89a'].map((c) => c.charCodeAt(0));
const WEBP_HEADER = [
  ...[...'RIFF'].map((c) => c.charCodeAt(0)),
  0,
  0,
  0,
  0,
  ...[...'WEBP'].map((c) => c.charCodeAt(0)),
];

function fileOf(bytes: number[], name: string, type: string, padTo = 0): File {
  const data = new Uint8Array(Math.max(bytes.length, padTo));
  data.set(bytes);
  return new File([data], name, { type });
}

const fixedDate = new Date('2026-01-02T03:04:05.000Z');
const decodeAs = (width: number, height: number) => () => Promise.resolve({ width, height });

describe('sniffImageMimeType', () => {
  it.each([
    ['image/png', PNG_HEADER],
    ['image/jpeg', JPEG_HEADER],
    ['image/gif', GIF_HEADER],
    ['image/webp', WEBP_HEADER],
  ] as const)('detects %s', (expected, header) => {
    expect(sniffImageMimeType(new Uint8Array(header))).toBe(expected);
  });

  it('returns null for unknown or truncated data', () => {
    expect(sniffImageMimeType(new Uint8Array([0x3c, 0x73, 0x76, 0x67]))).toBeNull();
    expect(sniffImageMimeType(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(sniffImageMimeType(new Uint8Array([]))).toBeNull();
  });
});

describe('importImageFile', () => {
  it('produces an asset record and a typed blob from a valid file', async () => {
    const file = fileOf(PNG_HEADER, 'photo.png', 'image/png', 100);
    const result = await importImageFile(file, {
      decode: decodeAs(640, 480),
      assetId: 'asset_1',
      now: fixedDate,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.asset).toEqual({
      id: 'asset_1',
      kind: 'image',
      name: 'photo.png',
      mimeType: 'image/png',
      width: 640,
      height: 480,
      byteSize: 100,
      source: { type: 'local' },
      createdAt: fixedDate.toISOString(),
    });
    expect(result.value.blob.type).toBe('image/png');
    expect(result.value.blob.size).toBe(100);
  });

  it('trusts the bytes over the reported file type', async () => {
    const file = fileOf(JPEG_HEADER, 'actually.png', 'image/png', 50);
    const result = await importImageFile(file, { decode: decodeAs(1, 1) });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.asset.mimeType).toBe('image/jpeg');
    expect(result.value.blob.type).toBe('image/jpeg');
  });

  it('rejects empty files', async () => {
    const result = await importImageFile(new File([], 'empty.png', { type: 'image/png' }), {
      decode: decodeAs(1, 1),
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'empty' } });
  });

  it('rejects files above the size limit with a readable message', async () => {
    const file = fileOf(PNG_HEADER, 'big.png', 'image/png', 2048);
    const result = await importImageFile(file, { maxBytes: 1024, decode: decodeAs(1, 1) });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('too-large');
    expect(result.error.message).toContain('1 KB');
  });

  it('rejects files that are not a supported raster format', async () => {
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'icon.svg', {
      type: 'image/svg+xml',
    });
    const decode = vi.fn(decodeAs(1, 1));
    const result = await importImageFile(svg, { decode });
    expect(result).toMatchObject({ ok: false, error: { code: 'unsupported-type' } });
    expect(decode).not.toHaveBeenCalled();
  });

  it('honours a narrower allow-list', async () => {
    const file = fileOf(GIF_HEADER, 'anim.gif', 'image/gif', 40);
    const result = await importImageFile(file, {
      allowedTypes: ['image/png', 'image/jpeg'],
      decode: decodeAs(1, 1),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unsupported-type');
    expect(result.error.message).toContain('PNG, JPEG');
  });

  it('reports decoder failures instead of throwing', async () => {
    const file = fileOf(PNG_HEADER, 'corrupt.png', 'image/png', 40);
    const result = await importImageFile(file, {
      decode: () => Promise.reject(new Error('bad chunk')),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('decode-failed');
    expect(result.error.message).toContain('bad chunk');
  });

  it('rejects images beyond the maximum dimension', async () => {
    const file = fileOf(PNG_HEADER, 'huge.png', 'image/png', 40);
    const result = await importImageFile(file, {
      decode: decodeAs(LIMITS.maxAssetDimension + 1, 10),
    });
    expect(result).toMatchObject({ ok: false, error: { code: 'too-large-dimensions' } });
  });

  it('rejects nonsensical decoder output', async () => {
    const file = fileOf(PNG_HEADER, 'odd.png', 'image/png', 40);
    const result = await importImageFile(file, { decode: decodeAs(0, 10) });
    expect(result).toMatchObject({ ok: false, error: { code: 'decode-failed' } });
  });
});

describe('MemoryAssetBlobStore', () => {
  it('stores, lists and deletes blobs', async () => {
    const store = new MemoryAssetBlobStore();
    const blob = new Blob(['abc'], { type: 'image/png' });
    await store.put('a', blob);
    expect(await store.has('a')).toBe(true);
    expect(await store.get('a')).toBe(blob);
    expect(await store.keys()).toEqual(['a']);
    await store.delete('a');
    expect(await store.has('a')).toBe(false);
    expect(await store.get('a')).toBeUndefined();
    expect(store.size).toBe(0);
  });
});

describe('ObjectUrlCache', () => {
  function makeCache() {
    const store = new MemoryAssetBlobStore();
    let counter = 0;
    const factory = {
      createObjectURL: vi.fn(() => `blob:test/${String(++counter)}`),
      revokeObjectURL: vi.fn<(url: string) => void>(),
    };
    return { store, factory, cache: new ObjectUrlCache(store, factory) };
  }

  it('creates one object URL per asset and shares concurrent lookups', async () => {
    const { store, factory, cache } = makeCache();
    await store.put('a', new Blob(['x']));
    const [first, second] = await Promise.all([cache.resolve('a'), cache.resolve('a')]);
    expect(first).toBe('blob:test/1');
    expect(second).toBe('blob:test/1');
    expect(await cache.resolve('a')).toBe('blob:test/1');
    expect(factory.createObjectURL).toHaveBeenCalledTimes(1);
    expect(cache.peek('a')).toBe('blob:test/1');
  });

  it('resolves to null for unknown assets', async () => {
    const { cache, factory } = makeCache();
    expect(await cache.resolve('missing')).toBeNull();
    expect(factory.createObjectURL).not.toHaveBeenCalled();
  });

  it('revokes urls on release and clear', async () => {
    const { store, factory, cache } = makeCache();
    await store.put('a', new Blob(['x']));
    await store.put('b', new Blob(['y']));
    await cache.resolve('a');
    await cache.resolve('b');
    cache.release('a');
    expect(factory.revokeObjectURL).toHaveBeenCalledWith('blob:test/1');
    expect(cache.peek('a')).toBeUndefined();
    cache.clear();
    expect(factory.revokeObjectURL).toHaveBeenCalledWith('blob:test/2');
    expect(cache.peek('b')).toBeUndefined();
  });

  it('works with the platform object URL implementation', async () => {
    const store = new MemoryAssetBlobStore();
    await store.put('a', new Blob(['x'], { type: 'image/png' }));
    const cache = new ObjectUrlCache(store);
    const url = await cache.resolve('a');
    expect(url).toMatch(/^blob:/);
    cache.release('a');
  });
});

describe('asset url safety', () => {
  it.each([
    'https://cdn.example.com/a.png',
    'http://localhost:5173/templates/a.png',
    '/templates/a.png',
    'templates/a.png',
  ])('accepts %s', (url) => {
    expect(isSafeAssetUrl(url, 'https://app.example.com/editor')).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'blob:https://app.example.com/123',
    'file:///etc/passwd',
    'ftp://example.com/a.png',
    '',
    'https://example.com/a\u0000.png',
  ])('rejects %j', (url) => {
    expect(isSafeAssetUrl(url, 'https://app.example.com/editor')).toBe(false);
  });

  it('rejects relative urls when no base is available', () => {
    expect(isSafeAssetUrl('/templates/a.png')).toBe(false);
  });
});

describe('createAssetResolver', () => {
  it('resolves local assets through the object url cache and url assets when safe', async () => {
    const store = new MemoryAssetBlobStore();
    await store.put('local_1', new Blob(['x']));
    const cache = new ObjectUrlCache(store, {
      createObjectURL: () => 'blob:test/local',
      revokeObjectURL: () => undefined,
    });
    const resolve = createAssetResolver({ objectUrls: cache, baseUrl: 'https://app.example.com/' });
    const base = {
      kind: 'image' as const,
      mimeType: 'image/png' as const,
      width: 1,
      height: 1,
      createdAt: fixedDate.toISOString(),
    };
    expect(await resolve({ ...base, id: 'local_1', source: { type: 'local' } })).toBe(
      'blob:test/local',
    );
    expect(await resolve({ ...base, id: 'local_2', source: { type: 'local' } })).toBeNull();
    expect(
      await resolve({ ...base, id: 'u1', source: { type: 'url', url: 'https://x.test/a.png' } }),
    ).toBe('https://x.test/a.png');
    expect(
      await resolve({ ...base, id: 'u2', source: { type: 'url', url: 'javascript:alert(1)' } }),
    ).toBeNull();
  });
});
