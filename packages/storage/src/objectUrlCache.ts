import type { AssetBlobStore } from './assetBlobStore';

export interface ObjectUrlFactory {
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
}

function defaultFactory(): ObjectUrlFactory {
  return {
    createObjectURL: (blob) => URL.createObjectURL(blob),
    revokeObjectURL: (url) => {
      URL.revokeObjectURL(url);
    },
  };
}

/**
 * Hands out one object URL per asset and revokes it when released, so repeated renders of
 * the same image do not leak memory. Concurrent requests for the same asset share a single
 * lookup.
 */
export class ObjectUrlCache {
  private readonly urls = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string | null>>();
  private readonly factory: ObjectUrlFactory;

  constructor(
    private readonly store: AssetBlobStore,
    factory: ObjectUrlFactory = defaultFactory(),
  ) {
    this.factory = factory;
  }

  /** Resolves to an object URL for the asset, or `null` when the bytes are not in the store. */
  resolve(assetId: string): Promise<string | null> {
    const cached = this.urls.get(assetId);
    if (cached !== undefined) return Promise.resolve(cached);
    const inFlight = this.pending.get(assetId);
    if (inFlight) return inFlight;

    const lookup = this.store
      .get(assetId)
      .then((blob) => {
        if (!blob) return null;
        // Another caller may have released the asset while we were loading.
        const existing = this.urls.get(assetId);
        if (existing !== undefined) return existing;
        const url = this.factory.createObjectURL(blob);
        this.urls.set(assetId, url);
        return url;
      })
      .finally(() => {
        this.pending.delete(assetId);
      });
    this.pending.set(assetId, lookup);
    return lookup;
  }

  /** Synchronous lookup for assets that were already resolved. */
  peek(assetId: string): string | undefined {
    return this.urls.get(assetId);
  }

  release(assetId: string): void {
    const url = this.urls.get(assetId);
    if (url === undefined) return;
    this.urls.delete(assetId);
    this.factory.revokeObjectURL(url);
  }

  clear(): void {
    for (const assetId of [...this.urls.keys()]) this.release(assetId);
  }
}
