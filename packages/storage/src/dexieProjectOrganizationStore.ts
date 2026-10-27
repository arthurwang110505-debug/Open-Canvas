import type { default as Dexie, Table } from 'dexie';
import { err, ok, type Result } from '@opencanvas/document';

import {
  MAX_PROJECT_FOLDER_NAME,
  projectOrganizationError,
  type ProjectFolder,
  type ProjectOrganization,
  type ProjectOrganizationError,
  type ProjectOrganizationSnapshot,
  type ProjectOrganizationStore,
  type ProjectOrganizationOptions,
} from './projectOrganization';

export type ProjectOrganizationTable = Table<ProjectOrganization, string>;
export type ProjectFolderTable = Table<ProjectFolder, string>;

export function projectOrganizationTable(db: Dexie): ProjectOrganizationTable {
  return db.table<ProjectOrganization, string>('projectOrganization');
}

export function projectFolderTable(db: Dexie): ProjectFolderTable {
  return db.table<ProjectFolder, string>('projectFolders');
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

function duplicateName(folders: readonly ProjectFolder[], name: string, exceptId?: string) {
  const normalized = name.trim().toLocaleLowerCase();
  return folders.some(
    (folder) => folder.id !== exceptId && folder.name.trim().toLocaleLowerCase() === normalized,
  );
}

function makeId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid
    ? `folder_${uuid}`
    : `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function failure(cause: unknown): ProjectOrganizationError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return projectOrganizationError(
    'storage-unavailable',
    `Local organization storage failed: ${detail}`,
    cause,
  );
}

/** IndexedDB implementation for local folders and favorite flags. */
export class DexieProjectOrganizationStore implements ProjectOrganizationStore {
  private readonly projects: ProjectOrganizationTable;
  private readonly folders: ProjectFolderTable;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly db: Dexie,
    options: ProjectOrganizationOptions = {},
  ) {
    this.projects = projectOrganizationTable(db);
    this.folders = projectFolderTable(db);
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? makeId;
  }

  async load(): Promise<Result<ProjectOrganizationSnapshot, ProjectOrganizationError>> {
    try {
      const [projects, folders] = await Promise.all([
        this.projects.toArray(),
        this.folders.toArray(),
      ]);
      return ok({
        projects,
        folders: folders.sort((a, b) => a.name.localeCompare(b.name)),
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async setStarred(
    projectId: string,
    starred: boolean,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>> {
    try {
      return await this.db.transaction('rw', this.projects, async () => {
        const existing = await this.projects.get(projectId);
        const record: ProjectOrganization = {
          projectId,
          starred,
          folderId: existing?.folderId ?? null,
          updatedAt: this.now().toISOString(),
        };
        await this.saveOrRemoveProject(record);
        return ok(record);
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async setFolder(
    projectId: string,
    folderId: string | null,
  ): Promise<Result<ProjectOrganization, ProjectOrganizationError>> {
    try {
      return await this.db.transaction('rw', this.projects, this.folders, async () => {
        if (folderId !== null && !(await this.folders.get(folderId))) {
          return err(projectOrganizationError('not-found', 'That folder no longer exists.'));
        }
        const existing = await this.projects.get(projectId);
        const record: ProjectOrganization = {
          projectId,
          starred: existing?.starred ?? false,
          folderId,
          updatedAt: this.now().toISOString(),
        };
        await this.saveOrRemoveProject(record);
        return ok(record);
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async createFolder(name: string): Promise<Result<ProjectFolder, ProjectOrganizationError>> {
    const normalized = normalizedFolderName(name);
    if (!normalized.ok) return normalized;
    try {
      return await this.db.transaction('rw', this.folders, async () => {
        const folders = await this.folders.toArray();
        if (duplicateName(folders, normalized.value)) {
          return err(
            projectOrganizationError('invalid-name', 'A folder with that name already exists.'),
          );
        }
        const now = this.now().toISOString();
        const folder: ProjectFolder = {
          id: this.createId(),
          name: normalized.value,
          createdAt: now,
          updatedAt: now,
        };
        await this.folders.add(folder);
        return ok(folder);
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async renameFolder(
    folderId: string,
    name: string,
  ): Promise<Result<ProjectFolder, ProjectOrganizationError>> {
    const normalized = normalizedFolderName(name);
    if (!normalized.ok) return normalized;
    try {
      return await this.db.transaction('rw', this.folders, async () => {
        const existing = await this.folders.get(folderId);
        if (!existing)
          return err(projectOrganizationError('not-found', 'That folder no longer exists.'));
        const folders = await this.folders.toArray();
        if (duplicateName(folders, normalized.value, folderId)) {
          return err(
            projectOrganizationError('invalid-name', 'A folder with that name already exists.'),
          );
        }
        const folder = { ...existing, name: normalized.value, updatedAt: this.now().toISOString() };
        await this.folders.put(folder);
        return ok(folder);
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async deleteFolder(folderId: string): Promise<Result<void, ProjectOrganizationError>> {
    try {
      return await this.db.transaction('rw', this.folders, this.projects, async () => {
        if (!(await this.folders.get(folderId))) {
          return err(projectOrganizationError('not-found', 'That folder no longer exists.'));
        }
        await this.folders.delete(folderId);
        const now = this.now().toISOString();
        const assignedProjects = await this.projects.where('folderId').equals(folderId).toArray();
        for (const project of assignedProjects) {
          if (!project.starred) await this.projects.delete(project.projectId);
          else await this.projects.put({ ...project, folderId: null, updatedAt: now });
        }
        return ok(undefined);
      });
    } catch (cause) {
      return err(failure(cause));
    }
  }

  async removeProject(projectId: string): Promise<Result<void, ProjectOrganizationError>> {
    try {
      await this.projects.delete(projectId);
      return ok(undefined);
    } catch (cause) {
      return err(failure(cause));
    }
  }

  private async saveOrRemoveProject(record: ProjectOrganization): Promise<void> {
    if (!record.starred && record.folderId === null) await this.projects.delete(record.projectId);
    else await this.projects.put(record);
  }
}

export function createDexieProjectOrganizationStore(
  db: Dexie,
  options: ProjectOrganizationOptions = {},
): DexieProjectOrganizationStore {
  return new DexieProjectOrganizationStore(db, options);
}
