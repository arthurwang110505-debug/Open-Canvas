/**
 * Stores the bytes behind `source: { type: 'local' }` assets. The document only carries
 * asset metadata, so every persistence backend (memory, IndexedDB, cloud) implements this
 * small interface and the editor never touches storage APIs directly.
 */
export interface AssetBlobStore {
  put(assetId: string, blob: Blob): Promise<void>;
  get(assetId: string): Promise<Blob | undefined>;
  has(assetId: string): Promise<boolean>;
  delete(assetId: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** In-memory store used by the editor session, tests and the demo without persistence. */
export class MemoryAssetBlobStore implements AssetBlobStore {
  private readonly blobs = new Map<string, Blob>();

  put(assetId: string, blob: Blob): Promise<void> {
    this.blobs.set(assetId, blob);
    return Promise.resolve();
  }

  get(assetId: string): Promise<Blob | undefined> {
    return Promise.resolve(this.blobs.get(assetId));
  }

  has(assetId: string): Promise<boolean> {
    return Promise.resolve(this.blobs.has(assetId));
  }

  delete(assetId: string): Promise<void> {
    this.blobs.delete(assetId);
    return Promise.resolve();
  }

  keys(): Promise<string[]> {
    return Promise.resolve([...this.blobs.keys()]);
  }

  /** Number of stored blobs (diagnostics and tests). */
  get size(): number {
    return this.blobs.size;
  }
}
