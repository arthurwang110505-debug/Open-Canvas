import type { ProjectFolder } from '@opencanvas/storage';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger } from '@opencanvas/ui';
import {
  BriefcaseBusiness,
  Folder,
  FolderPlus,
  Home,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
} from 'lucide-react';

export type DashboardView =
  'home' | 'projects' | 'templates' | 'starred' | 'brand' | `folder:${string}`;

interface HomeSidebarProps {
  activeView: DashboardView;
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
  { view: 'brand', label: 'Brand', icon: BriefcaseBusiness },
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
      aria-label={label}
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
        selected
          ? 'bg-primary/10 text-primary'
          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
      }`}
    >
      <Icon className="size-[18px] shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
      ) : null}
    </button>
  );
}

export function HomeSidebar({
  activeView,
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
  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-border bg-white lg:h-full lg:w-[248px] lg:border-r lg:border-b-0">
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
      </div>

      <div className="px-3 pb-3">
        <Button
          onClick={onCreateDesign}
          className="h-10 w-full justify-start rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 text-white shadow-sm hover:from-violet-700 hover:to-indigo-700"
        >
          <Plus className="size-4" />
          Create a design
        </Button>
      </div>

      <nav
        aria-label="Home navigation"
        className="grid grid-cols-2 gap-1 px-3 pb-2 lg:flex lg:flex-col"
      >
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
                    aria-label={folder.name}
                    aria-current={selected ? 'page' : undefined}
                    onClick={() => onChangeView(`folder:${folder.id}`)}
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors ${
                      selected
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-foreground/75 hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    <Folder className="size-[17px] shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
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
  );
}
