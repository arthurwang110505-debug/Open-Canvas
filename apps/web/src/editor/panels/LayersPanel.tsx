import { LIMITS, type DesignElement } from '@opencanvas/document';
import { selectActivePage } from '@opencanvas/editor-core';
import { Button, Input, Tooltip, cn } from '@opencanvas/ui';
import {
  Circle,
  Eye,
  EyeOff,
  GripVertical,
  ImageIcon,
  Lock,
  LockOpen,
  Square,
  Type,
} from 'lucide-react';
import {
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from '../actions';
import { describeElement } from '../elementLabels';
import { useEditor, useEditorStore } from '../hooks';

const TYPE_ICONS: Record<DesignElement['type'], ReactNode> = {
  rect: <Square />,
  ellipse: <Circle />,
  text: <Type />,
  image: <ImageIcon />,
};

type DropPosition = 'before' | 'after';

interface DropIndicator {
  elementId: string;
  position: DropPosition;
}

interface LayerRowProps {
  element: DesignElement;
  label: string;
  selected: boolean;
  renaming: boolean;
  dropIndicator: DropPosition | null;
  onSelect: (event: MouseEvent | KeyboardEvent) => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

function LayerRow({
  element,
  label,
  selected,
  renaming,
  dropIndicator,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: LayerRowProps) {
  const { updateElement } = useEditorActions();
  const [draft, setDraft] = useState(label);
  // Enter commits and unmounts the input; a trailing blur must not commit a second time.
  const settled = useRef(false);

  const startRename = () => {
    setDraft(label);
    settled.current = false;
    onStartRename();
  };
  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    onCommitRename(draft);
  };
  const cancel = () => {
    settled.current = true;
    onCancelRename();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    if (renaming) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(event);
    } else if (event.key === 'F2') {
      event.preventDefault();
      startRename();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const sibling =
        event.key === 'ArrowDown'
          ? event.currentTarget.nextElementSibling
          : event.currentTarget.previousElementSibling;
      if (sibling instanceof HTMLElement) sibling.focus();
    }
  };

  return (
    <li
      role="option"
      aria-selected={selected}
      aria-label={label}
      tabIndex={0}
      draggable={!renaming}
      onClick={onSelect}
      onDoubleClick={startRename}
      onKeyDown={onKeyDown}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative flex h-9 items-center gap-1.5 rounded-md border border-transparent px-1.5 text-xs outline-none select-none focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-secondary text-secondary-foreground' : 'hover:bg-muted',
        !element.visible && 'opacity-60',
        dropIndicator === 'before' && 'shadow-[inset_0_2px_0_0_var(--color-ring)]',
        dropIndicator === 'after' && 'shadow-[inset_0_-2px_0_0_var(--color-ring)]',
      )}
    >
      <GripVertical
        aria-hidden="true"
        className="size-3.5 shrink-0 cursor-grab text-muted-foreground/60"
      />
      <span aria-hidden="true" className="shrink-0 text-muted-foreground [&_svg]:size-3.5">
        {TYPE_ICONS[element.type]}
      </span>
      {renaming ? (
        <Input
          aria-label={`Rename ${label}`}
          autoFocus
          value={draft}
          maxLength={LIMITS.maxNameLength}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
            event.stopPropagation();
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          className="h-6 flex-1 px-1 text-xs"
        />
      ) : (
        <span className="flex-1 truncate" title="Double-click to rename">
          {label}
        </span>
      )}
      <span
        className={cn(
          'flex shrink-0 items-center gap-0.5',
          !(selected || element.locked || !element.visible) &&
            'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
        )}
      >
        <Tooltip content={element.visible ? 'Hide' : 'Show'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={element.visible ? `Hide ${label}` : `Show ${label}`}
            aria-pressed={!element.visible}
            className="size-6"
            onClick={(event) => {
              event.stopPropagation();
              updateElement(element.id, { visible: !element.visible });
            }}
          >
            {element.visible ? <Eye /> : <EyeOff />}
          </Button>
        </Tooltip>
        <Tooltip content={element.locked ? 'Unlock' : 'Lock'}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={element.locked ? `Unlock ${label}` : `Lock ${label}`}
            aria-pressed={element.locked}
            className="size-6"
            onClick={(event) => {
              event.stopPropagation();
              updateElement(element.id, { locked: !element.locked });
            }}
          >
            {element.locked ? <Lock /> : <LockOpen />}
          </Button>
        </Tooltip>
      </span>
    </li>
  );
}

