import { CANVAS_PRESETS, LIMITS } from '@opencanvas/document';
import type { ProjectStoreError, ProjectSummary } from '@opencanvas/storage';
import type { Result } from '@opencanvas/document';
import { Button, Input, Select } from '@opencanvas/ui';
import { Copy, Download, FileUp, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import type { TemplateDefinition } from '@opencanvas/templates';

import { navigate } from '../router';
import {
  createProject,
  createProjectFromTemplate,
  deleteProject,
  duplicateProject,
  renameProject,
} from './actions';
import { exportProjectFile, importProjectFile } from './projectFiles';
import { TemplateGallery } from './TemplateGallery';
import { describeProjectContents, formatCanvasSize, formatTimestamp } from './format';
import { useProjects } from './useProjects';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; projects: ProjectSummary[] }
  | { status: 'error'; message: string };

const DEFAULT_NAME = 'Untitled design';
const PROJECT_FILE_ACCEPT = '.opencanvas,application/zip,application/octet-stream';

function Logo() {
  return (
    <span
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"
    >
      <svg viewBox="0 0 32 32" className="size-4" fill="currentColor">
        <rect x="5" y="5" width="12" height="12" rx="2" />
        <circle cx="21" cy="21" r="7" opacity="0.7" />
      </svg>
    </span>
  );
}

/**
 * Local project browser: create, open, rename, duplicate and delete designs stored in this
 * browser. Every action reports its failure instead of degrading silently.
 */
