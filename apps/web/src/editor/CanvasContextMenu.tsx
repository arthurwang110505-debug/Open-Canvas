import { selectSelectedElements } from '@opencanvas/editor-core';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  Group,
  Lock,
  LockOpen,
  SlidersHorizontal,
  Trash2,
  Type,
  Ungroup,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/shallow';

import { useEditorActions } from './actions';
import { useEditor, useEditorStore } from './hooks';

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface CanvasContextMenuProps {
  position: ContextMenuPosition;
  onClose: () => void;
  onOpenPageSettings: () => void;
  onOpenProperties: () => void;
}

interface MenuAction {
  label: string;
  icon: React.ReactNode;
  run: () => void;
  destructive?: boolean;
}

/** Native-feeling right-click menu for the current selection or the blank page. */
export function CanvasContextMenu({
  position,
  onClose,
  onOpenPageSettings,
  onOpenProperties,
}: CanvasContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const selected = useEditor(useShallow(selectSelectedElements));
  const activePageId = useEditor((state) => state.activePageId);
  const store = useEditorStore();
  const {
    addText,
    addShape,
    duplicateSelection,
    deleteSelection,
    updateSelection,
    reorderSelection,
    groupSelection,
    ungroupSelection,
  } = useEditorActions();

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const dispatch = store.getState().dispatch;
  const single = selected.length === 1 ? selected[0] : undefined;
  const allLocked = selected.length > 0 && selected.every((element) => element.locked);
  const allHidden = selected.length > 0 && selected.every((element) => !element.visible);
  const actions: MenuAction[] =
    selected.length === 0
      ? [
          { label: 'Add heading', icon: <Type />, run: () => addText('heading') },
          {
            label: 'Add rectangle',
            icon: <span className="text-base leading-none">▭</span>,
            run: () => addShape('rect'),
          },
          {
            label: 'Add page',
            icon: <FilePlus2 />,
            run: () => dispatch({ type: 'page.add', afterPageId: activePageId }),
          },
          { label: 'Page settings', icon: <SlidersHorizontal />, run: onOpenPageSettings },
        ]
      : [
          { label: 'Duplicate', icon: <Copy />, run: duplicateSelection },
          {
            label: allLocked ? 'Unlock' : 'Lock',
            icon: allLocked ? <LockOpen /> : <Lock />,
            run: () => updateSelection({ locked: !allLocked }),
          },
          {
            label: allHidden ? 'Show' : 'Hide',
            icon: allHidden ? <Eye /> : <EyeOff />,
            run: () => updateSelection({ visible: allHidden }),
          },
          ...(single?.type === 'group'
            ? [{ label: 'Ungroup', icon: <Ungroup />, run: ungroupSelection }]
            : selected.length > 1
              ? [{ label: 'Group', icon: <Group />, run: groupSelection }]
              : []),
          {
            label: 'Bring to front',
            icon: <ArrowUpToLine />,
            run: () => reorderSelection('front'),
          },
          { label: 'Send to back', icon: <ArrowDownToLine />, run: () => reorderSelection('back') },
          { label: 'Edit details', icon: <SlidersHorizontal />, run: onOpenProperties },
          { label: 'Delete', icon: <Trash2 />, run: deleteSelection, destructive: true },
        ];

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={selected.length === 0 ? 'Page context menu' : 'Selection context menu'}
      onContextMenu={(event) => event.preventDefault()}
      style={{ left: position.x, top: position.y }}
      className="absolute z-50 min-w-48 rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
    >
      {actions.map((action, index) => (
        <div key={action.label}>
          {selected.length > 0 && (index === 4 || index === 6) ? (
            <div role="separator" className="mx-1 my-1 h-px bg-border" />
          ) : null}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              action.run();
              onClose();
            }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium outline-none transition-colors hover:bg-muted focus-visible:bg-muted ${action.destructive ? 'text-destructive' : 'text-foreground'}`}
          >
            <span className="flex size-4 items-center justify-center text-muted-foreground [&_svg]:size-4">
              {action.icon}
            </span>
            <span className="flex-1">{action.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
