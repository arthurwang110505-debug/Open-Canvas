import { CANVAS_PRESETS } from '@opencanvas/document';
import type {
  ProjectFolder,
  ProjectOrganizationSnapshot,
  ProjectStoreError,
  ProjectSummary,
} from '@opencanvas/storage';
import { Button, EmptyState, SearchField, Select } from '@opencanvas/ui';
import {
  Clock,
  FileUp,
  Folder,
  LayoutTemplate,
  Menu as MenuIcon,
  Search,
  Sparkles,
  Star,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import { navigate } from '../router';
import { getTemplate } from '../templates/catalog';
import { TemplateGallery } from '../templates/TemplateGallery';
import { TemplatePreviewModal } from '../templates/TemplatePreviewModal';
import {
  createProject,
  createProjectFromTemplate,
  deleteProject,
  duplicateProject,
  renameProject,
} from './actions';
import { CreateDesignDialog } from './CreateDesignDialog';
import { FolderDialog } from './FolderDialog';
import { HomeHero } from './HomeHero';
import { HomeSidebar, type DashboardView } from './HomeSidebar';
import { ProjectCard } from './ProjectCard';
import { ProjectThumbnail } from './ProjectThumbnail';
import { exportProjectFile, importProjectFile } from './projectFiles';
import { formatCanvasSize, formatTimestamp } from './format';
import { useProjects } from './useProjects';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; projects: ProjectSummary[] }
  | { status: 'error'; message: string };

const DEFAULT_NAME = 'Untitled design';
const PROJECT_FILE_ACCEPT = '.opencanvas,application/zip,application/octet-stream';
const EMPTY_ORGANIZATION: ProjectOrganizationSnapshot = { projects: [], folders: [] };

function projectErrorMessage(error: ProjectStoreError): string {
  return error.message;
}

function viewFolderId(view: DashboardView): string | null {
  return view.startsWith('folder:') ? view.slice('folder:'.length) : null;
}

function viewHeading(
  view: DashboardView,
  folders: readonly ProjectFolder[],
): { title: string; subtitle: string } {
  if (view === 'starred')
    return { title: 'Starred designs', subtitle: 'Your favorite work, all in one place.' };
  const folderId = viewFolderId(view);
  if (folderId) {
    const folder = folders.find((candidate) => candidate.id === folderId);
    return {
      title: folder?.name ?? 'Folder not found',
      subtitle: 'Designs saved in this folder.',
    };
  }
  return { title: 'Projects', subtitle: 'All your designs, saved locally in this browser.' };
}

/**
 * Home, project organization, and template discovery for local designs. Documents stay portable;
 * favorites and folders are stored separately in the browser's organization store.
 */
