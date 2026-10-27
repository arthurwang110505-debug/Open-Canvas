import { err, ok, type Result } from '@opencanvas/document';

export const MAX_PROJECT_FOLDER_NAME = 48;

export interface ProjectFolder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Browser-local organization metadata kept separate from a design's portable document. */
export interface ProjectOrganization {
  projectId: string;
  starred: boolean;
  folderId: string | null;
  updatedAt: string;
}

export interface ProjectOrganizationSnapshot {
  projects: ProjectOrganization[];
  folders: ProjectFolder[];
}

export type ProjectOrganizationErrorCode = 'invalid-name' | 'not-found' | 'storage-unavailable';

export interface ProjectOrganizationError {
  code: ProjectOrganizationErrorCode;
  message: string;
  cause?: unknown;
}

export interface ProjectOrganizationStore {
  /** Returns all local organization metadata; missing projects are treated as unstarred/unfiled. */
  load(): Promise<Result<ProjectOrganizationSnapshot, ProjectOrganizationError>>;
  setStarred(
    projectId: string,
    starred: boolean,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>>;
  setFolder(
    projectId: string,
    folderId: string | null,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>>;
  createFolder(name: string): Promise<Result<ProjectFolder, ProjectOrganizationError>>;
  renameFolder(
    folderId: string,
    name: string,
  ): Promise<Result<ProjectFolder, ProjectOrganizationError>>;
  /** Removes a folder and returns its designs to the unfiled Projects view. */
  deleteFolder(folderId: string): Promise<Result<void, ProjectOrganizationError>>;
  /** Removes local metadata after its project is deleted. */
  removeProject(projectId: string): Promise<Result<void, ProjectOrganizationError>>;
}

export interface ProjectOrganizationOptions {
  now?: () => Date;
  createId?: () => string;
}

export function projectOrganizationError(
  code: ProjectOrganizationErrorCode,
  message: string,
  cause?: unknown,
): ProjectOrganizationError {
  return { code, message, ...(cause !== undefined ? { cause } : {}) };
}

function makeId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `folder_${uuid}`
    : `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function normalizedFolderName(name: string): Result<string, ProjectOrganizationError> {
  const trimmed = name.trim();
  if (!trimmed)
    return err(projectOrganizationError('invalid-name', 'A folder name cannot be empty.'));
  if (trimmed.length > MAX_PROJECT_FOLDER_NAME) {
    return err(
      projectOrganizationError(
        'invalid-name',
        `Folder names must be ${MAX_PROJECT_FOLDER_NAME} characters or fewer.`,
      ),
    );
  }
  return ok(trimmed);
}

function defaultProjectRecord(projectId: string, now: Date): ProjectOrganization {
  return { projectId, starred: false, folderId: null, updatedAt: now.toISOString() };
}

function isDuplicateFolderName(folders: Iterable<ProjectFolder>, name: string, exceptId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  for (const folder of folders) {
    if (folder.id !== exceptId && folder.name.trim().toLocaleLowerCase() === normalized)
      return true;
  }
  return false;
}

/** Volatile organization backend used alongside the in-memory project fallback and in tests. */
export class MemoryProjectOrganizationStore implements ProjectOrganizationStore {
  private readonly projects = new Map<string, ProjectOrganization>();
  private readonly folders = new Map<string, ProjectFolder>();
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: ProjectOrganizationOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? makeId;
  }

  load(): Promise<Result<ProjectOrganizationSnapshot, ProjectOrganizationError>> {
    return Promise.resolve(
      ok({
        projects: [...this.projects.values()].map((project) => ({ ...project })),
        folders: [...this.folders.values()]
          .map((folder) => ({ ...folder }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      }),
    );
  }

  setStarred(
    projectId: string,
    starred: boolean,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>> {
    const existing = this.projects.get(projectId);
    const record = {
      ...(existing ?? defaultProjectRecord(projectId, this.now())),
      starred,
      updatedAt: this.now().toISOString(),
    };
    this.saveOrRemoveProject(record);
    return Promise.resolve(ok(record));
  }

  setFolder(
    projectId: string,
    folderId: string | null,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>> {
    if (folderId !== null && !this.folders.has(folderId)) {
      return Promise.resolve(
        err(projectOrganizationError('not-found', 'That folder no longer exists.')),
      );
    }
    const existing = this.projects.get(projectId);
    const record = {
      ...(existing ?? defaultProjectRecord(projectId, this.now())),
      folderId,
      updatedAt: this.now().toISOString(),
    };
    this.saveOrRemoveProject(record);
    return Promise.resolve(ok(record));
  }

  createFolder(name: string): Promise<Result<ProjectFolder, ProjectOrganizationError>> {
    const normalized = normalizedFolderName(name);
    if (!normalized.ok) return Promise.resolve(normalized);
    if (isDuplicateFolderName(this.folders.values(), normalized.value)) {
      return Promise.resolve(
        err(projectOrganizationError('invalid-name', 'A folder with that name already exists.')),
      );
    }
    const now = this.now().toISOString();
    const folder = { id: this.createId(), name: normalized.value, createdAt: now, updatedAt: now };
    this.folders.set(folder.id, folder);
    return Promise.resolve(ok({ ...folder }));
  }

  renameFolder(
    folderId: string,
    name: string,
  ): Promise<Result<ProjectFolder, ProjectOrganizationError>> {
    const existing = this.folders.get(folderId);
    if (!existing) {
      return Promise.resolve(
        err(projectOrganizationError('not-found', 'That folder no longer exists.')),
      );
    }
    const normalized = normalizedFolderName(name);
    if (!normalized.ok) return Promise.resolve(normalized);
    if (isDuplicateFolderName(this.folders.values(), normalized.value, folderId)) {
      return Promise.resolve(
        err(projectOrganizationError('invalid-name', 'A folder with that name already exists.')),
      );
    }
    const folder = { ...existing, name: normalized.value, updatedAt: this.now().toISOString() };
    this.folders.set(folderId, folder);
    return Promise.resolve(ok({ ...folder }));
  }

  deleteFolder(folderId: string): Promise<Result<void, ProjectOrganizationError>> {
    if (!this.folders.delete(folderId)) {
      return Promise.resolve(
        err(projectOrganizationError('not-found', 'That folder no longer exists.')),
      );
    }
    const now = this.now().toISOString();
    for (const project of this.projects.values()) {
      if (project.folderId === folderId) {
        this.saveOrRemoveProject({ ...project, folderId: null, updatedAt: now });
      }
    }
    return Promise.resolve(ok(undefined));
  }

  removeProject(projectId: string): Promise<Result<void, ProjectOrganizationError>> {
    this.projects.delete(projectId);
    return Promise.resolve(ok(undefined));
  }

  private saveOrRemoveProject(record: ProjectOrganization) {
    if (!record.starred && record.folderId === null) this.projects.delete(record.projectId);
    else this.projects.set(record.projectId, record);
  }
}

export function createMemoryProjectOrganizationStore(
  options: ProjectOrganizationOptions = {},
): MemoryProjectOrganizationStore {
  return new MemoryProjectOrganizationStore(options);
}
