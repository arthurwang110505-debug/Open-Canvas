import {
  createBlankDocument,
  createImageAsset,
  createImageElement,
  createRectElement,
  createTextElement,
  CURRENT_SCHEMA_VERSION,
  serializeDocument,
  type DesignDocument,
} from '@opencanvas/document';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import {
  MAX_PROJECT_FILE_BYTES,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_FORMAT_VERSION,
  PROJECT_FILE_MEDIA_TYPE,
  packProject,
  unpackProject,
  type ProjectFileManifest,
} from './projectFile';

const now = new Date('2026-05-10T09:00:00.000Z');
const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);
const JPEG_BYTES = new Uint8Array([255, 216, 255, 224, 9, 8, 7]);

function documentWithAssets(): DesignDocument {
  const document = createBlankDocument({ id: 'doc_file', name: 'Flyer', now });
  const png = createImageAsset({
    id: 'asset_png',
    name: 'logo.png',
    mimeType: 'image/png',
    width: 8,
    height: 8,
    now,
  });
  const jpeg = createImageAsset({
    id: 'asset_jpeg',
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    width: 12,
    height: 9,
    now,
  });
  document.assets = { [png.id]: png, [jpeg.id]: jpeg };
  document.pages[0]?.elements.push(
    createRectElement({ id: 'r1', x: 10, y: 10, width: 100, height: 60 }),
    createTextElement({ id: 't1', text: 'Grand opening', x: 20, y: 90 }),
    createImageElement({ id: 'i1', assetId: png.id, x: 40, y: 200, width: 200, height: 200 }),
  );
  return document;
}

function assetReader(blobs: Record<string, Uint8Array>) {
  return (assetId: string) => {
    const bytes = blobs[assetId];
    return Promise.resolve(bytes ? new Blob([bytes.slice()]) : undefined);
  };
}

/** Reads one entry of an archive, failing the test when it is absent. */
function entryOf(entries: Record<string, Uint8Array>, name: string): Uint8Array {
  const bytes = entries[name];
  if (!bytes) throw new Error(`expected the archive to contain ${name}`);
  return bytes;
}

function zipOf(files: Record<string, Uint8Array>): Uint8Array {
  return zipSync(files, { level: 6 });
}

/** A valid archive for a document, used by the guard tests. */
function archiveOf(document: DesignDocument): Uint8Array {
  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(manifest({ assetCount: 2 })),
    'document.json': strToU8(serializeDocument(document)),
    'assets/asset_png.png': PNG_BYTES,
    'assets/asset_jpeg.jpg': JPEG_BYTES,
  };
  return zipOf(files);
}

function manifest(overrides: Partial<ProjectFileManifest> = {}): string {
  return JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_FORMAT_VERSION,
    schemaVersion: 1,
    assetCount: 0,
    createdAt: now.toISOString(),
    ...overrides,
  });
}

