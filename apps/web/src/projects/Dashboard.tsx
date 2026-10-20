import { CANVAS_PRESETS, LIMITS } from '@opencanvas/document';
import type { ProjectStoreError, ProjectSummary } from '@opencanvas/storage';
import type { Result } from '@opencanvas/document';
import { Button, Input, Select } from '@opencanvas/ui';
import {
  Copy,
  Download,
  FileUp,
  LayoutTemplate,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';

import { navigate } from '../router';
import { createProject, deleteProject, duplicateProject, renameProject } from './actions';
import { exportProjectFile, importProjectFile } from './projectFiles';
import { describeProjectContents, formatCanvasSize, formatTimestamp } from './format';
import { useProjects } from './useProjects';
import { ProjectThumbnail } from './ProjectThumbnail';

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
      className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
    >
      <svg viewBox="0 0 32 32" className="size-5" fill="currentColor">
        <rect x="5" y="5" width="12" height="12" rx="3" />
        <circle cx="21" cy="21" r="7" opacity="0.85" />
      </svg>
    </span>
  );
}

function EmptyStateIllustration() {
  return (
    <div className="relative mx-auto flex w-full max-w-md items-end justify-center gap-3 py-4">
      {/* three floating cards like Canva */}
      <div className="w-24 rounded-xl bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-border -rotate-6">
        <div className="aspect-[3/4] rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 p-2">
          <div className="h-2 w-8 rounded bg-white/90" />
          <div className="mt-2 h-1 w-12 rounded bg-white/60" />
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-muted" />
      </div>
      <div className="w-28 rounded-xl bg-white p-2.5 shadow-[0_12px_32px_rgba(0,0,0,0.10)] ring-1 ring-border z-10 -translate-y-2">
        <div className="aspect-square rounded-lg bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400 p-3 flex flex-col justify-end">
          <div className="h-3 w-3/4 rounded bg-white" />
          <div className="mt-1.5 h-1.5 w-1/2 rounded bg-white/70" />
        </div>
        <div className="mt-2 flex gap-1">
          <div className="h-6 flex-1 rounded-full bg-primary" />
          <div className="h-6 flex-1 rounded-full bg-muted" />
        </div>
      </div>
      <div className="w-24 rounded-xl bg-white p-2 shadow-[0_8px_24px_rgba(0,0,0,0.08)] ring-1 ring-border rotate-6">
        <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-cyan-400 to-sky-600 p-2 flex items-center justify-center">
          <LayoutTemplate className="size-8 text-white/90" />
        </div>
        <div className="mt-2 h-1.5 w-full rounded bg-muted" />
      </div>
    </div>
  );
}

