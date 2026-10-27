import 'fake-indexeddb/auto';

import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';

import { createDexieProjectOrganizationStore } from './dexieProjectOrganizationStore';
import { openProjectDatabase } from './dexieProjectStore';
import {
  createMemoryProjectOrganizationStore,
  type ProjectOrganizationStore,
} from './projectOrganization';

const openDatabases: Dexie[] = [];
let databaseCounter = 0;

afterEach(async () => {
  while (openDatabases.length > 0) {
    await openDatabases.pop()?.delete();
  }
});

function makeStores(): { name: string; store: ProjectOrganizationStore }[] {
  databaseCounter += 1;
  const db = openProjectDatabase(`opencanvas-organization-test-${databaseCounter}`);
  openDatabases.push(db);
  return [
    { name: 'memory', store: createMemoryProjectOrganizationStore() },
    { name: 'indexeddb', store: createDexieProjectOrganizationStore(db) },
  ];
}

describe('project organization storage', () => {
  it('upgrades an existing project database without losing saved designs', async () => {
    databaseCounter += 1;
    const name = `opencanvas-legacy-test-${databaseCounter}`;
    const legacy = new Dexie(name);
    legacy.version(1).stores({
      projects: 'id, updatedAt',
      assets: '[projectId+assetId], projectId',
    });
    await legacy.open();
    const row = {
      id: 'doc_kept',
      name: 'Legacy poster',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      size: { width: 1080, height: 1080 },
      pageCount: 1,
      elementCount: 0,
      document: '{"legacy":true}',
    };
    await legacy.table('projects').put(row);
    legacy.close();

    const upgraded = openProjectDatabase(name);
    openDatabases.push(upgraded);
    expect(await upgraded.table('projects').get('doc_kept')).toEqual(row);
    const organization = createDexieProjectOrganizationStore(upgraded);
    expect((await organization.createFolder('Archive')).ok).toBe(true);
  });

  it.each(['memory', 'indexeddb'])(
    '%s persists stars, folders, and folder moves',
    async (backend) => {
      const stores = makeStores();
      const store = stores.find((candidate) => candidate.name === backend)?.store;
      if (!store) throw new Error(`Missing ${backend} store`);

      const created = await store.createFolder('  Campaigns  ');
      expect(created.ok).toBe(true);
      if (!created.ok) return;
      expect(created.value.name).toBe('Campaigns');

      expect(await store.setFolder('doc_spring', created.value.id)).toMatchObject({
        ok: true,
        value: { projectId: 'doc_spring', starred: false, folderId: created.value.id },
      });
      expect(await store.setStarred('doc_spring', true)).toMatchObject({
        ok: true,
        value: { projectId: 'doc_spring', starred: true, folderId: created.value.id },
      });
      expect(await store.load()).toMatchObject({
        ok: true,
        value: {
          projects: [{ projectId: 'doc_spring', starred: true, folderId: created.value.id }],
          folders: [{ id: created.value.id, name: 'Campaigns' }],
        },
      });
      await store.setFolder('doc_unstarred', created.value.id);

      const renamed = await store.renameFolder(created.value.id, 'Spring launches');
      expect(renamed).toMatchObject({ ok: true, value: { name: 'Spring launches' } });
      expect(await store.deleteFolder(created.value.id)).toEqual({ ok: true, value: undefined });
      expect(await store.load()).toMatchObject({
        ok: true,
        value: {
          projects: [{ projectId: 'doc_spring', starred: true, folderId: null }],
          folders: [],
        },
      });
      expect(await store.setFolder('doc_spring', 'folder_missing')).toMatchObject({
        ok: false,
        error: { code: 'not-found' },
      });
    },
  );

  it.each(['memory', 'indexeddb'])(
    '%s validates folder names and cleans up project metadata',
    async (backend) => {
      const stores = makeStores();
      const store = stores.find((candidate) => candidate.name === backend)?.store;
      if (!store) throw new Error(`Missing ${backend} store`);

      expect(await store.createFolder('   ')).toMatchObject({
        ok: false,
        error: { code: 'invalid-name' },
      });
      const folder = await store.createFolder('Designs');
      expect(folder.ok).toBe(true);
      if (!folder.ok) return;
      expect(await store.createFolder('designs')).toMatchObject({
        ok: false,
        error: { code: 'invalid-name', message: 'A folder with that name already exists.' },
      });

      await store.setStarred('doc_a', true);
      await store.setFolder('doc_a', folder.value.id);
      expect(await store.removeProject('doc_a')).toEqual({ ok: true, value: undefined });
      expect(await store.load()).toMatchObject({
        ok: true,
        value: { projects: [], folders: [{ id: folder.value.id, name: 'Designs' }] },
      });
    },
  );
});
