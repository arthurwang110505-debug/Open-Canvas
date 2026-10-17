import { MemoryAssetBlobStore, type AssetBlobStore } from './assetBlobStore';
import { SharedProjectStore, type ProjectStore, type StoredProject } from './projectStore';

export interface MemoryProjectStoreOptions {
  /** Pre-seeded records; used by tests and by the in-memory demo mode. */
  records?: readonly StoredProject[];
}

export interface MemoryProjectStore extends ProjectStore {
  /** Raw records keyed by project id (diagnostics and tests). */
  readonly raw: ReadonlyMap<string, StoredProject>;
}

/**
 * Volatile backend: projects live for the lifetime of the page. It is the fallback when
 * IndexedDB is unavailable (private mode, older browsers) and the default in tests.
 */
class MemoryProjectStoreImpl extends SharedProjectStore implements MemoryProjectStore {
  private readonly projects = new Map<string, StoredProject>();
  private readonly blobs = new Map<string, MemoryAssetBlobStore>();

  constructor(options: MemoryProjectStoreOptions = {}) {
    super();
    for (const record of options.records ?? []) this.projects.set(record.summary.id, record);
  }

  get raw(): ReadonlyMap<string, StoredProject> {
    return this.projects;
  }

  protected readRecord(projectId: string): Promise<StoredProject | undefined> {
    return Promise.resolve(this.projects.get(projectId));
  }

  protected readAllRecords(): Promise<StoredProject[]> {
    return Promise.resolve([...this.projects.values()]);
  }

  protected writeRecord(record: StoredProject): Promise<void> {
    this.projects.set(record.summary.id, record);
    return Promise.resolve();
  }

  protected removeRecord(projectId: string): Promise<void> {
    this.projects.delete(projectId);
    return Promise.resolve();
  }

  protected async copyBlobs(fromProjectId: string, toProjectId: string): Promise<void> {
    const source = this.blobs.get(fromProjectId);
    if (!source) return;
    const target = this.blobStoreFor(toProjectId);
    for (const assetId of await source.keys()) {
      const blob = await source.get(assetId);
      if (blob) await target.put(assetId, blob);
    }
  }

  protected removeBlobs(projectId: string): Promise<void> {
    this.blobs.delete(projectId);
    return Promise.resolve();
  }

  assetBlobStore(projectId: string): AssetBlobStore {
    return this.blobStoreFor(projectId);
  }

  private blobStoreFor(projectId: string): MemoryAssetBlobStore {
    let store = this.blobs.get(projectId);
    if (!store) {
      store = new MemoryAssetBlobStore();
      this.blobs.set(projectId, store);
    }
    return store;
  }
}

export function createMemoryProjectStore(
  options: MemoryProjectStoreOptions = {},
): MemoryProjectStore {
  return new MemoryProjectStoreImpl(options);
}
