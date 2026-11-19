import { generateId, validateDocument, type DesignDocument } from '@opencanvas/document';

/**
 * Named versions: snapshots of a design saved in this browser, separate from the undo history.
 * They live in localStorage under one key per design, so they survive reloads without an
 * account — and without touching the document schema. Restoring one goes through the normal
 * `document.replace` command, so it is itself one undo step.
 */
export interface SavedVersion {
  id: string;
  name: string;
  /** ISO timestamp of when the snapshot was taken. */
  createdAt: string;
  document: DesignDocument;
}

const KEY_PREFIX = 'opencanvas:versions:';
export const MAX_SAVED_VERSIONS = 20;
export const MAX_VERSION_NAME_LENGTH = 60;

function storageKey(documentId: string): string {
  return `${KEY_PREFIX}${documentId}`;
}

function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function sanitizeVersion(candidate: unknown, documentId: string): SavedVersion | null {
  if (typeof candidate !== 'object' || candidate === null) return null;
  const record = candidate as {
    id?: unknown;
    name?: unknown;
    createdAt?: unknown;
    document?: unknown;
  };
  if (typeof record.id !== 'string' || record.id.length === 0) return null;
  if (typeof record.name !== 'string' || record.name.trim().length === 0) return null;
  if (typeof record.createdAt !== 'string' || Number.isNaN(Date.parse(record.createdAt))) {
    return null;
  }
  const parsed = validateDocument(record.document);
  if (!parsed.ok || parsed.value.id !== documentId) return null;
  return {
    id: record.id,
    name: record.name.trim().slice(0, MAX_VERSION_NAME_LENGTH),
    createdAt: record.createdAt,
    document: parsed.value,
  };
}

/** The saved versions for one design, newest first. Corrupt entries are dropped. */
export function listVersions(
  documentId: string,
  storage: Storage | null = defaultStorage(),
): SavedVersion[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey(documentId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => sanitizeVersion(entry, documentId))
      .filter((entry): entry is SavedVersion => entry !== null)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  } catch {
    return [];
  }
}

function persist(documentId: string, versions: SavedVersion[], storage: Storage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(storageKey(documentId), JSON.stringify(versions));
    return true;
  } catch {
    // Quota or private mode: the snapshot simply is not kept.
    return false;
  }
}

/**
 * Saves the current document as a named version. Returns the version, or `null` when the name
 * is empty, the cap is reached, or storage refuses the write.
 */
export function saveVersion(
  document: DesignDocument,
  name: string,
  storage: Storage | null = defaultStorage(),
): SavedVersion | null {
  const trimmed = name.trim().slice(0, MAX_VERSION_NAME_LENGTH);
  if (trimmed.length === 0) return null;
  const existing = listVersions(document.id, storage);
  if (existing.length >= MAX_SAVED_VERSIONS) return null;
  const version: SavedVersion = {
    id: generateId('version'),
    name: trimmed,
    createdAt: new Date().toISOString(),
    document,
  };
  if (!persist(document.id, [version, ...existing], storage)) return null;
  return version;
}

/** Removes one saved version. Returns true when something was removed. */
export function deleteVersion(
  documentId: string,
  versionId: string,
  storage: Storage | null = defaultStorage(),
): boolean {
  const existing = listVersions(documentId, storage);
  const remaining = existing.filter((version) => version.id !== versionId);
  if (remaining.length === existing.length) return false;
  return persist(documentId, remaining, storage);
}