export function Dashboard() {
  const { store, organization, backend, download } = useProjects();
  const [activeView, setActiveView] = useState<DashboardView>('home');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [list, setList] = useState<ListState>({ status: 'loading' });
  const [organizationSnapshot, setOrganizationSnapshot] = useState(EMPTY_ORGANIZATION);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name'>('recent');
  const [showCreateDesign, setShowCreateDesign] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ id?: string; name?: string } | null>(null);
  const [previewTemplateId, setPreviewTemplateId] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const applyListResult = useCallback(
    (result: Awaited<ReturnType<typeof store.list>>) => {
      if (result.ok) setList({ status: 'ready', projects: result.value });
      else setList({ status: 'error', message: projectErrorMessage(result.error) });
    },
    [store],
  );

  const refreshProjects = useCallback(async () => {
    applyListResult(await store.list());
  }, [applyListResult, store]);

  const refreshOrganization = useCallback(async () => {
    const result = await organization.load();
    if (result.ok) {
      setOrganizationSnapshot(result.value);
      return true;
    }
    setActionError(result.error.message);
    return false;
  }, [organization]);

  const refresh = useCallback(async () => {
    await Promise.all([refreshProjects(), refreshOrganization()]);
  }, [refreshOrganization, refreshProjects]);

  useEffect(() => {
    let cancelled = false;
    void store.list().then((result) => {
      if (!cancelled) applyListResult(result);
    });
    void organization.load().then((result) => {
      if (cancelled) return;
      if (result.ok) setOrganizationSnapshot(result.value);
      else setActionError(result.error.message);
    });
    return () => {
      cancelled = true;
    };
  }, [applyListResult, organization, store]);

  const closeCreateDesign = useCallback(() => {
    setShowCreateDesign(false);
    setActionError(null);
  }, []);
  const closeFolderDialog = useCallback(() => {
    setFolderDialog(null);
    setActionError(null);
  }, []);
  const closeTemplatePreview = useCallback(() => setPreviewTemplateId(null), []);
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), []);
  const changeView = useCallback((view: DashboardView) => {
    setActiveView(view);
    setMobileNavOpen(false);
  }, []);
  const openCreateDesign = useCallback(() => {
    setActionError(null);
    setShowCreateDesign(true);
    setMobileNavOpen(false);
  }, []);

  const onCreate = async (name: string, width: number, height: number): Promise<boolean> => {
    setBusy('create');
    setActionError(null);
    const created = await createProject(store, { name, width, height });
    setBusy(null);
    if (!created.ok) {
      setActionError(created.error.message);
      return false;
    }
    navigate({ name: 'editor', projectId: created.value.id });
    return true;
  };

  const onCreatePreset = async (presetId: string) => {
    const preset = CANVAS_PRESETS.find((candidate) => candidate.id === presetId);
    if (!preset) return;
    setBusy('create');
    setActionError(null);
    const created = await createProject(store, {
      name: DEFAULT_NAME,
      width: preset.width,
      height: preset.height,
    });
    setBusy(null);
    if (!created.ok) {
      setActionError(created.error.message);
      return;
    }
    navigate({ name: 'editor', projectId: created.value.id });
  };

  const onUseTemplate = async (templateId: string) => {
    setBusy('create');
    setActionError(null);
    const template = getTemplate(templateId);
    if (!template) {
      setBusy(null);
      setActionError(`Unknown template ${templateId}`);
      return;
    }
    const created = await createProjectFromTemplate(store, template.build());
    setBusy(null);
    if (!created.ok) {
      setActionError(created.error.message);
      return;
    }
    setPreviewTemplateId(null);
    navigate({ name: 'editor', projectId: created.value.id });
  };

  const onRename = async (projectId: string, draft: string): Promise<boolean> => {
    setBusy(`rename:${projectId}`);
    setActionError(null);
    const renamed = await renameProject(store, projectId, draft.trim());
    setBusy(null);
    if (!renamed.ok) {
      setActionError(renamed.error.message);
      return false;
    }
    await refreshProjects();
    setNotice(`Renamed to “${renamed.value.name}”.`);
    return true;
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
    await refreshProjects();
    setNotice(`Created “${duplicated.value.name}”.`);
  };

  const onDelete = async (projectId: string): Promise<boolean> => {
    setBusy(`delete:${projectId}`);
    setActionError(null);
    const removed = await deleteProject(store, projectId);
    if (!removed.ok) {
      setBusy(null);
      setActionError(removed.error.message);
      return false;
    }
    const metadataRemoved = await organization.removeProject(projectId);
    setBusy(null);
    if (!metadataRemoved.ok) setActionError(metadataRemoved.error.message);
    await refresh();
    setNotice('Design deleted.');
    return true;
  };

  const onToggleStar = async (projectId: string, starred: boolean) => {
    setBusy(`organize:${projectId}`);
    setActionError(null);
    const result = await organization.setStarred(projectId, starred);
    setBusy(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    await refreshOrganization();
  };

  const onMove = async (projectId: string, folderId: string | null) => {
    setBusy(`organize:${projectId}`);
    setActionError(null);
    const result = await organization.setFolder(projectId, folderId);
    setBusy(null);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    const folderName = folderId
      ? organizationSnapshot.folders.find((folder) => folder.id === folderId)?.name
      : undefined;
    setNotice(folderName ? `Moved to “${folderName}”.` : 'Moved to Projects.');
    await refreshOrganization();
  };

  const onSaveFolder = async (name: string): Promise<boolean> => {
    setActionError(null);
    const result = folderDialog?.id
      ? await organization.renameFolder(folderDialog.id, name)
      : await organization.createFolder(name);
    if (!result.ok) {
      setActionError(result.error.message);
      return false;
    }
    await refreshOrganization();
    if (!folderDialog?.id) setActiveView(`folder:${result.value.id}`);
    setNotice(
      folderDialog?.id
        ? `Folder renamed to “${result.value.name}”.`
        : `Folder “${result.value.name}” created.`,
    );
    return true;
  };

  const onDeleteFolder = async (folder: ProjectFolder) => {
    setActionError(null);
    const result = await organization.deleteFolder(folder.id);
    if (!result.ok) {
      setActionError(result.error.message);
      return;
    }
    if (activeView === `folder:${folder.id}`) setActiveView('projects');
    await refreshOrganization();
    setNotice(`“${folder.name}” was deleted. Its designs are now in Projects.`);
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
    await refreshProjects();
    setActiveView('projects');
  };

  const metadataByProject = useMemo(
    () => new Map(organizationSnapshot.projects.map((metadata) => [metadata.projectId, metadata])),
    [organizationSnapshot.projects],
  );
  const folderCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const metadata of organizationSnapshot.projects) {
      if (metadata.folderId)
        counts.set(metadata.folderId, (counts.get(metadata.folderId) ?? 0) + 1);
    }
    return counts;
  }, [organizationSnapshot.projects]);
  const starredCount = useMemo(
    () => organizationSnapshot.projects.filter((metadata) => metadata.starred).length,
    [organizationSnapshot.projects],
  );

  const filteredProjects = useMemo(() => {
    if (list.status !== 'ready') return [];
    const folderId = viewFolderId(activeView);
    const query = searchQuery.trim().toLocaleLowerCase();
    const matches = list.projects.filter((project) => {
      const metadata = metadataByProject.get(project.id);
      if (activeView === 'starred' && !metadata?.starred) return false;
      if (folderId && metadata?.folderId !== folderId) return false;
      if (
        query &&
        !project.name.toLocaleLowerCase().includes(query) &&
        !project.id.toLocaleLowerCase().includes(query)
      ) {
        return false;
      }
      return true;
    });
    return sortBy === 'name'
      ? matches.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      : matches.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }, [activeView, list, metadataByProject, searchQuery, sortBy]);

  const folderId = viewFolderId(activeView);
  const currentFolder = folderId
    ? organizationSnapshot.folders.find((folder) => folder.id === folderId)
    : undefined;
  const folderDialogInitialName = folderDialog?.name;
  const folderDialogId = folderDialog?.id;

  const openCreateFolder = useCallback(() => {
    setActionError(null);
    setFolderDialog({});
    setMobileNavOpen(false);
  }, []);

  const renderProjectGrid = (projects: readonly ProjectSummary[]) => (
    <ul aria-label="Designs" className="grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => {
        const metadata = metadataByProject.get(project.id);
        return (
          <ProjectCard
            key={project.id}
            project={project}
            starred={metadata?.starred ?? false}
            folderId={metadata?.folderId ?? null}
            folders={organizationSnapshot.folders}
            busy={busy !== null}
            onOpen={(projectId) => navigate({ name: 'editor', projectId })}
            onToggleStar={(projectId, starred) => void onToggleStar(projectId, starred)}
            onMove={(projectId, targetFolderId) => void onMove(projectId, targetFolderId)}
            onRename={onRename}
            onDuplicate={(projectId) => void onDuplicate(projectId)}
            onExport={(projectId, name) => void onExportFile(projectId, name)}
            onDelete={onDelete}
          />
        );
      })}
    </ul>
  );

  const isProjectView = activeView === 'projects' || activeView === 'starred' || folderId !== null;
  const pageHeading =
    activeView === 'starred'
      ? viewHeading(activeView, organizationSnapshot.folders)
      : currentFolder
        ? viewHeading(activeView, organizationSnapshot.folders)
        : viewHeading('projects', organizationSnapshot.folders);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#f7f8fc] text-foreground lg:flex-row">
      <HomeSidebar
        activeView={activeView}
        mobileOpen={mobileNavOpen}
        onClose={closeMobileNav}
        folders={organizationSnapshot.folders}
        projectCount={list.status === 'ready' ? list.projects.length : 0}
        starredCount={starredCount}
        folderCounts={folderCounts}
        onChangeView={changeView}
        onCreateDesign={openCreateDesign}
        onCreateFolder={openCreateFolder}
        onRenameFolder={(folder) => {
          setActionError(null);
          setFolderDialog({ id: folder.id, name: folder.name });
          setMobileNavOpen(false);
        }}
        onDeleteFolder={(folder) => {
          setMobileNavOpen(false);
          void onDeleteFolder(folder);
        }}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open navigation"
              aria-controls="home-sidebar"
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
              className="-ml-2 size-10 rounded-full"
            >
              <MenuIcon className="size-5" />
            </Button>
            <span className="text-sm font-bold tracking-tight">OpenCanvas</span>
          </div>
          <p className="hidden text-xs text-muted-foreground sm:block">
            {backend === 'indexeddb'
              ? 'Your designs are saved on this device.'
              : 'This browser has no IndexedDB: designs are kept in memory only and are lost on reload.'}
          </p>
          <div className="flex items-center gap-2 sm:ml-auto">
            <Button
              variant="outline"
              size="sm"
              aria-label="Import design"
              className="rounded-full px-2.5 min-[480px]:px-3"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
            >
              <FileUp className="size-4" />
              <span className="hidden min-[480px]:inline">Import design</span>
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-9">
            {notice ? (
              <p
                role="status"
                className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                {notice}
              </p>
            ) : null}
            {actionError ? (
              <div className="mb-4 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
                <p role="alert">{actionError}</p>
                <button
                  type="button"
                  aria-label="Dismiss message"
                  onClick={() => setActionError(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ) : null}

            {activeView === 'home' ? (
              <div className="space-y-9">
                <HomeHero
                  onCreateDesign={() => setShowCreateDesign(true)}
                  onCreatePreset={(preset) => void onCreatePreset(preset.id)}
                  onBrowseTemplates={() => setActiveView('templates')}
                  onSearch={(query) => {
                    setSearchQuery(query);
                    changeView('projects');
                  }}
                />
                {list.status === 'ready' && list.projects.length > 0 ? (
                  <section aria-label="Continue editing">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h2 className="flex items-center gap-2 text-base font-semibold">
                          <Clock className="size-4 text-primary" /> Continue editing
                        </h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Pick up where you left off.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveView('projects')}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        See all projects
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {list.projects.slice(0, 3).map((project) => (
                        <button
                          key={project.id}
                          type="button"
                          disabled={busy !== null}
                          onClick={() => navigate({ name: 'editor', projectId: project.id })}
                          className="flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white p-2.5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md disabled:opacity-50"
                        >
                          <span className="w-24 shrink-0">
                            <ProjectThumbnail project={project} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">
                              {project.name}
                            </span>
                            <span className="mt-1 block text-xs text-muted-foreground">
                              {formatCanvasSize(project)}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              Updated {formatTimestamp(project.updatedAt)}
                            </span>
                          </span>
                          {metadataByProject.get(project.id)?.starred ? (
                            <Star
                              aria-label="Starred"
                              className="size-4 shrink-0 fill-amber-400 text-amber-400"
                            />
                          ) : null}
                        </button>
                      ))}
                    </div>
                  </section>
                ) : null}
                {list.status === 'ready' && list.projects.length === 0 ? (
                  <EmptyState
                    icon={<Sparkles />}
                    title="No designs yet"
                    description="Create a first canvas or explore a template. Your work stays on this device."
                    layout="split"
                    action={
                      <Button onClick={() => setShowCreateDesign(true)} className="rounded-full">
                        Create your first design
                      </Button>
                    }
                  />
                ) : null}
                {list.status === 'loading' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-24 animate-pulse rounded-2xl bg-white ring-1 ring-border"
                      />
                    ))}
                  </div>
                ) : null}
                <section aria-labelledby="home-template-heading">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <h2
                        id="home-template-heading"
                        className="flex items-center gap-2 text-base font-semibold"
                      >
                        <LayoutTemplate className="size-4 text-primary" /> Templates for every idea
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        A few starting points from the template collection.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveView('templates')}
                      className="shrink-0 text-xs font-semibold text-primary hover:underline"
                    >
                      Explore all templates
                    </button>
                  </div>
                  <TemplateGallery
                    variant="home"
                    maxItems={6}
                    onUse={(id) => void onUseTemplate(id)}
                    onPreview={setPreviewTemplateId}
                  />
                </section>
              </div>
            ) : null}

            {activeView === 'templates' ? (
              <div>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      Template library
                    </p>
                    <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                      Find your next favorite
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Search, filter, preview, and make any layout your own.
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    60+ editable starting points
                  </span>
                </div>
                <TemplateGallery
                  onUse={(id) => void onUseTemplate(id)}
                  onPreview={setPreviewTemplateId}
                />
              </div>
            ) : null}

            {isProjectView ? (
              <section aria-labelledby="projects-heading">
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      {activeView === 'starred'
                        ? 'Favorites'
                        : currentFolder
                          ? 'Folder'
                          : 'Workspace'}
                    </p>
                    <h1
                      id="projects-heading"
                      className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl"
                    >
                      {pageHeading.title}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">{pageHeading.subtitle}</p>
                  </div>
                  <Button
                    onClick={() => setShowCreateDesign(true)}
                    className="self-start rounded-full sm:self-auto"
                  >
                    <Sparkles className="size-4" /> Create a design
                  </Button>
                </div>

                {list.status === 'ready' && list.projects.length > 0 ? (
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchField
                      aria-label="Search your designs"
                      placeholder="Search your designs"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onClear={() => setSearchQuery('')}
                      clearLabel="Clear design search"
                      wrapperClassName="max-w-sm flex-1"
                      className="h-10 rounded-full bg-white shadow-sm"
                    />
                    <div className="flex items-center gap-3">
                      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                        {searchQuery.trim()
                          ? `${filteredProjects.length} result${filteredProjects.length === 1 ? '' : 's'} for “${searchQuery.trim()}”`
                          : `${filteredProjects.length} design${filteredProjects.length === 1 ? '' : 's'}`}
                      </p>
                      <Select
                        aria-label="Sort designs"
                        value={sortBy}
                        onChange={(event) => setSortBy(event.target.value as 'recent' | 'name')}
                        className="h-9 w-36 rounded-full bg-white text-[13px]"
                      >
                        <option value="recent">Last edited</option>
                        <option value="name">Name</option>
                      </Select>
                    </div>
                  </div>
                ) : null}

                {list.status === 'loading' ? (
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {[1, 2, 3].map((index) => (
                      <div
                        key={index}
                        className="h-72 animate-pulse rounded-2xl bg-white ring-1 ring-border"
                      />
                    ))}
                  </div>
                ) : null}
                {list.status === 'error' ? (
                  <div className="space-y-3 rounded-2xl border border-destructive/30 bg-white p-6">
                    <p role="alert" className="text-sm">
                      {list.message}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void refreshProjects()}
                      className="rounded-full"
                    >
                      Try again
                    </Button>
                  </div>
                ) : null}
                {list.status === 'ready' && list.projects.length === 0 ? (
                  <EmptyState
                    icon={<Folder />}
                    title="No designs yet"
                    description="Start with a custom canvas or explore an editable template."
                    className="px-6 py-12"
                    action={
                      <Button
                        onClick={() => setShowCreateDesign(true)}
                        className="rounded-full px-5"
                      >
                        Create a design
                      </Button>
                    }
                  />
                ) : null}
                {list.status === 'ready' && list.projects.length > 0 && filteredProjects.length > 0
                  ? renderProjectGrid(filteredProjects)
                  : null}
                {list.status === 'ready' &&
                list.projects.length > 0 &&
                filteredProjects.length === 0 ? (
                  <EmptyState
                    icon={activeView === 'starred' ? <Star /> : folderId ? <Folder /> : <Search />}
                    title={
                      activeView === 'starred'
                        ? 'No starred designs yet'
                        : folderId
                          ? 'This folder is empty'
                          : 'No matches'
                    }
                    description={
                      activeView === 'starred'
                        ? 'Use the star on a design card to save it here.'
                        : folderId
                          ? 'Move a design here from its card menu.'
                          : `No designs match “${searchQuery}”. Try a different name or clear the search.`
                    }
                    className="px-6 py-12"
                    action={
                      searchQuery ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSearchQuery('')}
                          className="rounded-full"
                        >
                          Clear search
                        </Button>
                      ) : undefined
                    }
                  />
                ) : null}
              </section>
            ) : null}
          </div>
        </div>
      </main>

      {showCreateDesign ? (
        <CreateDesignDialog
          error={actionError}
          onClose={closeCreateDesign}
          onCreate={({ name, width, height }) => onCreate(name, width, height)}
        />
      ) : null}
      {folderDialog ? (
        <FolderDialog
          key={folderDialogId ?? 'new-folder'}
          initialName={folderDialogInitialName}
          error={actionError}
          onClose={closeFolderDialog}
          onSave={onSaveFolder}
        />
      ) : null}
      {previewTemplateId ? (
        <TemplatePreviewModal
          templateId={previewTemplateId}
          busy={busy === 'create'}
          onClose={closeTemplatePreview}
          onUse={(templateId) => void onUseTemplate(templateId)}
        />
      ) : null}
    </div>
  );
}
