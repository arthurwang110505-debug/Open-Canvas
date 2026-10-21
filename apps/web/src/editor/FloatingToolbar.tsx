import { selectSelectedElements } from '@opencanvas/editor-core';
import { Button, Separator, Tooltip } from '@opencanvas/ui';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Group,
  Lock,
  LockOpen,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { useEditor } from './hooks';

export function FloatingToolbar() {
  const selected = useEditor(useShallow(selectSelectedElements));
  const { duplicateSelection, deleteSelection, updateSelection, reorderSelection, groupSelection, ungroupSelection } = useEditorActions();
  if (selected.length === 0) return null;
  const allLocked = selected.every((el) => el.locked);
  const allHidden = selected.every((el) => !el.visible);
  const single = selected.length === 1;
  const canGroup = selected.length >= 2;
  const canUngroup = selected.length === 1 && selected[0]?.type === 'group';

  return (
    <div
      role="toolbar"
      aria-label="Selection actions"
      className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-white px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]"
    >
      <Tooltip content="Duplicate (Ctrl D)">
        <Button variant="ghost" size="icon-sm" aria-label="Duplicate selection" onClick={duplicateSelection} className="rounded-full">
          <Copy />
        </Button>
      </Tooltip>

      <Tooltip content={allLocked ? 'Unlock selection' : 'Lock selection'}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={allLocked ? 'Unlock selection' : 'Lock selection'}
          pressed={allLocked}
          onClick={() => updateSelection({ locked: !allLocked })}
          className="rounded-full"
        >
          {allLocked ? <Lock /> : <LockOpen />}
        </Button>
      </Tooltip>

      <Tooltip content={allHidden ? 'Show selection' : 'Hide selection'}>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={allHidden ? 'Show selection' : 'Hide selection'}
          pressed={allHidden}
          onClick={() => updateSelection({ visible: allHidden })}
          className="rounded-full"
        >
          {allHidden ? <EyeOff /> : <Eye />}
        </Button>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <Tooltip content="Bring forward">
        <Button variant="ghost" size="icon-sm" aria-label="Bring forward (selection)" disabled={!single} onClick={() => reorderSelection('forward')} className="rounded-full">
          <ArrowUp />
        </Button>
      </Tooltip>
      <Tooltip content="Bring to front">
        <Button variant="ghost" size="icon-sm" aria-label="Bring to front (selection)" disabled={!single} onClick={() => reorderSelection('front')} className="rounded-full">
          <ArrowUpToLine />
        </Button>
      </Tooltip>
      <Tooltip content="Send backward">
        <Button variant="ghost" size="icon-sm" aria-label="Send backward (selection)" disabled={!single} onClick={() => reorderSelection('backward')} className="rounded-full">
          <ArrowDown />
        </Button>
      </Tooltip>
      <Tooltip content="Send to back">
        <Button variant="ghost" size="icon-sm" aria-label="Send to back (selection)" disabled={!single} onClick={() => reorderSelection('back')} className="rounded-full">
          <ArrowDownToLine />
        </Button>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />
      {canGroup ? (
        <Tooltip content="Group (Ctrl G)">
          <Button variant="ghost" size="icon-sm" aria-label="Group selection" onClick={groupSelection} className="rounded-full">
            <Group />
          </Button>
        </Tooltip>
      ) : null}
      {canUngroup ? (
        <Tooltip content="Ungroup (Ctrl Shift G)">
          <Button variant="ghost" size="icon-sm" aria-label="Ungroup selection" onClick={ungroupSelection} className="rounded-full">
            <Ungroup />
          </Button>
        </Tooltip>
      ) : null}
      {(canGroup || canUngroup) ? <Separator orientation="vertical" className="mx-1 h-5" /> : null}

      <Tooltip content="Delete (Del)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete selection"
          onClick={deleteSelection}
          className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </Tooltip>
    </div>
  );
}