export function Dashboard() {
  const { store, backend, download } = useProjects();
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [presetId, setPresetId] = useState(() => CANVAS_PRESETS[0]?.id ?? '');
  const [renaming, setRenaming] = useState<{ projectId: string; draft: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const applyListResult = useCallback((listed: Result<ProjectSummary[], ProjectStoreError>) => {
    if (listed.ok) setList({ status: 'ready', projects: listed.value });
    else setList({ status: 'error', message: listed.error.message });
  }, []);

  /** Re-reads the list after a mutation or an explicit retry. */
  const refresh = useCallback(async () => {
    applyListResult(await store.list());
  }, [applyListResult, store]);

  useEffect(() => {
    let cancelled = false;
    void store.list().then((listed) => {
      if (!cancelled) applyListResult(listed);
    });
    return () => {
      cancelled = true;
    };
  }, [store, applyListResult]);

  const onCreate = async () => {
    setBusy('create');
    setActionError(null);
    const preset = CANVAS_PRESETS.find((candidate) => candidate.id === presetId);
    const created = await createProject(store, {
      name: DEFAULT_NAME,
      ...(preset ? { width: preset.width, height: preset.height } : {}),
    });
    setBusy(null);
    if (!created.ok) {
      setActionError(created.error.message);
      return;
    }
    navigate({ name: 'editor', projectId: created.value.id });
  };

  const onRename = async (projectId: string, draft: string) => {
    setBusy(`rename:${projectId}`);
    setActionError(null);
    const renamed = await renameProject(store, projectId, draft.trim());
    setBusy(null);
    if (!renamed.ok) {
      setActionError(renamed.error.message);
      return;
    }
    setRenaming(null);
    await refresh();
  };

  const onDuplicate = async (projectId: string) => {
    setBusy(`duplicate:${projectId}`);
    setActionError(null);
    const duplicated = await duplicateProject(store, projectId);
    setBusy(null);
    if (!duplicated.ok) {
      setActionError(duplicated.error.message);
      return;
    }
    await refresh();
  };

  const onDelete = async (projectId: string) => {
    setBusy(`delete:${projectId}`);
    setActionError(null);
    const removed = await deleteProject(store, projectId);
    setBusy(null);
    if (!removed.ok) {
      setActionError(removed.error.message);
      return;
    }
    setConfirmingDelete(null);
    await refresh();
  };

  /** Writes the project to a `.opencanvas` file and hands it to the browser to download. */
  const onExportFile = async (projectId: string, name: string) => {
    setBusy(`export:${projectId}`);
    setActionError(null);
    setNotice(null);
    const exported = await exportProjectFile(store, projectId, { download });
    setBusy(null);
    if (!exported.ok) {
      setActionError(`"${name}" could not be exported: ${exported.error}`);
      return;
    }
    setNotice(`${exported.value} was downloaded.`);
  };

  /** Creates and opens a design that starts from one of the shipped templates. */
  const onUseTemplate = async (template: TemplateDefinition) => {
    setBusy(`template:${template.id}`);
    setActionError(null);
    setNotice(null);
    const created = await createProjectFromTemplate(store, template.id);
    setBusy(null);
    if (!created.ok) {
      setActionError(`The "${template.name}" template could not be used: ${created.error.message}`);
      return;
    }
    navigate({ name: 'editor', projectId: created.value.id });
  };

  /** Reads a `.opencanvas` file into the store; an existing id becomes a copy. */
  const onImportFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    event.currentTarget.value = '';
    if (!file) return;

    setBusy('import');
    setActionError(null);
    setNotice(null);
    const imported = await importProjectFile(store, file);
    setBusy(null);
    if (!imported.ok) {
      setActionError(`"${file.name}" could not be imported: ${imported.error}`);
      return;
    }
    setNotice(
      imported.value.copied
        ? `Imported as "${imported.value.name}" (a design with that id already exists).`
        : `Imported "${imported.value.name}".`,
    );
    await refresh();
  };

  const onRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const draft = event.currentTarget.value;
    const projectId = renaming?.projectId;
    if (event.key === 'Enter' && projectId) {
      event.preventDefault();
      event.currentTarget.blur();
      void onRename(projectId, draft);
    } else if (event.key === 'Escape') {
      setRenaming(null);
      setActionError(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border bg-panel px-6 py-3">
        <Logo />
        <div className="min-w-0">
          <p className="font-semibold tracking-tight">OpenCanvas</p>
          <p className="truncate text-xs text-muted-foreground">
            {backend === 'indexeddb'
              ? 'Designs are saved in this browser with IndexedDB.'
              : 'This browser has no IndexedDB: designs are kept in memory only and are lost on reload.'}
          </p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Your designs</h1>
            <p className="text-sm text-muted-foreground">
              Create a design, or open one you saved earlier.
            </p>
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreate();
            }}
          >
            <Select
              aria-label="Canvas size"
              value={presetId}
              onChange={(event) => setPresetId(event.target.value)}
              className="w-56"
            >
              {CANVAS_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label} · {preset.width}×{preset.height}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={busy !== null}>
              <Plus />
              New design
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp />
              Import design
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept={PROJECT_FILE_ACCEPT}
              className="sr-only"
              aria-label="OpenCanvas project file"
              tabIndex={-1}
              onChange={(event) => void onImportFile(event)}
            />
          </form>
        </div>

        {notice ? (
          <p
            role="status"
            className="rounded-md border border-border bg-panel px-3 py-2 text-sm text-muted-foreground"
          >
            {notice}
          </p>
        ) : null}

        {actionError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm"
          >
            {actionError}
          </p>
        ) : null}

        {list.status === 'loading' ? (
          <p className="text-sm text-muted-foreground">Loading designs…</p>
        ) : null}

        {list.status === 'error' ? (
          <div className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
            <p role="alert">{list.message}</p>
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              Try again
            </Button>
          </div>
        ) : null}

        {list.status === 'ready' && list.projects.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="font-medium">No designs yet</p>
            <p className="text-sm text-muted-foreground">
              Pick a canvas size above and create your first design.
            </p>
          </div>
        ) : null}

        {list.status === 'ready' && list.projects.length > 0 ? (
          <ul aria-label="Saved designs" className="grid gap-3 sm:grid-cols-2">
            {list.projects.map((project) => {
              const isRenaming = renaming?.projectId === project.id;
              const isBusy = busy !== null;
              return (
                <li key={project.id} className="rounded-lg border border-border bg-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      {isRenaming ? (
                        <Input
                          aria-label={`New name for ${project.name}`}
                          defaultValue={renaming?.draft ?? project.name}
                          maxLength={LIMITS.maxNameLength}
                          autoFocus
                          onChange={(event) =>
                            setRenaming({ projectId: project.id, draft: event.target.value })
                          }
                          onBlur={(event) => void onRename(project.id, event.currentTarget.value)}
                          onKeyDown={onRenameKeyDown}
                        />
                      ) : (
                        <h2 className="truncate font-medium">{project.name}</h2>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatCanvasSize(project)} · {describeProjectContents(project)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatTimestamp(project.updatedAt)}
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={`Open ${project.name}`}
                      disabled={isBusy}
                      onClick={() => navigate({ name: 'editor', projectId: project.id })}
                    >
                      Open
                    </Button>
                  </div>

                  <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Rename ${project.name}`}
                      disabled={isBusy || isRenaming}
                      onClick={() => {
                        setActionError(null);
                        setRenaming({ projectId: project.id, draft: project.name });
                      }}
                    >
                      <Pencil />
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Duplicate ${project.name}`}
                      disabled={isBusy}
                      onClick={() => void onDuplicate(project.id)}
                    >
                      <Copy />
                      Duplicate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Export ${project.name}`}
                      disabled={isBusy}
                      onClick={() => void onExportFile(project.id, project.name)}
                    >
                      <Download />
                      Export
                    </Button>
                    <div className="ml-auto flex items-center gap-1">
                      {confirmingDelete === project.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            aria-label={`Confirm delete ${project.name}`}
                            disabled={isBusy}
                            onClick={() => void onDelete(project.id)}
                          >
                            Delete design
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Keep ${project.name}`}
                            disabled={isBusy}
                            onClick={() => setConfirmingDelete(null)}
                          >
                            Keep
                          </Button>
                        </>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${project.name}`}
                          disabled={isBusy}
                          onClick={() => {
                            setActionError(null);
                            setConfirmingDelete(project.id);
                          }}
                        >
                          <Trash2 />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {list.status === 'ready' ? (
          <TemplateGallery
            busy={busy !== null}
            onUse={(template) => void onUseTemplate(template)}
          />
        ) : null}
      </main>
    </div>
  );
}
