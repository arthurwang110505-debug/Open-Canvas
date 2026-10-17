import {
  err,
  LIMITS,
  ok,
  parseDocument,
  serializeDocument,
  validateDocument,
  type DesignDocument,
  type Result,
} from '@opencanvas/document';
import { strFromU8, strToU8, unzip, zip, type Unzipped } from 'fflate';

/**
 * The native OpenCanvas project file: a ZIP container holding a manifest, the canonical
 * document JSON and the bytes of every local image asset. It is the interchange format for
 * moving a design between browsers or machines, and for backups.
 *
 * ZIP keeps binary assets binary (no base64 inflation) and stays readable with standard tools.
 */
export const PROJECT_FILE_FORMAT = 'opencanvas-project';
export const PROJECT_FILE_FORMAT_VERSION = 1;
export const PROJECT_FILE_EXTENSION = 'opencanvas';
export const PROJECT_FILE_MEDIA_TYPE = 'application/octet-stream';

/** Compressed input we are willing to read. */
export const MAX_PROJECT_FILE_BYTES = 256 * 1024 * 1024;
/** Uncompressed total we are willing to hold in memory (zip-bomb guard). */
export const MAX_UNPACKED_BYTES = 512 * 1024 * 1024;

const MANIFEST_ENTRY = 'manifest.json';
const DOCUMENT_ENTRY = 'document.json';
const ASSET_PREFIX = 'assets/';
const EXTRA_ENTRIES_ALLOWED = 16;

export type ProjectFileErrorCode =
  | 'not-a-project-file'
  | 'unsupported-format'
  | 'missing-document'
  | 'invalid-document'
  | 'asset-missing'
  | 'too-large'
  | 'read-failed';

export interface ProjectFileError {
  code: ProjectFileErrorCode;
  message: string;
  cause?: unknown;
}

export interface ProjectFileManifest {
  format: typeof PROJECT_FILE_FORMAT;
  formatVersion: number;
  /** Document schema version at pack time; `document.json` stays authoritative. */
  schemaVersion: number;
  assetCount: number;
  createdAt: string;
}

export interface PackProjectOptions {
  document: DesignDocument;
  /** Supplies the bytes of a local asset; `undefined` means they are gone. */
  readAsset: (assetId: string) => Promise<Blob | undefined>;
  now?: Date;
}

export interface UnpackedProject {
  /** Validated and, if necessary, migrated document. */
  document: DesignDocument;
  /** Bytes for every local asset declared by the document, keyed by asset id. */
  blobs: Map<string, Blob>;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function assetEntryName(assetId: string, mimeType: string): string {
  return `${ASSET_PREFIX}${assetId}.${EXTENSION_BY_MIME[mimeType] ?? 'bin'}`;
}

function zipFiles(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}

function unzipBytes(data: Uint8Array): Promise<Unzipped> {
  return new Promise((resolve, reject) => {
    unzip(data, (error, files) => {
      if (error) reject(error);
      else resolve(files);
    });
  });
}

/**
 * fflate hands back views over an `ArrayBufferLike`; `Blob` wants an `ArrayBuffer`-backed view,
 * so the bytes are copied once (import/pack are rare, one-off operations).
 */
function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy], { type });
}

function failure(code: ProjectFileErrorCode, message: string, cause?: unknown): ProjectFileError {
  return cause === undefined ? { code, message } : { code, message, cause };
}

/**
 * Builds a `.opencanvas` file. Local assets whose bytes are gone are reported rather than
 * silently dropped, because the resulting file would open with broken images.
 */
export async function packProject(
  options: PackProjectOptions,
): Promise<Result<Blob, ProjectFileError>> {
  const { document, readAsset } = options;
  const validated = validateDocument(document);
  if (!validated.ok) {
    return err(
      failure(
        'invalid-document',
        `Refusing to pack an invalid document: ${validated.error.message}`,
      ),
    );
  }

  const files: Record<string, Uint8Array> = {};
  let assetCount = 0;
  for (const asset of Object.values(document.assets)) {
    if (asset.source.type === 'url') continue; // remote assets are referenced by URL
    const blob = await readAsset(asset.id);
    if (!blob) {
      return err(
        failure(
          'asset-missing',
          `The image data for "${asset.name ?? asset.id}" is no longer stored in this browser, so the file would open with a broken image.`,
        ),
      );
    }
    files[assetEntryName(asset.id, asset.mimeType)] = new Uint8Array(await blob.arrayBuffer());
    assetCount += 1;
  }

  const manifest: ProjectFileManifest = {
    format: PROJECT_FILE_FORMAT,
    formatVersion: PROJECT_FILE_FORMAT_VERSION,
    schemaVersion: document.schemaVersion,
    assetCount,
    createdAt: (options.now ?? new Date()).toISOString(),
  };
  files[MANIFEST_ENTRY] = strToU8(JSON.stringify(manifest, null, 2));
  files[DOCUMENT_ENTRY] = strToU8(serializeDocument(document));

  try {
    const zipped = await zipFiles(files);
    return ok(bytesToBlob(zipped, PROJECT_FILE_MEDIA_TYPE));
  } catch (cause) {
    return err(
      failure(
        'read-failed',
        `The project file could not be written: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
    );
  }
}

function readManifest(files: Unzipped): Result<ProjectFileManifest, ProjectFileError> {
  const raw = files[MANIFEST_ENTRY];
  if (!raw) {
    return err(
      failure(
        'not-a-project-file',
        'This file is not an OpenCanvas project (manifest.json is missing).',
      ),
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(strFromU8(raw));
  } catch (cause) {
    return err(
      failure(
        'not-a-project-file',
        `The project manifest is not readable JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
    );
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return err(failure('not-a-project-file', 'The project manifest is not an object.'));
  }
  const manifest = parsed as Partial<ProjectFileManifest>;
  if (manifest.format !== PROJECT_FILE_FORMAT) {
    return err(
      failure(
        'not-a-project-file',
        `Expected the manifest format "${PROJECT_FILE_FORMAT}", found "${String(manifest.format)}".`,
      ),
    );
  }
  const version = manifest.formatVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return err(failure('unsupported-format', 'The project manifest has no valid formatVersion.'));
  }
  if (version > PROJECT_FILE_FORMAT_VERSION) {
    return err(
      failure(
        'unsupported-format',
        `This project file uses format version ${String(version)}; this build understands up to ${String(
          PROJECT_FILE_FORMAT_VERSION,
        )}. Update OpenCanvas to open it.`,
      ),
    );
  }
  return ok({
    format: PROJECT_FILE_FORMAT,
    formatVersion: version,
    schemaVersion: typeof manifest.schemaVersion === 'number' ? manifest.schemaVersion : 0,
    assetCount: typeof manifest.assetCount === 'number' ? manifest.assetCount : 0,
    createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt : '',
  });
}

