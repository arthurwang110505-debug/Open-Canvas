import { createBlankDocument, err, type DesignDocument, type Result } from '@opencanvas/document';
import { applyCommand } from '@opencanvas/editor-core';
import type { ProjectStore, ProjectStoreError, ProjectSummary } from '@opencanvas/storage';
import { createDocumentFromTemplate } from '@opencanvas/templates';

/** A rename can also be rejected by the reducer (empty name), which is not a storage failure. */
export type ProjectActionError =
  ProjectStoreError | { code: 'command-rejected'; message: string; projectId: string };

export interface CreateProjectOptions {
  name?: string;
  width?: number;
  height?: number;
  now?: Date;
}

/** Creates a blank design and persists it so the editor always opens an existing project. */
export async function createProject(
  store: ProjectStore,
  options: CreateProjectOptions = {},
): Promise<Result<ProjectSummary, ProjectActionError>> {
  const document = createBlankDocument(options);
  return store.save(document);
}

export interface CreateProjectFromTemplateOptions {
  name?: string;
  now?: Date;
}

/**
 * Creates a design from one of the shipped templates and persists it. The document records
 * `source: 'template'` and the template id, so a design can say where it started.
 */
export async function createProjectFromTemplate(
  store: ProjectStore,
  templateId: string,
  options: CreateProjectFromTemplateOptions = {},
): Promise<Result<ProjectSummary, ProjectActionError>> {
  const created = createDocumentFromTemplate(templateId, options);
  if (!created.ok) {
    return err({ code: 'command-rejected', message: created.error.message, projectId: '' });
  }
  return store.save(created.value);
}

/**
 * Renames a saved design through the command layer, so validation and `metadata.updatedAt`
 * follow exactly the same rules as renaming inside the editor.
 */
export async function renameProject(
  store: ProjectStore,
  projectId: string,
  name: string,
  now?: Date,
): Promise<Result<ProjectSummary, ProjectActionError>> {
  const loaded: Result<DesignDocument, ProjectActionError> = await store.load(projectId);
  if (!loaded.ok) return loaded;
  const renamed = applyCommand(
    loaded.value,
    { type: 'document.rename', name },
    { now: () => now ?? new Date() },
  );
  if (!renamed.ok) {
    return err({ code: 'command-rejected', message: renamed.error.message, projectId });
  }
  return store.save(renamed.value);
}

export async function duplicateProject(
  store: ProjectStore,
  projectId: string,
): Promise<Result<ProjectSummary, ProjectActionError>> {
  return store.duplicate(projectId);
}

export async function deleteProject(
  store: ProjectStore,
  projectId: string,
): Promise<Result<void, ProjectActionError>> {
  return store.remove(projectId);
}
