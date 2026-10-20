import { generateId } from '@opencanvas/document';
import type { DesignDocument } from '@opencanvas/document';
import { serializeDocument, parseDocument } from '@opencanvas/document';

const SHARE_PREFIX = 'opencanvas:share:';
const SHARE_INDEX_KEY = 'opencanvas:share:index';

export interface SharedLink {
  shareId: string;
  url: string;
}

function shareKey(shareId: string) {
  return `${SHARE_PREFIX}${shareId}`;
}

export function createShareLink(document: DesignDocument): SharedLink {
  const shareId = generateId('shr');
  const serialized = serializeDocument(document);
  try {
    localStorage.setItem(shareKey(shareId), serialized);
    // keep index for cleanup / listing (optional)
    const idxRaw = localStorage.getItem(SHARE_INDEX_KEY);
    const idx: string[] = idxRaw ? JSON.parse(idxRaw) : [];
    idx.unshift(shareId);
    localStorage.setItem(SHARE_INDEX_KEY, JSON.stringify(idx.slice(0, 50)));
  } catch {
    // ignore quota — caller will still get a URL but it may not persist
  }
  const url = `${window.location.origin}${window.location.pathname}#/share/${encodeURIComponent(shareId)}`;
  return { shareId, url };
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
