import {
  MemoryAssetBlobStore,
  ObjectUrlCache,
  browserImageDecoder,
  createAssetResolver,
} from '@opencanvas/storage';
import { useEffect, useState, type ReactNode } from 'react';

import { AssetContext, type AssetServices } from './AssetContext';

export interface AssetProviderProps {
  /** Overrides for tests and alternative storage backends. */
  services?: Partial<AssetServices>;
  children: ReactNode;
}

function createServices(overrides: Partial<AssetServices>): AssetServices {
  const blobStore = overrides.blobStore ?? new MemoryAssetBlobStore();
  const objectUrls = overrides.objectUrls ?? new ObjectUrlCache(blobStore);
  return {
    blobStore,
    objectUrls,
    resolveAssetUrl: overrides.resolveAssetUrl ?? createAssetResolver({ objectUrls }),
    decode: overrides.decode ?? browserImageDecoder,
    ...(overrides.loadImage ? { loadImage: overrides.loadImage } : {}),
  };
}

export function AssetProvider({ services, children }: AssetProviderProps) {
  const [value] = useState(() => createServices(services ?? {}));

  // Object URLs pin blobs in memory until revoked; release them with the editor.
  useEffect(() => () => value.objectUrls.clear(), [value]);

  return <AssetContext.Provider value={value}>{children}</AssetContext.Provider>;
}
