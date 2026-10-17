import 'fake-indexeddb/auto';

import {
  createBlankDocument,
  createRectElement,
  createTextElement,
  type DesignDocument,
} from '@opencanvas/document';
import type Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createDexieProjectStore,
  indexedDbAvailable,
  openProjectDatabase,
  projectTable,
} from './dexieProjectStore';
import { createMemoryProjectStore } from './memoryProjectStore';
import { toStoredProject, type ProjectStore, type StoredProject } from './projectStore';

const baseDate = new Date('2026-03-04T05:06:07.000Z');

function makeDocument(id: string, name: string, updatedAt: string): DesignDocument {
  const document = createBlankDocument({ id, name, now: baseDate });
  document.pages[0]?.elements.push(
    createRectElement({ id: `${id}_rect`, x: 40, y: 40, width: 200, height: 120 }),
    createTextElement({ id: `${id}_text`, text: 'Spring sale' }),
  );
  document.metadata.updatedAt = updatedAt;
  return document;
}

interface Harness {
  readonly label: string;
  open(seeds?: readonly StoredProject[]): Promise<ProjectStore>;
  close(): Promise<void>;
}

let databaseCounter = 0;
const openDatabases: Dexie[] = [];

const memoryHarness: Harness = {
  label: 'memory',
  open(seeds) {
    return Promise.resolve(createMemoryProjectStore(seeds ? { records: seeds } : {}));
  },
  close() {
    // Nothing to release: the volatile store dies with the test.
    return Promise.resolve();
  },
};

const dexieHarness: Harness = {
  label: 'indexeddb',
  async open(seeds) {
    databaseCounter += 1;
    const db = openProjectDatabase(`opencanvas-test-${databaseCounter}`);
    openDatabases.push(db);
    const table = projectTable(db);
    for (const seed of seeds ?? []) {
      await table.put({ ...seed.summary, document: seed.document });
    }
    return createDexieProjectStore(db);
  },
  async close() {
    while (openDatabases.length > 0) {
      const db = openDatabases.pop();
      await db?.delete();
    }
  },
};

const harnesses: readonly Harness[] = [memoryHarness, dexieHarness];

afterEach(async () => {
  await dexieHarness.close();
});

describe('indexedDbAvailable', () => {
  it('detects the IndexedDB global', () => {
    expect(indexedDbAvailable()).toBe(true);
  });
});

