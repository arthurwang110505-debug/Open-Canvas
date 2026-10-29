import { selectCanRedo, selectCanUndo } from '@opencanvas/editor-core';
import {
  Button,
  Input,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Separator,
  Tooltip,
} from '@opencanvas/ui';
import {
  FileText,
  History,
  Keyboard,
  Magnet,
  MonitorPlay,
  MoreHorizontal,
  Redo2,
  Ruler,
  Save,
  Share2,
  Undo2,
} from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { useEditorActions } from './actions';
import { ExportControls } from './ExportControls';
import { HistoryPanel } from './panels/HistoryPanel';
import { useCanvasController, useEditor, usePersistenceState, useSnappingEnabled } from './hooks';
import { ShareDialog } from '../share/ShareDialog';
import { PresentMode } from '../share/PresentMode';
import { navigate } from '../router';
import type { SidebarTab } from './Sidebar';

function DocumentTitle() {
  const name = useEditor((state) => state.document.name);
  const { renameDocument } = useEditorActions();
  const [draft, setDraft] = useState(name);
  const [editing, setEditing] = useState(false);
  const [lastName, setLastName] = useState(name);

  // Follow external changes (undo/redo) unless the user is typing. Adjusting state during
  // render is React's recommended pattern for "state derived from a changed prop".
  if (name !== lastName) {
    setLastName(name);
    if (!editing) setDraft(name);
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim().length === 0) {
      setDraft(name);
      return;
    }
    renameDocument(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      setDraft(name);
      setEditing(false);
      event.currentTarget.blur();
    }
  };

  return (
    <Input
      aria-label="Design name"
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      maxLength={200}
      className="h-8 w-20 min-w-0 border-transparent bg-transparent px-2 text-xs font-medium hover:border-input focus-visible:bg-background sm:w-32 sm:text-sm md:w-44 lg:w-56"
    />
  );
}

function SnapToggle() {
  const snapping = useSnappingEnabled();
  const canvas = useCanvasController();
  return (
    <Tooltip
      content={snapping ? 'Snapping on: objects align to each other and the page' : 'Snapping off'}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Snap to objects"
        pressed={snapping}
        onClick={() => canvas.setSnapping(!snapping)}
        className="hidden xl:inline-flex"
      >
        <Magnet />
      </Button>
    </Tooltip>
  );
}

function RulerToggle() {
  const visible = useEditor((state) => state.rulersVisible);
  const { toggleRulers } = useEditorActions();
  return (
    <Tooltip
      content={visible ? 'Hide rulers and guides (Shift R)' : 'Show rulers and guides (Shift R)'}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Toggle rulers and guides"
        pressed={visible}
        onClick={toggleRulers}
        className="hidden xl:inline-flex"
      >
        <Ruler />
      </Button>
    </Tooltip>
  );
}

function SaveStatus() {
  const dirty = useEditor((state) => state.dirty);
  const status = usePersistenceState((state) => state.status);
  const lastSavedAt = usePersistenceState((state) => state.lastSavedAt);
  const errorMessage = usePersistenceState((state) => state.errorMessage);
  const saveNow = usePersistenceState((state) => state.saveNow);

  let label: string;
  let title: string;
  if (status === 'saving') {
    label = 'Saving…';
    title = 'Writing this design to local storage.';
  } else if (status === 'error') {
    label = 'Save failed';
    title = errorMessage ?? 'The write to local storage failed.';
  } else if (dirty) {
    label = 'Unsaved changes';
    title =
      status === 'disabled'
        ? 'This editor runs without local persistence; changes live in memory only.'
        : 'Changes are written to local storage a moment after you stop editing (Ctrl S saves now).';
  } else if (lastSavedAt) {
    label = 'All changes saved';
    title = `Saved at ${new Date(lastSavedAt).toLocaleTimeString()}`;
  } else {
    label = 'No unsaved changes';
    title = 'Nothing to save yet.';
  }

  return (
    <div className="hidden items-center gap-2 xl:flex">
      <span
        role="status"
        aria-live="polite"
        className="text-xs text-muted-foreground"
        title={title}
      >
        {label}
      </span>
      {status === 'error' ? (
        <Button variant="outline" size="sm" onClick={() => void saveNow()}>
          Save now
        </Button>
      ) : null}
    </div>
  );
}

interface TopBarProps {
  onOpenPanel: (panel: SidebarTab) => void;
  onOpenShortcuts: () => void;
}