/**
 * Reads a `.opencanvas` file: validates the container, then parses, migrates and validates the
 * document, then checks that every local asset it references is present. Extra asset files (from
 * assets removed after packing) are ignored — the document is authoritative.
 */
export interface UnpackProjectOptions {
  /** Overrides for the container guards; the defaults apply in the app. */
  maxFileBytes?: number;
  maxUnpackedBytes?: number;
  maxEntries?: number;
}

export async function unpackProject(
  input: Blob | Uint8Array,
  options: UnpackProjectOptions = {},
): Promise<Result<UnpackedProject, ProjectFileError>> {
  const maxFileBytes = options.maxFileBytes ?? MAX_PROJECT_FILE_BYTES;
  const maxUnpackedBytes = options.maxUnpackedBytes ?? MAX_UNPACKED_BYTES;
  const maxEntries = options.maxEntries ?? LIMITS.maxAssetsPerDocument + EXTRA_ENTRIES_ALLOWED;
  let data: Uint8Array;
  try {
    data = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  } catch (cause) {
    return err(failure('read-failed', 'The file could not be read.', cause));
  }
  if (data.byteLength > maxFileBytes) {
    return err(
      failure(
        'too-large',
        `The file is ${(data.byteLength / 1024 / 1024).toFixed(1)} MB; the limit is ${String(
          maxFileBytes / 1024 / 1024,
        )} MB.`,
      ),
    );
  }

  let files: Unzipped;
  try {
    files = await unzipBytes(data);
  } catch (cause) {
    return err(
      failure(
        'not-a-project-file',
        `This file is not a readable ZIP archive: ${cause instanceof Error ? cause.message : String(cause)}`,
        cause,
      ),
    );
  }

  const entries = Object.keys(files);
  if (entries.length > maxEntries) {
    return err(
      failure(
        'too-large',
        `The archive holds ${String(entries.length)} entries; at most ${String(
          maxEntries,
        )} are accepted.`,
      ),
    );
  }
  const unpackedBytes = Object.values(files).reduce((total, entry) => total + entry.byteLength, 0);
  if (unpackedBytes > maxUnpackedBytes) {
    return err(
      failure(
        'too-large',
        `The archive unpacks to ${(unpackedBytes / 1024 / 1024).toFixed(1)} MB; the limit is ${String(
          maxUnpackedBytes / 1024 / 1024,
        )} MB.`,
      ),
    );
  }

  const manifest = readManifest(files);
  if (!manifest.ok) return manifest;

  const documentBytes = files[DOCUMENT_ENTRY];
  if (!documentBytes) {
    return err(failure('missing-document', 'The archive contains no document.json.'));
  }

  const parsed = parseDocument(strFromU8(documentBytes));
  if (!parsed.ok) {
    return err(
      failure('invalid-document', `The document could not be read: ${parsed.error.message}`),
    );
  }
  const document = parsed.value.document;

  const blobs = new Map<string, Blob>();
  for (const asset of Object.values(document.assets)) {
    if (asset.source.type === 'url') continue;
    const bytes = files[assetEntryName(asset.id, asset.mimeType)];
    if (!bytes) {
      return err(
        failure(
          'asset-missing',
          `The file does not contain the image data for "${asset.name ?? asset.id}".`,
        ),
      );
    }
    if (bytes.byteLength > LIMITS.maxAssetBytes) {
      return err(
        failure(
          'too-large',
          `The image "${asset.name ?? asset.id}" is larger than the ${String(
            LIMITS.maxAssetBytes / 1024 / 1024,
          )} MB limit.`,
        ),
      );
    }
    blobs.set(asset.id, bytesToBlob(bytes, asset.mimeType));
  }

  return ok({ document, blobs });
}