for (const harness of harnesses) {
  describe(`project store (${harness.label})`, () => {
    it('round-trips a document', async () => {
      const store = await harness.open();
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');

      const saved = await store.save(document);
      expect(saved.ok).toBe(true);
      if (!saved.ok) return;
      expect(saved.value).toEqual({
        id: 'doc_a',
        name: 'Poster',
        createdAt: document.metadata.createdAt,
        updatedAt: '2026-03-04T10:00:00.000Z',
        size: { width: document.size.width, height: document.size.height },
        pageCount: 1,
        elementCount: 2,
      });

      const loaded = await store.load('doc_a');
      expect(loaded.ok).toBe(true);
      if (!loaded.ok) return;
      expect(loaded.value).toEqual(document);
    });

    it('replaces an existing project and keeps the newest summary', async () => {
      const store = await harness.open();
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');
      await store.save(document);
      const edited = { ...document, name: 'Poster v2' };
      edited.metadata = { ...document.metadata, updatedAt: '2026-03-04T11:00:00.000Z' };

      await store.save(edited);
      const list = await store.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value).toHaveLength(1);
      expect(list.value[0]?.name).toBe('Poster v2');
      expect(list.value[0]?.updatedAt).toBe('2026-03-04T11:00:00.000Z');
    });

    it('lists projects most recently updated first', async () => {
      const store = await harness.open();
      await store.save(makeDocument('doc_old', 'Old', '2026-01-01T00:00:00.000Z'));
      await store.save(makeDocument('doc_new', 'New', '2026-03-01T00:00:00.000Z'));
      await store.save(makeDocument('doc_mid', 'Mid', '2026-02-01T00:00:00.000Z'));

      const list = await store.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value.map((summary) => summary.id)).toEqual(['doc_new', 'doc_mid', 'doc_old']);
    });

    it('reports a missing project instead of returning undefined data', async () => {
      const store = await harness.open();
      const loaded = await store.load('doc_missing');
      expect(loaded.ok).toBe(false);
      if (loaded.ok) return;
      expect(loaded.error.code).toBe('not-found');
      expect(loaded.error.projectId).toBe('doc_missing');

      const removed = await store.remove('doc_missing');
      expect(removed.ok).toBe(false);
      if (removed.ok) return;
      expect(removed.error.code).toBe('not-found');
    });

    it('refuses to save a document that fails schema validation', async () => {
      const store = await harness.open();
      const broken = { ...makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z'), name: '' };

      const saved = await store.save(broken);
      expect(saved.ok).toBe(false);
      if (saved.ok) return;
      expect(saved.error.code).toBe('invalid-project');
      expect(await store.list()).toEqual({ ok: true, value: [] });
    });

    it('rejects a stored document that cannot be parsed', async () => {
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');
      const corrupt = { ...toStoredProject(document), document: '{"schemaVersion": 1,' };
      const store = await harness.open([corrupt]);

      const loaded = await store.load('doc_a');
      expect(loaded.ok).toBe(false);
      if (loaded.ok) return;
      expect(loaded.error.code).toBe('invalid-project');
      expect(loaded.error.message).toContain('could not be read');
    });

    it('rejects a stored document whose id does not match its record', async () => {
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');
      const other = makeDocument('doc_b', 'Impostor', '2026-03-04T10:00:00.000Z');
      const swapped: StoredProject = {
        summary: toStoredProject(document).summary,
        document: JSON.stringify(other),
      };
      const store = await harness.open([swapped]);

      const loaded = await store.load('doc_a');
      expect(loaded.ok).toBe(false);
      if (loaded.ok) return;
      expect(loaded.error.code).toBe('invalid-project');
      expect(loaded.error.message).toContain('different document id');
    });

    it('duplicates a project with its asset blobs under a new identity', async () => {
      const store = await harness.open();
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');
      await store.save(document);
      const blobs = store.assetBlobStore('doc_a');
      await blobs.put('asset_1', new Blob(['pixels'], { type: 'image/png' }));

      const duplicated = await store.duplicate('doc_a');
      expect(duplicated.ok).toBe(true);
      if (!duplicated.ok) return;
      expect(duplicated.value.id).not.toBe('doc_a');
      expect(duplicated.value.name).toBe('Poster copy');

      const copy = await store.load(duplicated.value.id);
      expect(copy.ok).toBe(true);
      if (!copy.ok) return;
      expect(copy.value.pages[0]?.elements.map((element) => element.id)).toEqual(
        document.pages[0]?.elements.map((element) => element.id),
      );

      const copyBlobs = store.assetBlobStore(duplicated.value.id);
      expect(await copyBlobs.keys()).toEqual(['asset_1']);
      expect(await (await copyBlobs.get('asset_1'))?.text()).toBe('pixels');
      expect(await blobs.keys()).toEqual(['asset_1']);

      const list = await store.list();
      expect(list.ok).toBe(true);
      if (!list.ok) return;
      expect(list.value).toHaveLength(2);
    });

    it('reports a missing project when duplicating', async () => {
      const store = await harness.open();
      const duplicated = await store.duplicate('doc_missing');
      expect(duplicated.ok).toBe(false);
      if (duplicated.ok) return;
      expect(duplicated.error.code).toBe('not-found');
    });

    it('scopes asset blobs to their project', async () => {
      const store = await harness.open();
      const first = store.assetBlobStore('doc_a');
      const second = store.assetBlobStore('doc_b');
      await first.put('asset_1', new Blob(['a'], { type: 'image/png' }));

      expect(await first.has('asset_1')).toBe(true);
      expect(await second.has('asset_1')).toBe(false);
      expect(await second.keys()).toEqual([]);
      expect(store.assetBlobStore('doc_a')).toBeDefined();
      expect(await first.keys()).toEqual(['asset_1']);

      await first.delete('asset_1');
      expect(await first.get('asset_1')).toBeUndefined();
    });

    it('deletes a project together with its asset blobs', async () => {
      const store = await harness.open();
      const document = makeDocument('doc_a', 'Poster', '2026-03-04T10:00:00.000Z');
      await store.save(document);
      const blobs = store.assetBlobStore('doc_a');
      await blobs.put('asset_1', new Blob(['a'], { type: 'image/png' }));

      const removed = await store.remove('doc_a');
      expect(removed.ok).toBe(true);
      expect(await store.list()).toEqual({ ok: true, value: [] });
      expect((await store.load('doc_a')).ok).toBe(false);
      expect(await store.assetBlobStore('doc_a').keys()).toEqual([]);
    });
  });
}
