import type { ProjectFolder } from '@opencanvas/storage';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@opencanvas/ui';
import {
  Folder,
  FolderPlus,
  Home,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  X,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

import { useMediaQuery } from '../useMediaQuery';

export type DashboardView = 'home' | 'projects' | 'templates' | 'starred' | `folder:${string}`;

interface HomeSidebarProps {
  activeView: DashboardView;
  mobileOpen: boolean;
  onClose: () => void;
  folders: readonly ProjectFolder[];
  projectCount: number;
  starredCount: number;
  folderCounts: ReadonlyMap<string, number>;
  onChangeView: (view: DashboardView) => void;
  onCreateDesign: () => void;
  onCreateFolder: () => void;
  onRenameFolder: (folder: ProjectFolder) => void;
  onDeleteFolder: (folder: ProjectFolder) => void;
}

const MAIN_NAV: {
  view: Exclude<DashboardView, `folder:${string}`>;
  label: string;
  icon: typeof Home;
}[] = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'projects', label: 'Projects', icon: Folder },
  { view: 'templates', label: 'Templates', icon: LayoutTemplate },
  { view: 'starred', label: 'Starred', icon: Star },
];

function NavButton({
  label,
  icon: Icon,
  count,
  selected,
  onClick,
}: {
  label: string;
  icon: typeof Home;
  count?: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
        selected
          ? 'bg-primary/10 text-primary'
          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">
        {label}
        {count !== undefined ? <span className="sr-only">{` ${count} designs`}</span> : null}
      </span>{' '}
      {count !== undefined ? (
        <span aria-hidden="true" className="text-[11px] tabular-nums text-muted-foreground">
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function HomeSidebar({
  activeView,
  mobileOpen,
  onClose,
  folders,
  projectCount,
  starredCount,
  folderCounts,
  onChangeView,
  onCreateDesign,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: HomeSidebarProps) {
  const isMobile = useMediaQuery('(max-width: 1023px)');
  const sidebarRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    previousFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = sidebarRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus.current?.focus();
    };
  }, [isMobile, mobileOpen]);

  return (
    <>
      {isMobile && mobileOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={sidebarRef}
        id="home-sidebar"
        role={isMobile ? 'dialog' : undefined}
        aria-modal={isMobile && mobileOpen ? true : undefined}
        aria-label="Dashboard navigation"
        hidden={isMobile && !mobileOpen}
        className={`fixed inset-y-0 left-0 z-50 h-dvh w-[min(86vw,320px)] max-w-full shrink-0 flex-col overflow-y-auto border-r border-border bg-white shadow-[0_16px_48px_rgba(15,23,42,0.2)] lg:static lg:z-auto lg:h-full lg:w-[248px] lg:shadow-none ${mobileOpen ? 'flex' : 'hidden lg:flex'}`}
      >
        <div className="flex items-center gap-3 px-4 py-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm"
          >
            <svg viewBox="0 0 32 32" className="size-5" fill="currentColor">
              <rect x="5" y="5" width="12" height="12" rx="3" />
              <circle cx="21" cy="21" r="7" opacity="0.85" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold tracking-tight">OpenCanvas</span>
            <span className="block text-[11px] text-muted-foreground">Your creative space</span>
          </span>
          {isMobile ? (
            <Button
              ref={closeButtonRef}
              variant="ghost"
              size="icon-sm"
              aria-label="Close navigation"
              onClick={onClose}
              className="ml-auto size-10 rounded-full text-muted-foreground"
            >
              <X />
            </Button>
          ) : null}
        </div>

        <div className="px-3 pb-3">
          <Button
            onClick={onCreateDesign}
            className="h-11 w-full justify-start rounded-lg px-3.5 shadow-sm"
          >
            <Plus className="size-4" />
            Create a design
          </Button>
        </div>

        <nav aria-label="Home navigation" className="flex flex-col gap-1 px-3 pb-2">
          {MAIN_NAV.map((item) => (
            <NavButton
              key={item.view}
              label={item.label}
              icon={item.icon}
              selected={activeView === item.view}
              count={
                item.view === 'projects'
                  ? projectCount
                  : item.view === 'starred'
                    ? starredCount
                    : undefined
              }
              onClick={() => onChangeView(item.view)}
            />
          ))}
        </nav>

        <div className="flex min-h-0 flex-col border-t border-border px-3 py-3 lg:flex-1 lg:py-4">
          <div className="mb-2 flex items-center justify-between px-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Folders
            </h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Create folder"
              title="Create folder"
              onClick={onCreateFolder}
              className="size-7 rounded-lg text-muted-foreground"
            >
              <FolderPlus className="size-4" />
            </Button>
          </div>
          {folders.length === 0 ? (
            <p className="px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Keep projects organized with folders.
            </p>
          ) : (
            <div className="min-h-0 max-h-28 flex-1 space-y-0.5 overflow-y-auto lg:max-h-none">
              {folders.map((folder) => {
                const selected = activeView === `folder:${folder.id}`;
                return (
                  <div key={folder.id} className="group flex items-center gap-1">
                    <button
                      type="button"
                      aria-current={selected ? 'page' : undefined}
                      onClick={() => onChangeView(`folder:${folder.id}`)}
                      className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                        selected
                          ? 'bg-primary/10 font-medium text-primary'
                          : 'text-foreground/75 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Folder className="size-[17px] shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {folder.name}
                        <span className="sr-only">{` ${folderCounts.get(folder.id) ?? 0} designs`}</span>
                      </span>{' '}
                      <span
                        aria-hidden="true"
                        className="text-[11px] tabular-nums text-muted-foreground"
                      >
                        {folderCounts.get(folder.id) ?? 0}
                      </span>
                    </button>
                    <Menu>
                      <MenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Folder actions for ${folder.name}`}
                          className="size-7 shrink-0 rounded-lg text-muted-foreground opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent align="end" aria-label={`${folder.name} folder actions`}>
                        <MenuItem icon={<Pencil />} onSelect={() => onRenameFolder(folder)}>
                          Rename folder
                        </MenuItem>
                        <MenuItem
                          icon={<FolderPlus />}
                          onSelect={() => onDeleteFolder(folder)}
                          className="text-destructive"
                        >
                          Delete folder
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-auto rounded-xl bg-[#f8f7ff] p-3 text-[11px] leading-relaxed text-muted-foreground">
            Projects stay private in this browser. Export a design to back it up or move it.
          </div>
        </div>
      </aside>
    </>
  );
}
