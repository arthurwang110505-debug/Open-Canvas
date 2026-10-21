import {
  createEllipseElement,
  createIconElement,
  createPathElement,
  createRectElement,
  createTextElement,
  generateId,
  type DesignDocument,
  type DesignElement,
  type Fill,
} from '@opencanvas/document';
import {
  alignElements,
  alignmentTarget,
  distributeElements,
  fitElementsToSize,
  selectActivePage,
  selectSelectedElements,
  type AlignMode,
  type DispatchOptions,
  type DistributeAxis,
  type EditorCommand,
  type ElementPatch,
  type ReorderTarget,
} from '@opencanvas/editor-core';
import { useMemo } from 'react';

import { useCanvasController, useEditorStore } from './hooks';

export type ShapeKind =
  'rect' | 'rounded-rect' | 'ellipse' | 'line' | 'triangle' | 'star' | 'hexagon' | 'sparkle';
export type TextPreset = 'heading' | 'subheading' | 'body';

export interface EditorActions {
  addShape: (kind: ShapeKind) => void;
  addText: (preset: TextPreset) => void;
  /** Places a bundled icon, centred on the page; the id comes from `@opencanvas/icons`. */
  addIcon: (iconId: string) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  selectAll: () => void;
  clearSelection: () => void;
  /** Patches every selected element; `mergeKey` coalesces rapid edits into one undo step. */
  updateSelection: (patch: ElementPatch, mergeKey?: string) => void;
  /** Patches one element regardless of selection (layers panel toggles, rename). */
  updateElement: (elementId: string, patch: ElementPatch, mergeKey?: string) => void;
  reorderSelection: (to: ReorderTarget) => void;
  reorderElement: (elementId: string, to: ReorderTarget) => void;
  /** Aligns the selection: to the page for one element, to the selection box for several. */
  alignSelection: (mode: AlignMode) => void;
  /** Equalizes gaps between three or more selected elements. */
  distributeSelection: (axis: DistributeAxis) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  renameDocument: (name: string) => void;
  resizeDocument: (width: number, height: number) => void;
  setPageBackground: (fill: Fill, mergeKey?: string) => void;
  /** Replaces the current page with a template, fitted to this canvas (one undo step). */
  applyTemplate: (template: DesignDocument) => void;
  /** Inserts a template as a new page after the current one (one undo step). */
  addTemplatePage: (template: DesignDocument) => void;
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
        } else if (kind === 'line') {
          const pos = centered(size, side, 6);
          const y = pos.y + 3;
          addElement(
            createPathElement(
              [
                { x: pos.x, y },
                { x: pos.x + side, y },
              ],
              { stroke: { color: '#111827', width: 4 }, fill: { type: 'none' }, closed: false },
            ),
          );
        } else if (kind === 'triangle') {
          const { x, y } = position;
          addElement(
            createPathElement(
              [
                { x: x + side / 2, y },
                { x: x + side, y: y + side },
                { x, y: y + side },
              ],
              {
                fill: { type: 'solid', color: '#f59e0b' },
                stroke: { color: '#f59e0b', width: 0 },
                closed: true,
              },
            ),
          );
        } else if (kind === 'star') {
          const { x, y } = position;
          const cx = x + side / 2;
          const cy = y + side / 2;
          const outer = side / 2;
          const inner = side / 5;
          const pts: { x: number; y: number }[] = [];
          for (let i = 0; i < 10; i++) {
            const angle = -90 + i * 36;
            const r = i % 2 === 0 ? outer : inner;
            const rad = (angle * Math.PI) / 180;
            pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
          }
          addElement(
            createPathElement(pts, {
              fill: { type: 'solid', color: '#7a5cf9' },
              stroke: { color: '#7a5cf9', width: 0 },
              closed: true,
            }),
          );
        } else if (kind === 'hexagon') {
          const { x, y } = position;
          addElement(
            createPathElement(
              [
                { x: x + side * 0.25, y },
                { x: x + side * 0.75, y },
                { x: x + side, y: y + side * 0.5 },
                { x: x + side * 0.75, y: y + side },
                { x: x + side * 0.25, y: y + side },
                { x, y: y + side * 0.5 },
              ],
              {
                fill: { type: 'solid', color: '#06b6d4' },
                stroke: { color: '#06b6d4', width: 0 },
                closed: true,
              },
            ),
          );
        } else if (kind === 'sparkle') {
          const { x, y } = position;
          const cx = x + side / 2;
          const cy = y + side / 2;
          const outer = side / 2;
          const inner = side / 6;
          const pts: { x: number; y: number }[] = [];
          // 8-point sparkle (4 long + 4 short)
          for (let i = 0; i < 8; i++) {
            const angle = -90 + i * 45;
            const r = i % 2 === 0 ? outer : inner;
            const rad = (angle * Math.PI) / 180;
            pts.push({ x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) });
          }
          addElement(
            createPathElement(pts, {
              fill: { type: 'solid', color: '#ec4899' },
              stroke: { color: '#ec4899', width: 0 },
              closed: true,
            }),
          );
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

      addIcon: (iconId) => {
        const { size } = store.getState().document;
        const side = Math.round(Math.min(size.width, size.height) * 0.2);
        addElement(
          createIconElement({
            ...centered(size, side, side),
            width: side,
            height: side,
            iconId,
          }),
        );
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

      updateElement: (elementId, patch, mergeKey) => {
        dispatch(
          { type: 'element.update', pageId: pageId(), elementId, patch },
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

      reorderElement: (elementId, to) => {
        dispatch({ type: 'element.reorder', pageId: pageId(), elementId, to });
      },

      alignSelection: (mode) => {
        const state = store.getState();
        const elements = selectSelectedElements(state);
        if (elements.length === 0) return;
        const updates = alignElements(
          elements,
          mode,
          alignmentTarget(elements, state.document.size),
        );
        if (updates.length > 0) {
          dispatch({ type: 'element.updateMany', pageId: state.activePageId, updates });
        }
      },

      distributeSelection: (axis) => {
        const state = store.getState();
        const updates = distributeElements(selectSelectedElements(state), axis);
        if (updates.length > 0) {
          dispatch({ type: 'element.updateMany', pageId: state.activePageId, updates });
        }
      },

      groupSelection: () => {
        const ids = selected();
        if (ids.length >= 2) {
          dispatch({ type: 'element.group', pageId: pageId(), elementIds: ids });
        }
      },

      ungroupSelection: () => {
        const state = store.getState();
        const els = selectSelectedElements(state);
        if (els.length === 1 && els[0]?.type === 'group') {
          dispatch({ type: 'element.ungroup', pageId: state.activePageId, groupId: els[0].id });
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

      applyTemplate: (template) => {
        const state = store.getState();
        const source = template.pages[0];
        if (!source) return;
        // Template images must be registered before elements reference them.
        for (const asset of Object.values(template.assets)) {
          if (!(asset.id in state.document.assets)) {
            dispatch({ type: 'asset.register', asset }, { recordHistory: false });
          }
        }
        dispatch({
          type: 'page.replaceContent',
          pageId: state.activePageId,
          background: source.background,
          elements: fitElementsToSize(source.elements, template.size, state.document.size),
        });
        store.getState().setSelection([]);
      },

      addTemplatePage: (template) => {
        const state = store.getState();
        const source = template.pages[0];
        if (!source) return;
        for (const asset of Object.values(template.assets)) {
          if (!(asset.id in state.document.assets)) {
            dispatch({ type: 'asset.register', asset }, { recordHistory: false });
          }
        }
        const pageId = generateId('page');
        dispatch({
          type: 'page.add',
          afterPageId: state.activePageId,
          pageId,
          background: source.background,
          elements: fitElementsToSize(source.elements, template.size, state.document.size),
        });
        store.getState().setActivePage(pageId);
        store.getState().setSelection([]);
      },

      undo: () => store.getState().undo(),
      redo: () => store.getState().redo(),
    };
  }, [store, canvas]);
}