describe('packing a project file', () => {
  it('produces a ZIP holding the manifest, the document and every local asset', async () => {
    const document = documentWithAssets();
    const packed = await packProject({
      document,
      readAsset: assetReader({ asset_png: PNG_BYTES, asset_jpeg: JPEG_BYTES }),
      now,
    });
    expect(packed.ok).toBe(true);
    if (!packed.ok) return;
    expect(packed.value.type).toBe(PROJECT_FILE_MEDIA_TYPE);

    const restored = await unpackProject(packed.value);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    expect(restored.value.document).toEqual(document);
    expect(restored.value.blobs.size).toBe(2);
    const pngBlob = restored.value.blobs.get('asset_png');
    const jpegBlob = restored.value.blobs.get('asset_jpeg');
    if (!pngBlob || !jpegBlob) throw new Error('expected both asset blobs');
    expect(pngBlob.type).toBe('image/png');
    expect(new Uint8Array(await pngBlob.arrayBuffer())).toEqual(PNG_BYTES);
    expect(jpegBlob.type).toBe('image/jpeg');
    expect(new Uint8Array(await jpegBlob.arrayBuffer())).toEqual(JPEG_BYTES);
  });

  it('records the manifest the container advertises', async () => {
    const document = documentWithAssets();
    const packed = await packProject({
      document,
      readAsset: assetReader({ asset_png: PNG_BYTES, asset_jpeg: JPEG_BYTES }),
      now,
    });
    if (!packed.ok) throw new Error('expected packing to succeed');
    const entries = unzipSync(new Uint8Array(await packed.value.arrayBuffer()));
    expect(Object.keys(entries).sort()).toEqual([
      'assets/asset_jpeg.jpg',
      'assets/asset_png.png',
      'document.json',
      'manifest.json',
    ]);
    const written = JSON.parse(strFromU8(entryOf(entries, 'manifest.json'))) as ProjectFileManifest;
    expect(written.format).toBe(PROJECT_FILE_FORMAT);
    expect(written.formatVersion).toBe(1);
    expect(written.assetCount).toBe(2);
    expect(written.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(written.createdAt).toBe(now.toISOString());
    expect(strFromU8(entryOf(entries, 'document.json'))).toBe(serializeDocument(document));
  });

  it('leaves remote assets out of the archive', async () => {
    const document = documentWithAssets();
    document.assets['asset_url'] = createImageAsset({
      id: 'asset_url',
      name: 'remote.png',
      mimeType: 'image/png',
      width: 4,
      height: 4,
      source: { type: 'url', url: 'https://example.test/logo.png' },
      now,
    });

    const packed = await packProject({
      document,
      readAsset: assetReader({ asset_png: PNG_BYTES, asset_jpeg: JPEG_BYTES }),
      now,
    });
    if (!packed.ok) throw new Error('expected packing to succeed');
    const restored = await unpackProject(packed.value);
    if (!restored.ok) throw new Error('expected unpacking to succeed');
    expect(restored.value.blobs.size).toBe(2);
    expect(restored.value.blobs.has('asset_url')).toBe(false);
    expect(restored.value.document.assets['asset_url']?.source.type).toBe('url');
  });

  it('refuses to pack when an asset has no bytes left', async () => {
    const packed = await packProject({
      document: documentWithAssets(),
      readAsset: assetReader({ asset_png: PNG_BYTES }), // jpeg is gone
      now,
    });
    expect(packed.ok).toBe(false);
    if (packed.ok) return;
    expect(packed.error.code).toBe('asset-missing');
    expect(packed.error.message).toContain('photo.jpg');
  });

  it('refuses to pack a document that is not valid', async () => {
    const document = documentWithAssets();
    const element = document.pages[0]?.elements[0];
    if (element) element.id = 'has a space';

    const packed = await packProject({
      document,
      readAsset: assetReader({ asset_png: PNG_BYTES, asset_jpeg: JPEG_BYTES }),
      now,
    });
    expect(packed.ok).toBe(false);
    if (packed.ok) return;
    expect(packed.error.code).toBe('invalid-document');
  });
});

describe('unpacking a project file', () => {
  it('accepts a Blob as well as raw bytes', async () => {
    const packed = await packProject({
      document: documentWithAssets(),
      readAsset: assetReader({ asset_png: PNG_BYTES, asset_jpeg: JPEG_BYTES }),
      now,
    });
    if (!packed.ok) throw new Error('expected packing to succeed');
    const fromBytes = await unpackProject(new Uint8Array(await packed.value.arrayBuffer()));
    expect(fromBytes.ok).toBe(true);
  });

  it('rejects something that is not a ZIP archive', async () => {
    const result = await unpackProject(strToU8('this is not a project file'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not-a-project-file');
  });

  it('rejects an archive without a manifest', async () => {
    const result = await unpackProject(zipOf({ 'document.json': strToU8('{}') }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not-a-project-file');
    expect(result.error.message).toContain('manifest.json');
  });

  it('rejects a manifest for a different format', async () => {
    const result = await unpackProject(
      zipOf({ 'manifest.json': strToU8(manifest({ format: 'someone-elses-project' as never })) }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not-a-project-file');
    expect(result.error.message).toContain('someone-elses-project');
  });

  it('rejects a manifest with broken JSON', async () => {
    const result = await unpackProject(zipOf({ 'manifest.json': strToU8('{oops') }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('not-a-project-file');
    expect(result.error.message).toContain('JSON');
  });

  it('rejects a file written by a newer format version', async () => {
    const result = await unpackProject(
      zipOf({
        'manifest.json': strToU8(manifest({ formatVersion: PROJECT_FILE_FORMAT_VERSION + 1 })),
        'document.json': strToU8(serializeDocument(documentWithAssets())),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('unsupported-format');
    expect(result.error.message).toContain('Update OpenCanvas');
  });

  it('rejects an archive with no document', async () => {
    const result = await unpackProject(zipOf({ 'manifest.json': strToU8(manifest()) }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('missing-document');
  });

  it('rejects a document that is not valid JSON', async () => {
    const result = await unpackProject(
      zipOf({
        'manifest.json': strToU8(manifest()),
        'document.json': strToU8('{ "pages": '),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-document');
  });

  it('rejects a document with a schema version this build cannot read', async () => {
    const future = { ...documentWithAssets(), schemaVersion: 99 };
    const result = await unpackProject(
      zipOf({
        'manifest.json': strToU8(manifest({ schemaVersion: 99 })),
        'document.json': strToU8(JSON.stringify(future)),
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-document');
    expect(result.error.message.toLowerCase()).toContain('schema');
  });

  it('rejects a file that is missing an asset it references', async () => {
    const document = documentWithAssets();
    const result = await unpackProject(
      zipOf({
        'manifest.json': strToU8(manifest({ assetCount: 1 })),
        'document.json': strToU8(serializeDocument(document)),
        'assets/asset_png.png': PNG_BYTES, // the jpeg entry is absent
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('asset-missing');
    expect(result.error.message).toContain('photo.jpg');
  });

  it('ignores asset files the document no longer references', async () => {
    const document = documentWithAssets();
    delete document.assets['asset_jpeg'];
    const page = document.pages[0];
    if (page) page.elements = page.elements.filter((element) => element.id !== 'i1');
    page?.elements.push(createImageElement({ id: 'i2', assetId: 'asset_png' }));

    const result = await unpackProject(
      zipOf({
        'manifest.json': strToU8(manifest({ assetCount: 2 })),
        'document.json': strToU8(serializeDocument(document)),
        'assets/asset_png.png': PNG_BYTES,
        'assets/asset_jpeg.jpg': JPEG_BYTES,
        'assets/asset_stale.png': new Uint8Array([1, 2, 3, 4]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect([...result.value.blobs.keys()]).toEqual(['asset_png']);
  });

  it('rejects archives that would exceed the unpacked size limit', async () => {
    const result = await unpackProject(archiveOf(documentWithAssets()), {
      maxUnpackedBytes: 64, // far below the real archive
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('too-large');
    expect(result.error.message).toContain('unpacks to');
  });

  it('rejects archives with more entries than the model allows', async () => {
    const result = await unpackProject(archiveOf(documentWithAssets()), { maxEntries: 2 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('too-large');
    expect(result.error.message).toContain('entries');
  });

  it('rejects oversized input before unpacking it', async () => {
    const oversized = new Uint8Array(MAX_PROJECT_FILE_BYTES + 1);
    const result = await unpackProject(oversized);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('too-large');
    expect(result.error.message).toContain('MB');
  });
});
