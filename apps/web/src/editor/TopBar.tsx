import { formatZoom, selectCanRedo, selectCanUndo } from '@opencanvas/editor-core';
import { Button, Input, Separator, Tooltip } from '@opencanvas/ui';
import { Magnet, Maximize, Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';

import { useEditorActions } from './actions';
import { useCanvasController, useCanvasReady, useEditor, useSnappingEnabled } from './hooks';

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
      className="h-8 w-56 border-transparent bg-transparent font-medium hover:border-input focus-visible:bg-background"
    />
  );
}

function ZoomControls() {
  const zoom = useEditor((state) => state.zoom);
  const ready = useCanvasReady();
  const canvas = useCanvasController();
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Zoom">
      <Tooltip content="Zoom out (Ctrl −)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          disabled={!ready}
          onClick={() => canvas.zoomOut()}
        >
          <Minus />
        </Button>
      </Tooltip>
      <Tooltip content="Reset to 100% (Ctrl 1)">
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Zoom level ${formatZoom(zoom)}. Reset to 100%`}
          disabled={!ready}
          onClick={() => canvas.zoomTo(1)}
          className="w-14 tabular-nums"
        >
          {formatZoom(zoom)}
        </Button>
      </Tooltip>
      <Tooltip content="Zoom in (Ctrl +)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          disabled={!ready}
          onClick={() => canvas.zoomIn()}
        >
          <Plus />
        </Button>
      </Tooltip>
      <Tooltip content="Fit to screen (Ctrl 0)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fit to screen"
          disabled={!ready}
          onClick={() => canvas.fitToScreen()}
        >
          <Maximize />
        </Button>
      </Tooltip>
    </div>
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
      >
        <Magnet />
      </Button>
    </Tooltip>
  );
}

function ChangeStatus() {
  const dirty = useEditor((state) => state.dirty);
  return (
    <span
      role="status"
      aria-live="polite"
      className="text-xs text-muted-foreground"
      title="Local autosave and export arrive in the next milestone; changes currently live in memory."
    >
      {dirty ? 'Unsaved changes' : 'No unsaved changes'}
    </span>
  );
}

export function TopBar() {
  const canUndo = useEditor(selectCanUndo);
  const canRedo = useEditor(selectCanRedo);
  const { undo, redo } = useEditorActions();

  return (
    <header className="flex h-12 items-center gap-3 border-b border-border bg-panel px-3">
      <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
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
      <Separator orientation="vertical" className="h-6" />
      <DocumentTitle />
      <div className="flex items-center gap-0.5" role="group" aria-label="History">
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
      <div className="ml-auto flex items-center gap-3">
        <ChangeStatus />
        <Separator orientation="vertical" className="h-6" />
        <SnapToggle />
        <ZoomControls />
      </div>
    </header>
  );
}