/**
 * Z-order view of the active page, top-most element first. Supports click / Ctrl-click /
 * Shift-click selection, drag-and-drop reordering, inline rename and visibility/lock toggles.
 * Every change goes through the command layer, so it is undoable like any canvas edit.
 */
export function LayersPanel() {
  const store = useEditorStore();
  const elements = useEditor(useShallow((state) => selectActivePage(state).elements));
  const assets = useEditor((state) => state.document.assets);
  const selectedIds = useEditor((state) => state.selectedIds);
  const { updateElement, reorderElement } = useEditorActions();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
  const draggedId = useRef<string | null>(null);
  const anchorId = useRef<string | null>(null);

  // Visual order is top-most first; the document stores bottom-most first.
  const ordered = [...elements].reverse();
  const selected = new Set(selectedIds);

  const select = (elementId: string, event: MouseEvent | KeyboardEvent) => {
    const { setSelection } = store.getState();
    if (event.shiftKey && anchorId.current !== null) {
      const from = ordered.findIndex((element) => element.id === anchorId.current);
      const to = ordered.findIndex((element) => element.id === elementId);
      if (from !== -1 && to !== -1) {
        const [start, end] = from < to ? [from, to] : [to, from];
        setSelection(ordered.slice(start, end + 1).map((element) => element.id));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      setSelection(
        selected.has(elementId)
          ? selectedIds.filter((id) => id !== elementId)
          : [...selectedIds, elementId],
      );
    } else {
      setSelection([elementId]);
    }
    anchorId.current = elementId;
  };

  const commitRename = (element: DesignElement, raw: string) => {
    setRenamingId(null);
    const name = raw.trim();
    const current = element.name ?? '';
    if (name === current) return;
    updateElement(element.id, { name: name.length > 0 ? name : undefined });
  };

  const dropIndexFor = (targetId: string, position: DropPosition): number | null => {
    const dragged = draggedId.current;
    if (dragged === null || dragged === targetId) return null;
    // Index within the array after the dragged element is removed (reducer semantics).
    const without = elements.filter((element) => element.id !== dragged);
    const targetIndex = without.findIndex((element) => element.id === targetId);
    if (targetIndex === -1) return null;
    // "before" in the visual list means above the target, i.e. one slot later in z-order.
    return position === 'before' ? targetIndex + 1 : targetIndex;
  };

  const onDragOver = (event: DragEvent<HTMLLIElement>, elementId: string) => {
    if (draggedId.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const position: DropPosition =
      event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after';
    if (dropIndicator?.elementId !== elementId || dropIndicator.position !== position) {
      setDropIndicator({ elementId, position });
    }
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, elementId: string) => {
    event.preventDefault();
    const dragged = draggedId.current;
    const position = dropIndicator?.elementId === elementId ? dropIndicator.position : 'after';
    const index = dropIndexFor(elementId, position);
    draggedId.current = null;
    setDropIndicator(null);
    if (dragged !== null && index !== null) {
      const currentIndex = elements.findIndex((element) => element.id === dragged);
      if (currentIndex !== index) reorderElement(dragged, { index });
    }
  };

  if (elements.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        The page is empty. Elements you add appear here, top-most first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground">
        {elements.length} element{elements.length === 1 ? '' : 's'}. Drag to reorder, double-click
        to rename, Ctrl/⌘-click to select several.
      </p>
      <ul
        role="listbox"
        aria-label="Layers"
        aria-multiselectable="true"
        className="flex flex-col gap-0.5"
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setDropIndicator(null);
          }
        }}
      >
        {ordered.map((element) => (
          <LayerRow
            key={element.id}
            element={element}
            label={describeElement(element, assets)}
            selected={selected.has(element.id)}
            renaming={renamingId === element.id}
            dropIndicator={dropIndicator?.elementId === element.id ? dropIndicator.position : null}
            onSelect={(event) => select(element.id, event)}
            onStartRename={() => setRenamingId(element.id)}
            onCommitRename={(name) => commitRename(element, name)}
            onCancelRename={() => setRenamingId(null)}
            onDragStart={(event) => {
              draggedId.current = element.id;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', element.id);
            }}
            onDragOver={(event) => onDragOver(event, element.id)}
            onDrop={(event) => onDrop(event, element.id)}
            onDragEnd={() => {
              draggedId.current = null;
              setDropIndicator(null);
            }}
          />
        ))}
      </ul>
    </div>
  );
}