export function TopBar({ onOpenPanel, onOpenShortcuts }: TopBarProps) {
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const { undo, redo, toggleRulers } = useEditorActions();
  const document = useEditor((s) => s.document);
  const dirty = useEditor((s) => s.dirty);
  const rulersVisible = useEditor((s) => s.rulersVisible);
  const snapping = useSnappingEnabled();
  const canvas = useCanvasController();
  const saveNow = usePersistenceState((state) => state.saveNow);
  const saveStatus = usePersistenceState((state) => state.status);
  const [showShare, setShowShare] = useState(false);
  const [showPresent, setShowPresent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <header className="flex h-[52px] items-center gap-1 border-b border-border bg-panel px-2 sm:gap-2 sm:px-3">
        <a
          href="#/"
          aria-label="OpenCanvas: back to your designs"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground"
          >
            <svg viewBox="0 0 32 32" className="size-4" fill="currentColor">
              <rect x="5" y="5" width="12" height="12" rx="2" />
              <circle cx="21" cy="21" r="7" opacity="0.7" />
            </svg>
          </span>
          <span className="hidden sm:inline">OpenCanvas</span>
        </a>
        <Separator orientation="vertical" className="hidden h-6 md:block" />
        <Menu>
          <MenuTrigger asChild>
            <Button variant="ghost" size="sm" className="rounded-lg px-2.5">
              File
            </Button>
          </MenuTrigger>
          <MenuContent aria-label="File menu">
            <MenuLabel>Design</MenuLabel>
            <MenuItem icon={<FileText />} onSelect={() => navigate({ name: 'dashboard' })}>
              Back to your designs
            </MenuItem>
            <MenuItem icon={<Save />} hint="Ctrl S" onSelect={() => void saveNow()}>
              Save now
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Ruler />} onSelect={() => onOpenPanel('page')}>
              Page size & settings
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<Ruler />} hint="Shift R" onSelect={toggleRulers}>
              Rulers and guides
            </MenuItem>
            <MenuItem icon={<Keyboard />} hint="?" onSelect={onOpenShortcuts}>
              Keyboard shortcuts
            </MenuItem>
          </MenuContent>
        </Menu>
        <DocumentTitle />
        <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="History">
          <div className="hidden items-center gap-0.5 min-[480px]:flex">
            <Tooltip content="Undo (Ctrl Z)">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={undo}
              >
                <Undo2 />
              </Button>
            </Tooltip>
            <Tooltip content="Redo (Ctrl Shift Z)">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={redo}
              >
                <Redo2 />
              </Button>
            </Tooltip>
          </div>
          <Tooltip content="Browse document history">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open history"
              onClick={() => setShowHistory(true)}
              className="hidden xl:inline-flex"
            >
              <History />
            </Button>
          </Tooltip>
        </div>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 sm:gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="hidden rounded-lg xl:inline-flex"
            onClick={() => onOpenPanel('page')}
          >
            <Ruler className="size-4" /> Resize
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="hidden rounded-full xl:inline-flex"
            onClick={() => setShowPresent(true)}
          >
            <MonitorPlay className="size-4" /> Present
          </Button>
          <Button
            size="sm"
            aria-label="Share"
            className="rounded-full px-2.5 shadow-sm sm:px-3"
            onClick={() => setShowShare(true)}
          >
            <Share2 className="size-4" /> <span className="hidden sm:inline">Share</span>
          </Button>
          <ExportControls />
          <SaveStatus />
          <Separator orientation="vertical" className="hidden h-6 xl:block" />
          <RulerToggle />
          <SnapToggle />
          <Menu className="xl:hidden">
            <MenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="More editor actions"
                className="rounded-lg"
              >
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent
              align="end"
              aria-label="Editor actions"
              className="w-64 max-w-[calc(100vw-1rem)]"
            >
              <MenuLabel>Editor actions</MenuLabel>
              <MenuItem icon={<Undo2 />} hint="Ctrl Z" disabled={!canUndo} onSelect={undo}>
                Undo
              </MenuItem>
              <MenuItem icon={<Redo2 />} hint="Ctrl Shift Z" disabled={!canRedo} onSelect={redo}>
                Redo
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<MonitorPlay />} onSelect={() => setShowPresent(true)}>
                Present
              </MenuItem>
              <MenuItem icon={<History />} onSelect={() => setShowHistory(true)}>
                Open history
              </MenuItem>
              <MenuItem icon={<Ruler />} onSelect={() => onOpenPanel('page')}>
                Page size & settings
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Ruler />}
                hint={rulersVisible ? 'On' : 'Off'}
                onSelect={toggleRulers}
              >
                Rulers and guides
              </MenuItem>
              <MenuItem
                icon={<Magnet />}
                hint={snapping ? 'On' : 'Off'}
                onSelect={() => canvas.setSnapping(!snapping)}
              >
                Snap to objects
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon={<Save />}
                hint={saveStatus === 'saving' ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}
                disabled={saveStatus === 'saving'}
                onSelect={() => void saveNow()}
              >
                Save now
              </MenuItem>
            </MenuContent>
          </Menu>
        </div>
      </header>
      {showHistory ? <HistoryPanel onClose={() => setShowHistory(false)} /> : null}
      {showShare ? (
        <ShareDialog
          document={document}
          onClose={() => setShowShare(false)}
          onPresent={() => {
            setShowShare(false);
            setShowPresent(true);
          }}
        />
      ) : null}
      {showPresent ? (
        <PresentMode document={document} onClose={() => setShowPresent(false)} />
      ) : null}
    </>
  );
}
