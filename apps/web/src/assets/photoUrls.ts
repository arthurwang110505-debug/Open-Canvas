/**
 * Image URLs the user has imported from the web, remembered in this browser so the photo
 * library can grow without bundling more files. Only the URLs are kept — the bytes are
 * fetched again on each insert, so a remembered link never goes stale in storage.
 */
export const PHOTO_URLS_STORAGE_KEY = 'opencanvas:photo-urls:v1';
export const MAX_REMEMBERED_PHOTO_URLS = 12;

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function sanitize(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const entry of urls) {
    if (typeof entry !== 'string') continue;
    const url = entry.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) continue;
    if (out.includes(url)) continue;
    out.push(url);
    if (out.length >= MAX_REMEMBERED_PHOTO_URLS) break;
  }
  return out;
}

/** The remembered image URLs, most recently used first. */
export function listPhotoUrls(storage: Storage | null = defaultStorage()): string[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(PHOTO_URLS_STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function persist(urls: string[], storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.setItem(PHOTO_URLS_STORAGE_KEY, JSON.stringify(urls));
  } catch {
    // Quota or private mode: the list simply is not kept.
  }
}

/** Remembers a URL at the front of the list. Returns the updated list. */
export function rememberPhotoUrl(
  url: string,
  storage: Storage | null = defaultStorage(),
): string[] {
  const trimmed = url.trim();
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return listPhotoUrls(storage);
  }
  const next = [trimmed, ...listPhotoUrls(storage).filter((entry) => entry !== trimmed)].slice(
    0,
    MAX_REMEMBERED_PHOTO_URLS,
  );
  persist(next, storage);
  return next;
}

/** Forgets a URL. Returns the updated list. */
export function forgetPhotoUrl(url: string, storage: Storage | null = defaultStorage()): string[] {
  const next = listPhotoUrls(storage).filter((entry) => entry !== url);
  persist(next, storage);
  return next;
}
