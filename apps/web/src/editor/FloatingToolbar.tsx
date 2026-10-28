import { selectSelectedElements } from '@opencanvas/editor-core';
import {
  Button,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
  Separator,
  Tooltip,
  cn,
} from '@opencanvas/ui';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  Group,
  Lock,
  LockOpen,
  MoreHorizontal,
  Paintbrush,
  Scissors,
  SlidersHorizontal,
  Trash2,
  Ungroup,
} from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { useCanvasController, useCanvasState, useEditor } from './hooks';

const GAP = 10;
const EDGE = 8;

interface Placement {
  left: number;
  top: number;
}

interface FloatingToolbarProps {
  onOpenProperties: () => void;
}

/** A small selection pill; less-used arrange and visibility actions live in More. */
export function FloatingToolbar({ onOpenProperties }: FloatingToolbarProps) {
  const selected = useEditor(useShallow(selectSelectedElements));
  const {
    copySelection,
    cutSelection,
    pasteClipboard,
    copyStyle,
    pasteStyle,
    duplicateSelection,
    deleteSelection,
    updateSelection,
    reorderSelection,
    groupSelection,
    ungroupSelection,
  } = useEditorActions();
  const canPaste = useEditor((state) => state.clipboard !== null);
  const canPasteStyle = useEditor((state) => state.styleClipboard !== null);
  const canvas = useCanvasController();
  const interacting = useCanvasState((state) => state.interacting);
  const editingText = useCanvasState((state) => state.editingText);
  const viewportRevision = useCanvasState((state) => state.viewportRevision);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [, setWindowTick] = useState(0);

  useEffect(() => {
    const onResize = () => setWindowTick((tick) => tick + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const place = useCallback(() => {
    const element = toolbarRef.current;
    if (!element || selected.length === 0) {
      setPlacement(null);
      return;
    }
    const rect = canvas.getSelectionClientRect();
    const parent = element.offsetParent;
    if (!rect || !(parent instanceof HTMLElement)) {
      setPlacement(null);
      return;
    }
    const parentRect = parent.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const centreX = rect.left - parentRect.left + rect.width / 2;
    const aboveTop = rect.top - parentRect.top - GAP - height;
    const fitsAbove = aboveTop >= EDGE;
    const preferredTop = fitsAbove ? aboveTop : rect.top - parentRect.top + rect.height + GAP;
    const maxLeft = parentRect.width - width / 2 - EDGE;
    setPlacement({
      left: Math.min(Math.max(centreX, width / 2 + EDGE), Math.max(width / 2 + EDGE, maxLeft)),
      top: Math.max(EDGE, Math.min(preferredTop, parentRect.height - height - EDGE)),
    });
  }, [canvas, selected.length]);

  useLayoutEffect(() => {
    place();
  }, [place, selected, viewportRevision]);

  if (selected.length === 0 || interacting || editingText) return null;

  const allLocked = selected.every((element) => element.locked);
  const allHidden = selected.every((element) => !element.visible);
  const single = selected.length === 1;
  const canGroup = selected.length >= 2;
  const canUngroup = single && selected[0]?.type === 'group';

  return (
    <div
      ref={toolbarRef}
      role="toolbar"
      aria-label="Selection actions"
      style={
        placement
          ? { left: placement.left, top: placement.top, transform: 'translateX(-50%)' }
          : undefined
      }
      className={cn(
        'pointer-events-auto absolute z-20 flex items-center gap-1 rounded-full border border-border bg-white px-1.5 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06)]',
        !placement && 'top-3 left-1/2 -translate-x-1/2',
      )}
    >
      <Tooltip content="Duplicate (Ctrl D)">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Duplicate selection"
          onClick={duplicateSelection}
          className="rounded-full"
        >
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
      <Tooltip content="Edit selection details">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Edit selection details"
          onClick={onOpenProperties}
          className="rounded-full"
        >
          <SlidersHorizontal />
        </Button>
      </Tooltip>
      <Separator orientation="vertical" className="mx-0.5 h-5" />
      <Menu>
        <MenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="More selection actions"
            className="rounded-full"
          >
            <MoreHorizontal />
          </Button>
        </MenuTrigger>
        <MenuContent align="end" aria-label="Selection actions menu">
          <MenuLabel>Edit</MenuLabel>
          <MenuItem icon={<Copy />} hint="Ctrl C" onSelect={copySelection}>
            Copy
          </MenuItem>
          <MenuItem icon={<Scissors />} hint="Ctrl X" onSelect={cutSelection}>
            Cut
          </MenuItem>
          <MenuItem
            icon={<ClipboardPaste />}
            hint="Ctrl V"
            disabled={!canPaste}
            onSelect={pasteClipboard}
          >
            Paste
          </MenuItem>
          <MenuItem icon={<Paintbrush />} hint="Ctrl Alt C" disabled={!single} onSelect={copyStyle}>
            Copy style
          </MenuItem>
          <MenuItem
            icon={<Paintbrush />}
            hint="Ctrl Alt V"
            disabled={!canPasteStyle}
            onSelect={pasteStyle}
          >
            Paste style
          </MenuItem>
          <MenuSeparator />
          <MenuLabel>Arrange</MenuLabel>
          <MenuItem icon={<ArrowUpToLine />} onSelect={() => reorderSelection('front')}>
            Bring to front
          </MenuItem>
          <MenuItem icon={<ArrowUp />} onSelect={() => reorderSelection('forward')}>
            Bring forward
          </MenuItem>
          <MenuItem icon={<ArrowDown />} onSelect={() => reorderSelection('backward')}>
            Send backward
          </MenuItem>
          <MenuItem icon={<ArrowDownToLine />} onSelect={() => reorderSelection('back')}>
            Send to back
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            icon={allHidden ? <EyeOff /> : <Eye />}
            onSelect={() => updateSelection({ visible: allHidden })}
          >
            {allHidden ? 'Show selection' : 'Hide selection'}
          </MenuItem>
          {canGroup ? (
            <MenuItem icon={<Group />} onSelect={groupSelection}>
              Group selection
            </MenuItem>
          ) : null}
          {canUngroup ? (
            <MenuItem icon={<Ungroup />} onSelect={ungroupSelection}>
              Ungroup
            </MenuItem>
          ) : null}
        </MenuContent>
      </Menu>
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
