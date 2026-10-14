import type { AssetUrlResolver, ImageSourceLoader } from '@opencanvas/canvas-fabric';
import type { AssetBlobStore, ImageDecoder, ObjectUrlCache } from '@opencanvas/storage';
import { createContext } from 'react';

/**
 * Everything the editor needs to turn files into assets and assets into pixels. Production
 * wires browser implementations; tests inject deterministic decoders and loaders because
 * jsdom cannot decode images.
 */
export interface AssetServices {
  blobStore: AssetBlobStore;
  objectUrls: ObjectUrlCache;
  resolveAssetUrl: AssetUrlResolver;
  decode: ImageDecoder;
  /** Optional override for how the canvas loads a resolved URL (defaults to Fabric's loader). */
  loadImage?: ImageSourceLoader;
}

export const AssetContext = createContext<AssetServices | null>(null);
