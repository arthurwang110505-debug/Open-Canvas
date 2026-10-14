import {
  createEllipseElement,
  createRectElement,
  createTextElement,
  type DesignElement,
  type Fill,
} from '@opencanvas/document';
import {
  selectActivePage,
  type DispatchOptions,
  type EditorCommand,
  type ElementPatch,
  type ReorderTarget,
} from '@opencanvas/editor-core';
import { useMemo } from 'react';

import { useCanvasController, useEditorStore } from './hooks';

export type ShapeKind = 'rect' | 'rounded-rect' | 'ellipse';
export type TextPreset = 'heading' | 'subheading' | 'body';

export interface EditorActions {
  addShape: (kind: ShapeKind) => void;
  addText: (preset: TextPreset) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** Patches every selected element; `mergeKey` coalesces rapid edits into one undo step. */
  updateSelection: (patch: ElementPatch, mergeKey?: string) => void;
  reorderSelection: (to: ReorderTarget) => void;
  renameDocument: (name: string) => void;
  resizeDocument: (width: number, height: number) => void;
  setPageBackground: (fill: Fill, mergeKey?: string) => void;
  undo: () => void;
  redo: () => void;
}

const TEXT_PRESETS: Record<
  TextPreset,
  { text: string; fontSize: number; fontWeight: 400 | 600 | 700 | 800; widthRatio: number }
> = {
  heading: { text: 'Add a heading', fontSize: 96, fontWeight: 800, widthRatio: 0.8 },
  subheading: { text: 'Add a subheading', fontSize: 56, fontWeight: 600, widthRatio: 0.7 },
  body: { text: 'Add a little bit of body text', fontSize: 32, fontWeight: 400, widthRatio: 0.6 },
};

/** Centers a `width`x`height` box on the page. */
function centered(page: { width: number; height: number }, width: number, height: number) {
  return { x: Math.round((page.width - width) / 2), y: Math.round((page.height - height) / 2) };
}

export function useEditorActions(): EditorActions {
  const store = useEditorStore();
  const canvas = useCanvasController();

  return useMemo<EditorActions>(() => {
    const dispatch = (command: EditorCommand, options?: DispatchOptions) =>
      store.getState().dispatch(command, options);
    const pageId = () => store.getState().activePageId;
    const selected = () => store.getState().selectedIds;

    const addElement = (element: DesignElement) => {
      dispatch({ type: 'element.add', pageId: pageId(), element });
    };

    return {
      addShape: (kind) => {
        const { size } = store.getState().document;
        const side = Math.round(Math.min(size.width, size.height) * 0.3);
        const position = centered(size, side, side);
        if (kind === 'ellipse') {
          addElement(createEllipseElement({ ...position, width: side, height: side }));
        } else {
          addElement(
            createRectElement({
              ...position,
              width: side,
              height: side,
              cornerRadius: kind === 'rounded-rect' ? Math.round(side * 0.15) : 0,
            }),
          );
        }
      },

      addText: (preset) => {
        const { size } = store.getState().document;
        const spec = TEXT_PRESETS[preset];
        const scale = Math.min(size.width, size.height) / 1080;
        const fontSize = Math.max(12, Math.round(spec.fontSize * scale));
        const width = Math.round(size.width * spec.widthRatio);
        const height = Math.round(fontSize * 1.2);
        const element = createTextElement({
          ...centered(size, width, height),
          width,
          height,
          text: spec.text,
          fontSize,
          fontWeight: spec.fontWeight,
          textAlign: 'center',
        });
        addElement(element);
        canvas.beginTextEditing(element.id);
      },

      deleteSelection: () => {
        const ids = selected();
        if (ids.length > 0) dispatch({ type: 'element.delete', pageId: pageId(), elementIds: ids });
      },

      duplicateSelection: () => {
        const ids = selected();
        if (ids.length > 0) {
          dispatch({ type: 'element.duplicate', pageId: pageId(), elementIds: ids });
        }
      },

      nudgeSelection: (dx, dy) => {
        const state = store.getState();
        const ids = new Set(state.selectedIds);
        if (ids.size === 0) return;
        const page = selectActivePage(state);
        const updates = page.elements
          .filter((element) => ids.has(element.id) && !element.locked)
          .map((element) => ({
            elementId: element.id,
            patch: { x: element.x + dx, y: element.y + dy },
          }));
        if (updates.length > 0) {
          dispatch({ type: 'element.updateMany', pageId: page.id, updates }, { mergeKey: 'nudge' });
        }
      },

      selectAll: () => {
        const state = store.getState();
        state.setSelection(selectActivePage(state).elements.map((element) => element.id));
      },

      clearSelection: () => store.getState().clearSelection(),

      updateSelection: (patch, mergeKey) => {
        const ids = selected();
        if (ids.length === 0) return;
        dispatch(
          {
            type: 'element.updateMany',
            pageId: pageId(),
            updates: ids.map((elementId) => ({ elementId, patch })),
          },
          mergeKey ? { mergeKey } : undefined,
        );
      },

      reorderSelection: (to) => {
        const ids = selected();
        // Reordering is defined per element; multi-selection reorders in a stable sequence.
        const ordered = to === 'front' || to === 'forward' ? ids : [...ids].reverse();
        for (const elementId of ordered) {
          dispatch({ type: 'element.reorder', pageId: pageId(), elementId, to });
        }
      },

      renameDocument: (name) => {
        if (name.trim() && name.trim() !== store.getState().document.name) {
          dispatch({ type: 'document.rename', name });
        }
      },

      resizeDocument: (width, height) => {
        dispatch({ type: 'document.resize', width, height });
      },

      setPageBackground: (fill, mergeKey) => {
        dispatch(
          { type: 'page.setBackground', pageId: pageId(), background: fill },
          mergeKey ? { mergeKey } : undefined,
        );
      },

      undo: () => store.getState().undo(),
      redo: () => store.getState().redo(),
    };
  }, [store, canvas]);
}
