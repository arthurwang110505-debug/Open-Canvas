import type { ImageAsset } from '@opencanvas/document';
import { blobToDataUrl, type AssetBlobStore } from '@opencanvas/storage';

import { bundledPhotoUrl } from '../../assets/photos/catalog';

/** Drawn in place of an image that cannot be read, so previews never show a broken frame. */
export const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

/**
 * Resolves an asset for an SVG rendered inside the app (page strip, dashboard thumbnails): uploads
 * come from the blob store, bundled photos are served by the app itself, and url assets are
 * already a URL. Missing bytes degrade to a transparent pixel instead of failing the whole preview.
 */
export async function resolveAssetHref(
  asset: ImageAsset,
  blobStore: AssetBlobStore | undefined,
): Promise<string> {
  if (asset.source.type === 'url') return asset.source.url;
  if (asset.source.type === 'bundled') {
    return bundledPhotoUrl(asset.source.photoId) ?? TRANSPARENT_PNG;
  }
  try {
    const blob = await blobStore?.get(asset.id);
    if (blob) return await blobToDataUrl(blob);
  } catch {
    // The preview is not worth an error toast; show nothing rather than a broken frame.
  }
  return TRANSPARENT_PNG;
}
