import { LIMITS } from '@opencanvas/document';
import type { ProjectFolder, ProjectSummary } from '@opencanvas/storage';
import {
  Button,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from '@opencanvas/ui';
import { Copy, Download, FolderInput, MoreHorizontal, Pencil, Star, Trash2, X } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { ProjectThumbnail } from './ProjectThumbnail';
import { describeProjectContents, formatCanvasSize, formatTimestamp } from './format';

interface ProjectCardProps {
  project: ProjectSummary;
  starred: boolean;
  folderId: string | null;
  folders: readonly ProjectFolder[];
  busy: boolean;
  onOpen: (projectId: string) => void;
  onToggleStar: (projectId: string, starred: boolean) => void;
  onMove: (projectId: string, folderId: string | null) => void;
  onRename: (projectId: string, name: string) => Promise<boolean>;
  onDuplicate: (projectId: string) => void;
  onExport: (projectId: string, name: string) => void;
  onDelete: (projectId: string) => Promise<boolean>;
}

export function ProjectCard({
  project,
  starred,
  folderId,
  folders,
  busy,
  onOpen,
  onToggleStar,
  onMove,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: ProjectCardProps) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveName = async () => {
    if (savingName) return;
    setSavingName(true);
    const saved = await onRename(project.id, draft);
    setSavingName(false);
    if (saved) setRenaming(false);
  };

  const onNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void saveName();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDraft(project.name);
      setRenaming(false);
    }
  };

  const confirmRemoval = async () => {
    setDeleting(true);
    const removed = await onDelete(project.id);
    setDeleting(false);
    if (removed) setConfirmDelete(false);
  };

  return (
    <li className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md">
      <div className="relative p-2">
        <button
          type="button"
          aria-label={`Open ${project.name}`}
          disabled={busy}
          onClick={() => onOpen(project.id)}
          className="block w-full rounded-xl text-left transition-colors hover:bg-muted/30 disabled:opacity-50"
        >
          <ProjectThumbnail project={project} />
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={starred ? `Remove ${project.name} from starred` : `Star ${project.name}`}
          aria-pressed={starred}
          disabled={busy}
          onClick={() => onToggleStar(project.id, !starred)}
          className={`absolute right-4 top-4 size-9 rounded-full border border-white/60 shadow-sm backdrop-blur transition-colors ${
            starred
              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100'
              : 'bg-white/90 text-muted-foreground hover:text-amber-600'
          }`}
        >
          <Star className={`size-4 ${starred ? 'fill-current' : ''}`} />
        </Button>
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 pb-3 pt-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            {renaming ? (
              <Input
                aria-label={`New name for ${project.name}`}
                value={draft}
                maxLength={LIMITS.maxNameLength}
                autoFocus
                disabled={savingName}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onNameKeyDown}
                onBlur={() => void saveName()}
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
            {folderId ? (
              <p className="flex items-center gap-1 pt-0.5 text-[11px] text-muted-foreground">
                <FolderInput className="size-3" />
                {folders.find((folder) => folder.id === folderId)?.name ?? 'Folder'}
              </p>
            ) : null}
          </div>
          <Button
            size="sm"
            aria-label={`Open ${project.name}`}
            disabled={busy}
            onClick={() => onOpen(project.id)}
            className="shrink-0 rounded-full px-4"
          >
            Open
          </Button>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-1 border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Rename ${project.name}`}
            disabled={busy || renaming}
            onClick={() => {
              setDraft(project.name);
              setRenaming(true);
            }}
            className="h-7 rounded-full px-2.5 text-xs"
          >
            <Pencil className="size-3.5" /> Rename
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Duplicate ${project.name}`}
            disabled={busy}
            onClick={() => onDuplicate(project.id)}
            className="h-7 rounded-full px-2.5 text-xs"
          >
            <Copy className="size-3.5" /> Duplicate
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Export ${project.name}`}
            disabled={busy}
            onClick={() => onExport(project.id, project.name)}
            className="h-7 rounded-full px-2.5 text-xs"
          >
            <Download className="size-3.5" /> Export
          </Button>
          <div className="ml-auto flex items-center gap-1">
            {confirmDelete ? (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  aria-label={`Confirm delete ${project.name}`}
                  disabled={busy || deleting}
                  onClick={() => void confirmRemoval()}
                  className="h-7 rounded-full px-3 text-xs"
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Keep ${project.name}`}
                  disabled={busy || deleting}
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 rounded-full px-2.5 text-xs"
                >
                  <X className="size-3.5" /> Keep
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Delete ${project.name}`}
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                className="h-7 rounded-full px-2.5 text-xs text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            )}
            <Menu>
              <MenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Organize ${project.name}`}
                  disabled={busy}
                  className="size-7 rounded-full text-muted-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </MenuTrigger>
              <MenuContent align="end" aria-label={`Organize ${project.name}`}>
                <MenuLabel>Move to folder</MenuLabel>
                <MenuItem
                  icon={<FolderInput />}
                  onSelect={() => onMove(project.id, null)}
                  disabled={folderId === null}
                >
                  Projects (unfiled)
                </MenuItem>
                {folders.length > 0 ? <MenuSeparator /> : null}
                {folders.map((folder) => (
                  <MenuItem
                    key={folder.id}
                    icon={<FolderInput />}
                    onSelect={() => onMove(project.id, folder.id)}
                    disabled={folderId === folder.id}
                  >
                    {folder.name}
                  </MenuItem>
                ))}
                {folders.length === 0 ? (
                  <MenuItem disabled icon={<FolderInput />}>
                    Create a folder from the sidebar
                  </MenuItem>
                ) : null}
              </MenuContent>
            </Menu>
          </div>
        </div>
      </div>
    </li>
  );
}
