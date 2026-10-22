import type { Asset } from '@opencanvas/document';

import type { ObjectUrlCache } from './objectUrlCache';

/** Maps an asset record to something an `<img>` can load, or `null` when unavailable. */
export type AssetUrlResolver = (asset: Asset) => Promise<string | null>;

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * URL assets may come from untrusted documents (imported files, templates, AI output).
 * Only absolute http(s) URLs and same-origin relative paths are allowed; `javascript:`,
 * `data:`, `blob:` and `file:` schemes are rejected.
 */
function hasControlCharacters(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

export function isSafeAssetUrl(url: string, base?: string): boolean {
  if (url.length === 0 || hasControlCharacters(url)) return false;
  let parsed: URL;
  try {
    parsed = base === undefined ? new URL(url) : new URL(url, base);
  } catch {
    return false;
  }
  return SAFE_PROTOCOLS.has(parsed.protocol);
}

export interface CreateAssetResolverOptions {
  objectUrls: ObjectUrlCache;
  /** Base used to resolve relative URL assets (defaults to the page origin in browsers). */
  baseUrl?: string;
  /**
   * Maps a bundled photo id to the URL the app ships it under. The catalogue is app content, not
   * document content: an id this build does not know resolves to `null` and the image is reported
   * missing, while the element stays intact.
   */
  bundledPhotoUrl?: (photoId: string) => string | null | undefined;
}

export function createAssetResolver(options: CreateAssetResolverOptions): AssetUrlResolver {
  return async (asset) => {
    switch (asset.source.type) {
      case 'local':
        return options.objectUrls.resolve(asset.id);
      case 'url': {
        const base =
          options.baseUrl ?? (typeof location === 'undefined' ? undefined : location.href);
        return isSafeAssetUrl(asset.source.url, base) ? asset.source.url : null;
      }
      case 'bundled':
        return options.bundledPhotoUrl?.(asset.source.photoId) ?? null;
    }
  };
}
