import {
  cloneDocumentAs,
  err,
  ok,
  parseDocument,
  serializeDocument,
  validateDocument,
  type DesignDocument,
  type Result,
} from '@opencanvas/document';

import type { AssetBlobStore } from './assetBlobStore';

/** Everything a project list needs without parsing the stored document. */
export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  size: { width: number; height: number };
  pageCount: number;
  elementCount: number;
}

export type ProjectStoreErrorCode =
  'not-found' | 'invalid-project' | 'quota-exceeded' | 'storage-unavailable';

export interface ProjectStoreError {
  code: ProjectStoreErrorCode;
  message: string;
  projectId?: string;
  cause?: unknown;
}

export function projectStoreError(
  code: ProjectStoreErrorCode,
  message: string,
  extra: { projectId?: string; cause?: unknown } = {},
): ProjectStoreError {
  return { code, message, ...extra };
}

/**
 * Local persistence for designs. A project is one document plus the asset blobs that belong
 * to it; the editor only ever sees `DesignDocument` and `AssetBlobStore`, never the backend.
 *
 * Every failure is returned as a `Result` so callers must surface them (quota, corrupted
 * data, private-mode IndexedDB) instead of losing work silently.
 */
export interface ProjectStore {
  /** All projects, most recently updated first. */
  list(): Promise<Result<ProjectSummary[], ProjectStoreError>>;
  /** Reads and validates a stored document (older schema versions are migrated). */
  load(projectId: string): Promise<Result<DesignDocument, ProjectStoreError>>;
  /** Creates or replaces a project. Rejects documents that fail schema validation. */
  save(document: DesignDocument): Promise<Result<ProjectSummary, ProjectStoreError>>;
  /** Copies a project (document and asset blobs) under a new id and name. */
  duplicate(projectId: string): Promise<Result<ProjectSummary, ProjectStoreError>>;
  /** Deletes a project and its asset blobs. */
  remove(projectId: string): Promise<Result<void, ProjectStoreError>>;
  /** Blob storage scoped to one project; safe to call before the project exists. */
  assetBlobStore(projectId: string): AssetBlobStore;
}

/** Summaries are derived from the document so both stay in sync without extra bookkeeping. */
export function summarizeDocument(document: DesignDocument): ProjectSummary {
  return {
    id: document.id,
    name: document.name,
    createdAt: document.metadata.createdAt,
    updatedAt: document.metadata.updatedAt,
    size: { width: document.size.width, height: document.size.height },
    pageCount: document.pages.length,
    elementCount: document.pages.reduce((total, page) => total + page.elements.length, 0),
  };
}

export interface StoredProject {
  summary: ProjectSummary;
  /** Canonical JSON of the document as written by `serializeDocument`. */
  document: string;
}

export function toStoredProject(document: DesignDocument): StoredProject {
  return { summary: summarizeDocument(document), document: serializeDocument(document) };
}

/** Validates a stored document the same way an import does: parse, migrate, validate. */
export function readStoredProject(
  projectId: string,
  record: StoredProject,
): Result<DesignDocument, ProjectStoreError> {
  const parsed = parseDocument(record.document);
  if (!parsed.ok) {
    return err(
      projectStoreError(
        'invalid-project',
        `The saved design could not be read: ${parsed.error.message}`,
        { projectId },
      ),
    );
  }
  if (parsed.value.document.id !== projectId) {
    return err(
      projectStoreError(
        'invalid-project',
        `The saved design "${projectId}" contains a different document id.`,
        { projectId },
      ),
    );
  }
  return ok(parsed.value.document);
}

/**
 * Shared implementation of the read/write rules (validation on save, validation and migration
 * on load, summary derivation, duplicate naming, newest-first ordering). Backends only supply
 * raw record access, so the memory and IndexedDB stores cannot drift apart.
 */
export abstract class SharedProjectStore implements ProjectStore {
  /** Raw records are the only thing a backend implements; expected failures are returned. */
  protected abstract readRecord(projectId: string): Promise<StoredProject | undefined>;
  protected abstract readAllRecords(): Promise<StoredProject[]>;
  protected abstract writeRecord(record: StoredProject): Promise<void>;
  protected abstract removeRecord(projectId: string): Promise<void>;
  protected abstract copyBlobs(fromProjectId: string, toProjectId: string): Promise<void>;
  protected abstract removeBlobs(projectId: string): Promise<void>;
  abstract assetBlobStore(projectId: string): AssetBlobStore;

  async list(): Promise<Result<ProjectSummary[], ProjectStoreError>> {
    try {
      const records = await this.readAllRecords();
      const summaries = records
        .map((record) => record.summary)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
      return ok(summaries);
    } catch (cause) {
      return err(this.failure(cause));
    }
  }

  async load(projectId: string): Promise<Result<DesignDocument, ProjectStoreError>> {
    let record: StoredProject | undefined;
    try {
      record = await this.readRecord(projectId);
    } catch (cause) {
      return err(this.failure(cause, projectId));
    }
    if (!record) {
      return err(
        projectStoreError('not-found', `No saved design with id "${projectId}".`, { projectId }),
      );
    }
    return readStoredProject(projectId, record);
  }

  async save(document: DesignDocument): Promise<Result<ProjectSummary, ProjectStoreError>> {
    const validated = validateDocument(document);
    if (!validated.ok) {
      return err(
        projectStoreError(
          'invalid-project',
          `Refusing to save an invalid document: ${validated.error.message}`,
          { projectId: document.id },
        ),
      );
    }
    const record = toStoredProject(validated.value);
    try {
      await this.writeRecord(record);
    } catch (cause) {
      return err(this.failure(cause, record.summary.id));
    }
    return ok(record.summary);
  }

  async duplicate(projectId: string): Promise<Result<ProjectSummary, ProjectStoreError>> {
    const loaded = await this.load(projectId);
    if (!loaded.ok) return loaded;
    const copy = cloneDocumentAs(loaded.value);
    try {
      await this.copyBlobs(projectId, copy.id);
    } catch (cause) {
      return err(this.failure(cause, projectId));
    }
    return this.save(copy);
  }

  async remove(projectId: string): Promise<Result<void, ProjectStoreError>> {
    try {
      const record = await this.readRecord(projectId);
      if (!record) {
        return err(
          projectStoreError('not-found', `No saved design with id "${projectId}".`, { projectId }),
        );
      }
      await this.removeRecord(projectId);
      await this.removeBlobs(projectId);
      return ok(undefined);
    } catch (cause) {
      return err(this.failure(cause, projectId));
    }
  }

  /** Backends override this to recognize quota errors and private-mode failures. */
  protected failure(cause: unknown, projectId?: string): ProjectStoreError {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return projectStoreError('storage-unavailable', `Local storage failed: ${detail}`, {
      ...(projectId ? { projectId } : {}),
      cause,
    });
  }
}