const STARTER_TEMPLATES: { label: string; presetId: string; gradient: string }[] = [
  { label: 'Instagram post', presetId: 'instagram-post', gradient: 'from-violet-500 to-indigo-600' },
  { label: 'Instagram story', presetId: 'instagram-story', gradient: 'from-fuchsia-500 to-pink-500' },
  { label: 'Presentation', presetId: 'presentation-16-9', gradient: 'from-sky-500 to-blue-600' },
  { label: 'Poster A4', presetId: 'poster-a4', gradient: 'from-emerald-500 to-teal-600' },
  { label: 'YouTube cover', presetId: 'youtube-thumbnail', gradient: 'from-orange-500 to-red-500' },
  { label: 'Business card', presetId: 'business-card', gradient: 'from-zinc-700 to-zinc-900' },
];

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
  const [searchQuery, setSearchQuery] = useState('');
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

  const onCreate = async (overridePresetId?: string) => {
    setBusy('create');
    setActionError(null);
    const targetId = overridePresetId ?? presetId;
    const preset = CANVAS_PRESETS.find((candidate) => candidate.id === targetId);
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

  const filteredProjects = useMemo(() => {
    if (list.status !== 'ready') return [];
    if (!searchQuery.trim()) return list.projects;
    const q = searchQuery.toLowerCase();
    return list.projects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q),
    );
  }, [list, searchQuery]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8f9fb] text-foreground">
      <header className="flex shrink-0 items-center gap-4 border-b border-border bg-white px-6 py-3 shadow-sm">
        <Logo />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            OpenCanvas <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold tracking-widest text-primary">BETA</span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {backend === 'indexeddb'
              ? 'Designs are saved in this browser with IndexedDB.'
              : 'This browser has no IndexedDB: designs are kept in memory only and are lost on reload.'}
          </p>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
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
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          {/* Hero / create bar — Canva-style */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-border">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-1">
                <h1 className="flex items-center gap-2 text-[22px] font-bold tracking-tight">
                  <Sparkles className="size-5 text-primary" />
                  Your designs
                </h1>
                <p className="text-sm text-muted-foreground">
                  Start from a template or create a blank canvas — just like Canva.
                </p>
              </div>
              <form
                className="flex flex-wrap items-center gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onCreate();
                }}
              >
                <Select
                  aria-label="Canvas size"
                  value={presetId}
                  onChange={(event) => setPresetId(event.target.value)}
                  className="h-9 w-56 rounded-full bg-muted/50"
                >
                  {CANVAS_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label} · {preset.width}×{preset.height}
                    </option>
                  ))}
                </Select>
                <Button type="submit" disabled={busy !== null} className="rounded-full px-5 shadow-sm">
                  <Plus />
                  New design
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== null}
                  onClick={() => fileInput.current?.click()}
                  className="rounded-full md:hidden"
                >
                  <FileUp />
                  Import
                </Button>
              </form>
            </div>

            {/* Template quick-start strip */}
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {STARTER_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.presetId}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void onCreate(tpl.presetId)}
                  className="group flex shrink-0 items-center gap-2.5 rounded-full border border-border bg-background px-3 py-2 pr-4 text-sm font-medium shadow-sm transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/[0.04] disabled:opacity-50"
                >
                  <span className={`grid size-7 place-items-center rounded-full bg-gradient-to-br ${tpl.gradient} text-white shadow-sm`}>
                    <Plus className="size-3.5" />
                  </span>
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search + filter bar */}
          {list.status === 'ready' && list.projects.length > 0 ? (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search your designs"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-full rounded-full border border-input bg-white py-2 pl-9 pr-4 text-sm shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {filteredProjects.length === list.projects.length
                  ? `${list.projects.length} design${list.projects.length === 1 ? '' : 's'}`
                  : `${filteredProjects.length} of ${list.projects.length}`}
              </p>
            </div>
          ) : null}

          {notice ? (
            <p
              role="status"
              className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
            >
              {notice}
            </p>
          ) : null}

          {actionError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm"
            >
              {actionError}
            </p>
          ) : null}

          {list.status === 'loading' ? (
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-border bg-white p-3">
                  <div className="aspect-[4/3] rounded-xl bg-muted" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : null}

          {list.status === 'error' ? (
            <div className="mt-6 space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-4 text-sm">
              <p role="alert">{list.message}</p>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => void refresh()}>
                Try again
              </Button>
            </div>
          ) : null}

          {list.status === 'ready' && list.projects.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-white px-6 py-10 text-center shadow-sm">
              <EmptyStateIllustration />
              <h2 className="mt-6 text-lg font-semibold">No designs yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                Pick a size above or jump in with a template. Your designs are saved automatically in this browser.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button onClick={() => void onCreate()} className="rounded-full px-6">
                  <Plus /> Create blank design
                </Button>
                <Button variant="outline" className="rounded-full" onClick={() => fileInput.current?.click()}>
                  <FileUp /> Import .opencanvas
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Tip: Try “Instagram post” or “Poster A4” from the strip above.</p>
            </div>
          ) : null}

          {list.status === 'ready' && filteredProjects.length === 0 && list.projects.length > 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-border bg-white px-6 py-12 text-center">
              <p className="font-medium">No matches for “{searchQuery}”</p>
              <p className="text-sm text-muted-foreground">Try a different search term.</p>
              <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </div>
          ) : null}

          {list.status === 'ready' && filteredProjects.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                const isRenaming = renaming?.projectId === project.id;
                const isBusy = busy !== null;
                return (
                  <li
                    key={project.id}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md hover:border-primary/20"
                  >
                    {/* Thumbnail area — clickable to open */}
                    <button
                      type="button"
                      aria-label={`Open ${project.name}`}
                      disabled={isBusy}
                      onClick={() => navigate({ name: 'editor', projectId: project.id })}
                      className="relative block w-full p-2 text-left transition-colors hover:bg-muted/30 disabled:opacity-50"
                    >
                      <ProjectThumbnail project={project} />
                    </button>

                    <div className="flex flex-1 flex-col gap-2 px-4 pb-3 pt-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-0.5">
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
                              className="h-8 rounded-full"
                            />
                          ) : (
                            <h2 className="truncate text-sm font-semibold leading-tight">{project.name}</h2>
                          )}
                          <p className="text-xs text-muted-foreground">
                            {formatCanvasSize(project)} · {describeProjectContents(project)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Updated {formatTimestamp(project.updatedAt)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          aria-label={`Open ${project.name}`}
                          disabled={isBusy}
                          onClick={() => navigate({ name: 'editor', projectId: project.id })}
                          className="shrink-0 rounded-full px-4"
                        >
                          Open
                        </Button>
                      </div>

                      <div className="mt-1 flex items-center gap-1 border-t border-border pt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Rename ${project.name}`}
                          disabled={isBusy || isRenaming}
                          onClick={() => {
                            setActionError(null);
                            setRenaming({ projectId: project.id, draft: project.name });
                          }}
                          className="h-7 rounded-full px-2.5 text-xs"
                        >
                          <Pencil className="size-3.5" />
                          Rename
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Duplicate ${project.name}`}
                          disabled={isBusy}
                          onClick={() => void onDuplicate(project.id)}
                          className="h-7 rounded-full px-2.5 text-xs"
                        >
                          <Copy className="size-3.5" />
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Export ${project.name}`}
                          disabled={isBusy}
                          onClick={() => void onExportFile(project.id, project.name)}
                          className="h-7 rounded-full px-2.5 text-xs"
                        >
                          <Download className="size-3.5" />
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
                                className="h-7 rounded-full px-3 text-xs"
                              >
                                Delete
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label={`Keep ${project.name}`}
                                disabled={isBusy}
                                onClick={() => setConfirmingDelete(null)}
                                className="h-7 rounded-full px-3 text-xs"
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
                              className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="size-3.5" />
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </main>
    </div>
  );
}
