import { cloneDocumentAs, err, ok, type Result } from '@opencanvas/document';
import {
  packProject,
  PROJECT_FILE_EXTENSION,
  unpackProject,
  type AssetBlobStore,
  type ProjectStore,
} from '@opencanvas/storage';

import { downloadBlob } from '../download';
import { sanitizeFileName } from '../fileNames';

export interface ExportProjectFileOptions {
  /** Overridable in tests; the browser download is used by default. */
  download?: (blob: Blob, filename: string) => void;
  now?: Date;
}

/**
 * Writes a project to a `.opencanvas` file and downloads it. Returns the file name, or the reason
 * it could not be written (unknown project, image bytes gone, invalid document).
 */
export async function exportProjectFile(
  store: ProjectStore,
  projectId: string,
  options: ExportProjectFileOptions = {},
): Promise<Result<string, string>> {
  const loaded = await store.load(projectId);
  if (!loaded.ok) return err(loaded.error.message);
  const document = loaded.value;

  const blobs = store.assetBlobStore(projectId);
  const packed = await packProject({
    document,
    readAsset: (assetId) => blobs.get(assetId),
    ...(options.now ? { now: options.now } : {}),
  });
  if (!packed.ok) return err(packed.error.message);

  const filename = `${sanitizeFileName(document.name)}.${PROJECT_FILE_EXTENSION}`;
  (options.download ?? downloadBlob)(packed.value, filename);
  return ok(filename);
}

export interface ImportedProject {
  id: string;
  name: string;
  /** True when a project with the same id already existed, so a copy was imported instead. */
  copied: boolean;
}

/** Removes blobs written before a failure; leftovers are unreachable without a project record. */
async function discardWritten(blobs: AssetBlobStore, assetIds: readonly string[]): Promise<void> {
  for (const assetId of assetIds) {
    try {
      await blobs.delete(assetId);
    } catch {
      // Cleanup is best effort: the caller already gets the real failure.
    }
  }
}

/**
 * Imports a `.opencanvas` file: the container and document are validated (and migrated), asset
 * bytes are written to the project's blob store, and an id collision becomes a copy instead of
 * silently replacing the project already in this browser.
 */
export async function importProjectFile(
  store: ProjectStore,
  file: Blob,
): Promise<Result<ImportedProject, string>> {
  const unpacked = await unpackProject(file);
  if (!unpacked.ok) return err(unpacked.error.message);

  const collision = await store.load(unpacked.value.document.id);
  const document = collision.ok
    ? cloneDocumentAs(unpacked.value.document)
    : unpacked.value.document;

  // Asset bytes first: a saved project whose images are missing would open with broken images.
  const blobs = store.assetBlobStore(document.id);
  const written: string[] = [];
  try {
    for (const [assetId, blob] of unpacked.value.blobs) {
      await blobs.put(assetId, blob);
      written.push(assetId);
    }
  } catch (cause) {
    await discardWritten(blobs, written);
    return err(
      `The imported images could not be stored: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }

  const saved = await store.save(document);
  if (!saved.ok) {
    await discardWritten(blobs, written);
    return err(saved.error.message);
  }

  return ok({ id: document.id, name: document.name, copied: collision.ok });
}
