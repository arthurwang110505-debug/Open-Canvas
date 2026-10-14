import type { Asset } from '@opencanvas/document';
import { useContext, useEffect, useState } from 'react';

import { AssetContext, type AssetServices } from './AssetContext';

export function useAssetServices(): AssetServices {
  const services = useContext(AssetContext);
  if (!services) throw new Error('Asset hooks must be used inside <AssetProvider>.');
  return services;
}

/** Resolves a displayable URL for an asset (thumbnails). `null` while loading or unavailable. */
export function useAssetUrl(asset: Asset): string | null {
  const { resolveAssetUrl, objectUrls } = useAssetServices();
  const [url, setUrl] = useState<string | null>(() =>
    asset.source.type === 'local' ? (objectUrls.peek(asset.id) ?? null) : null,
  );

  useEffect(() => {
    let cancelled = false;
    resolveAssetUrl(asset)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((error: unknown) => {
        console.warn(`Could not resolve asset ${asset.id} for preview.`, error);
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [asset, resolveAssetUrl]);

  return url;
}
