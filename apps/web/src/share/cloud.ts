import { err, generateId, ok, serializeDocument, parseDocument } from '@opencanvas/document';
import type { DesignDocument, Result } from '@opencanvas/document';

const SHARE_PREFIX = 'opencanvas:share:';
const SHARE_INDEX_KEY = 'opencanvas:share:index';

export interface SharedLink {
  shareId: string;
  url: string;
}

export interface ShareLinkError {
  code: 'storage-unavailable';
  message: string;
  cause?: unknown;
}

function shareKey(shareId: string) {
  return `${SHARE_PREFIX}${shareId}`;
}

export function createShareLink(document: DesignDocument): Result<SharedLink, ShareLinkError> {
  const shareId = generateId('shr');
  const serialized = serializeDocument(document);
  const key = shareKey(shareId);
  try {
    localStorage.setItem(key, serialized);
    // Never hand out a URL unless the document can actually be read back in this browser.
    if (localStorage.getItem(key) === null) {
      throw new Error('The browser did not retain the design.');
    }
  } catch (cause) {
    return err({
      code: 'storage-unavailable',
      message:
        'This browser could not save a view link. Check storage permissions or available space, then try again. You can still download or export the design.',
      cause,
    });
  }

  try {
    // The index is only for cleanup and listing. Its failure does not invalidate the share.
    const idxRaw = localStorage.getItem(SHARE_INDEX_KEY);
    const stored: unknown = idxRaw ? JSON.parse(idxRaw) : [];
    const idx = Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === 'string')
      : [];
    idx.unshift(shareId);
    localStorage.setItem(SHARE_INDEX_KEY, JSON.stringify(idx.slice(0, 50)));
  } catch {
    // The share itself is valid; only the optional local index could not be updated.
  }

  const url = `${window.location.origin}${window.location.pathname}#/share/${encodeURIComponent(shareId)}`;
  return ok({ shareId, url });
}

export function loadSharedDocument(shareId: string): DesignDocument | null {
  try {
    const raw = localStorage.getItem(shareKey(shareId));
    if (!raw) return null;
    const parsed = parseDocument(raw);
    if (!parsed.ok) return null;
    return parsed.value.document;
  } catch {
    return null;
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
