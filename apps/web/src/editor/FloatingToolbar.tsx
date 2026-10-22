import { selectSelectedElements } from '@opencanvas/editor-core';
import { Button, Separator, Tooltip, cn } from '@opencanvas/ui';
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

/**
 * Selection toolbar that floats directly above the selected object (below it when there is no
 * room above). It steps out of the way while dragging or editing text, and clamps itself to the
 * workspace so it never disappears off-screen.
 */
export function FloatingToolbar() {
  const selected = useEditor(useShallow(selectSelectedElements));
  const {
    duplicateSelection,
    deleteSelection,
    updateSelection,
    reorderSelection,
    groupSelection,
    ungroupSelection,
  } = useEditorActions();
  const canvas = useCanvasController();
  const interacting = useCanvasState((state) => state.interacting);
  const editingText = useCanvasState((state) => state.editingText);
  const viewportRevision = useCanvasState((state) => state.viewportRevision);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [, setWindowTick] = useState(0);

  // Window resizes move the page under a fixed client rect, so recompute then too.
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
      // jsdom and other layout-less environments: fall back to the CSS-centered position.
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

  const allLocked = selected.every((el) => el.locked);
  const allHidden = selected.every((el) => !el.visible);
  const single = selected.length === 1;
  const canGroup = selected.length >= 2;
  const canUngroup = selected.length === 1 && selected[0]?.type === 'group';

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
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Bring forward (selection)"
          disabled={!single}
          onClick={() => reorderSelection('forward')}
          className="rounded-full"
        >
          <ArrowUp />
        </Button>
      </Tooltip>
      <Tooltip content="Bring to front">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Bring to front (selection)"
          disabled={!single}
          onClick={() => reorderSelection('front')}
          className="rounded-full"
        >
          <ArrowUpToLine />
        </Button>
      </Tooltip>
      <Tooltip content="Send backward">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Send backward (selection)"
          disabled={!single}
          onClick={() => reorderSelection('backward')}
          className="rounded-full"
        >
          <ArrowDown />
        </Button>
      </Tooltip>
      <Tooltip content="Send to back">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Send to back (selection)"
          disabled={!single}
          onClick={() => reorderSelection('back')}
          className="rounded-full"
        >
          <ArrowDownToLine />
        </Button>
      </Tooltip>

      <Separator orientation="vertical" className="mx-1 h-5" />
      {canGroup ? (
        <Tooltip content="Group (Ctrl G)">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Group selection"
            onClick={groupSelection}
            className="rounded-full"
          >
            <Group />
          </Button>
        </Tooltip>
      ) : null}
      {canUngroup ? (
        <Tooltip content="Ungroup (Ctrl Shift G)">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Ungroup selection"
            onClick={ungroupSelection}
            className="rounded-full"
          >
            <Ungroup />
          </Button>
        </Tooltip>
      ) : null}
      {canGroup || canUngroup ? <Separator orientation="vertical" className="mx-1 h-5" /> : null}

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
