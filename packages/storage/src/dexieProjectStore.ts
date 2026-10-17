import Dexie, { type Table } from 'dexie';

import type { AssetBlobStore } from './assetBlobStore';
import {
  SharedProjectStore,
  projectStoreError,
  type ProjectStore,
  type ProjectStoreError,
  type StoredProject,
  type ProjectSummary,
} from './projectStore';

export const PROJECT_DB_NAME = 'opencanvas';
/** Bumped whenever the schema below changes; Dexie upgrades are declared per version. */
export const PROJECT_DB_VERSION = 1;

/** Denormalized summary fields so listing never has to parse a document. */
export interface ProjectRow extends ProjectSummary {
  document: string;
}

export interface AssetRow {
  projectId: string;
  assetId: string;
  blob: Blob;
}

export type ProjectTable = Table<ProjectRow, string>;
export type AssetTable = Table<AssetRow, [string, string]>;

export function projectTable(db: Dexie): ProjectTable {
  return db.table<ProjectRow, string>('projects');
}

export function assetTable(db: Dexie): AssetTable {
  return db.table<AssetRow, [string, string]>('assets');
}

/**
 * Opens (or creates) the local project database. Dexie connects lazily on first use, so this
 * never throws synchronously — failures surface as rejected promises mapped to store errors.
 */
export function openProjectDatabase(name: string = PROJECT_DB_NAME): Dexie {
  const db = new Dexie(name);
  db.version(PROJECT_DB_VERSION).stores({
    projects: 'id, updatedAt',
    assets: '[projectId+assetId], projectId',
  });
  return db;
}

/** IndexedDB is missing in some private-mode browsers and in plain Node. */
export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

function rowToRecord(row: ProjectRow): StoredProject {
  const { document, ...summary } = row;
  return { summary, document };
}

function recordToRow(record: StoredProject): ProjectRow {
  return { ...record.summary, document: record.document };
}

function errorName(value: unknown): string | undefined {
  if (value instanceof Error) return value.name;
  if (typeof value === 'object' && value !== null && 'name' in value) {
    return typeof value.name === 'string' ? value.name : undefined;
  }
  return undefined;
}

/** Dexie wraps the underlying DOMException, so both the error and its `inner` are checked. */
export function isQuotaExceeded(cause: unknown): boolean {
  if (errorName(cause) === 'QuotaExceededError') return true;
  if (typeof cause === 'object' && cause !== null && 'inner' in cause) {
    return errorName(cause.inner) === 'QuotaExceededError';
  }
  return false;
}

/** Project-scoped blob storage: asset bytes live next to the document they belong to. */
export class DexieAssetBlobStore implements AssetBlobStore {
  constructor(
    private readonly assets: AssetTable,
    private readonly projectId: string,
  ) {}

  async put(assetId: string, blob: Blob): Promise<void> {
    await this.assets.put({ projectId: this.projectId, assetId, blob });
  }

  async get(assetId: string): Promise<Blob | undefined> {
    const row = await this.assets.get([this.projectId, assetId]);
    return row?.blob;
  }

  async has(assetId: string): Promise<boolean> {
    return (await this.assets.get([this.projectId, assetId])) !== undefined;
  }

  async delete(assetId: string): Promise<void> {
    await this.assets.delete([this.projectId, assetId]);
  }

  async keys(): Promise<string[]> {
    const keys = await this.assets.where('projectId').equals(this.projectId).primaryKeys();
    return keys.map(([, assetId = '']) => assetId).filter((assetId) => assetId.length > 0);
  }
}

/** IndexedDB-backed project store. Documents are kept as canonical JSON and re-validated on read. */
export class DexieProjectStore extends SharedProjectStore implements ProjectStore {
  private readonly projects: ProjectTable;
  private readonly assets: AssetTable;

  constructor(db: Dexie) {
    super();
    this.projects = projectTable(db);
    this.assets = assetTable(db);
  }

  protected async readRecord(projectId: string): Promise<StoredProject | undefined> {
    const row = await this.projects.get(projectId);
    return row ? rowToRecord(row) : undefined;
  }

  protected async readAllRecords(): Promise<StoredProject[]> {
    const rows = await this.projects.toArray();
    return rows.map(rowToRecord);
  }

  protected async writeRecord(record: StoredProject): Promise<void> {
    await this.projects.put(recordToRow(record));
  }

  protected async removeRecord(projectId: string): Promise<void> {
    await this.projects.delete(projectId);
  }

  protected async copyBlobs(fromProjectId: string, toProjectId: string): Promise<void> {
    const rows = await this.assets.where('projectId').equals(fromProjectId).toArray();
    if (rows.length === 0) return;
    await this.assets.bulkAdd(
      rows.map((row) => ({ projectId: toProjectId, assetId: row.assetId, blob: row.blob })),
    );
  }

  protected async removeBlobs(projectId: string): Promise<void> {
    await this.assets.where('projectId').equals(projectId).delete();
  }

  assetBlobStore(projectId: string): AssetBlobStore {
    return new DexieAssetBlobStore(this.assets, projectId);
  }

  protected override failure(cause: unknown, projectId?: string): ProjectStoreError {
    if (isQuotaExceeded(cause)) {
      return projectStoreError(
        'quota-exceeded',
        'The browser ran out of local storage space. Free up space (delete designs or images) and try again.',
        { ...(projectId ? { projectId } : {}), cause },
      );
    }
    return super.failure(cause, projectId);
  }
}

export function createDexieProjectStore(db: Dexie): DexieProjectStore {
  return new DexieProjectStore(db);
}
