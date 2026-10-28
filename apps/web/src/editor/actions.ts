import {
  createEllipseElement,
  createFrameElement,
  createIconElement,
  createPathElement,
  createRectElement,
  createTextElement,
  generateId,
  type DesignDocument,
  type DesignElement,
  type Fill,
  type PageGuide,
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
import { panFramePhoto } from '@opencanvas/canvas-fabric';
import { useMemo } from 'react';

import { useCanvasController, useEditorStore } from './hooks';
import { FONT_PAIRINGS, TEXT_PRESETS, type TextPreset } from './textPresets';

export type { TextPreset } from './textPresets';

/** The frame shapes offered in the Elements panel. */
export type FrameKind = 'frame-rect' | 'frame-rounded' | 'frame-ellipse' | 'frame-circle';

export type ShapeKind =
  'rect' | 'rounded-rect' | 'ellipse' | 'line' | 'triangle' | 'star' | 'hexagon' | 'sparkle';

export interface EditorActions {
  /** Adds a shape in the middle of the page, or centred on `at` (page coordinates). */
  addShape: (kind: ShapeKind, at?: { x: number; y: number }) => void;
  addText: (preset: TextPreset, at?: { x: number; y: number }) => void;
  /** Inserts an empty frame (a mask waiting for a photo). */
  addFrame: (kind: FrameKind, at?: { x: number; y: number }) => void;
  /** Inserts the heading and body of a font pairing as one undo step. */
  addTextPairing: (pairingId: string) => void;
  /** Places a bundled icon; the id comes from `@opencanvas/icons`. */
  addIcon: (iconId: string, at?: { x: number; y: number }) => void;
  deleteSelection: () => void;
  duplicateSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: () => void;
  copyStyle: () => void;
  pasteStyle: () => void;
  nudgeSelection: (dx: number, dy: number) => void;
  /** Moves the photo inside the frame being adjusted; no-op outside adjust-photo mode. */
  nudgePhoto: (dx: number, dy: number) => void;
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
  addGuide: (
    axis: PageGuide['axis'],
    kind: PageGuide['kind'],
    position: number,
    guideId?: string,
    mergeKey?: string,
  ) => void;
  updateGuide: (guideId: string, position: number, mergeKey?: string) => void;
  removeGuide: (guideId: string) => void;
  clearGuides: () => void;
  toggleRulers: () => void;
  /** Replaces the current page with a template, fitted to this canvas (one undo step). */
  applyTemplate: (template: DesignDocument) => void;
  /** Inserts a template as a new page after the current one (one undo step). */
  addTemplatePage: (template: DesignDocument) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Top-left for a `width`x`height` box: centred on the page by default, or centred on `at` when a
 * drop point is given. Coordinates are clamped to the canvas so a drop on the edge still lands.
 */
function placeAt(
  page: { width: number; height: number },
  width: number,
  height: number,
  at?: { x: number; y: number },
) {
  if (!at) {
    return { x: Math.round((page.width - width) / 2), y: Math.round((page.height - height) / 2) };
  }
  const clamp = (value: number, max: number) => Math.round(Math.min(Math.max(value, 0), max));
  return {
    x: clamp(at.x - width / 2, page.width - width),
    y: clamp(at.y - height / 2, page.height - height),
  };
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
      addShape: (kind, at) => {
        const { size } = store.getState().document;
        const side = Math.round(Math.min(size.width, size.height) * 0.3);
        const position = placeAt(size, side, side, at);
        const linePos = placeAt(size, side, 6, at);
        if (kind === 'ellipse') {
          addElement(createEllipseElement({ ...position, width: side, height: side }));
        } else if (kind === 'line') {
          const pos = linePos;
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

      addIcon: (iconId, at) => {
        const { size } = store.getState().document;
        const side = Math.round(Math.min(size.width, size.height) * 0.2);
        addElement(
          createIconElement({
            ...placeAt(size, side, side, at),
            width: side,
            height: side,
            iconId,
          }),
        );
      },

      addText: (preset, at) => {
        const { size } = store.getState().document;
        const spec = TEXT_PRESETS[preset];
        const scale = Math.min(size.width, size.height) / 1080;
        const fontSize = Math.max(12, Math.round(spec.fontSize * scale));
        const width = Math.round(size.width * spec.widthRatio);
        const height = Math.round(fontSize * 1.2);
        const element = createTextElement({
          ...placeAt(size, width, height, at),
          width,
          height,
          text: spec.text,
          fontSize,
          fontWeight: spec.fontWeight,
          fontStyle: spec.fontStyle,
          letterSpacing: Math.round(spec.letterSpacing * scale),
          textTransform: spec.textTransform,
          textAlign: 'center',
        });
        addElement(element);
        canvas.beginTextEditing(element.id);
      },

      addFrame: (kind, at) => {
        const { size } = store.getState().document;
        const side = Math.round(Math.min(size.width, size.height) * 0.4);
        const width = kind === 'frame-circle' ? side : Math.round(side * 1.25);
        const height = side;
        addElement(
          createFrameElement({
            ...placeAt(size, width, height, at),
            width,
            height,
            shape: kind === 'frame-ellipse' || kind === 'frame-circle' ? 'ellipse' : 'rect',
            cornerRadius: kind === 'frame-rounded' ? Math.round(side * 0.12) : 0,
          }),
        );
      },

      addTextPairing: (pairingId) => {
        const pairing = FONT_PAIRINGS.find((candidate) => candidate.id === pairingId);
        if (!pairing) return;
        const { size } = store.getState().document;
        const scale = Math.min(size.width, size.height) / 1080;
        const headingSize = Math.max(12, Math.round(TEXT_PRESETS.heading.fontSize * scale));
        const bodySize = Math.max(10, Math.round(TEXT_PRESETS.body.fontSize * scale));
        const headingWidth = Math.round(size.width * TEXT_PRESETS.heading.widthRatio);
        const bodyWidth = Math.round(size.width * TEXT_PRESETS.body.widthRatio);
        const headingHeight = Math.round(headingSize * 1.2);
        const bodyHeight = Math.round(bodySize * 1.4);
        const gap = Math.round(32 * scale);
        const top = Math.round((size.height - (headingHeight + gap + bodyHeight)) / 2);
        const body = createTextElement({
          x: Math.round((size.width - bodyWidth) / 2),
          y: top + headingHeight + gap,
          width: bodyWidth,
          height: bodyHeight,
          text: TEXT_PRESETS.body.text,
          fontSize: bodySize,
          fontFamily: pairing.bodyFamily,
          textAlign: 'center',
        });
        const heading = createTextElement({
          x: Math.round((size.width - headingWidth) / 2),
          y: top,
          width: headingWidth,
          height: headingHeight,
          text: TEXT_PRESETS.heading.text,
          fontSize: headingSize,
          fontWeight: pairing.headingWeight,
          fontFamily: pairing.headingFamily,
          textAlign: 'center',
        });
        // One undo step for the pair; the heading is added last so it ends up selected.
        const mergeKey = `text-pairing:${heading.id}`;
        dispatch({ type: 'element.add', pageId: pageId(), element: body }, { mergeKey });
        dispatch({ type: 'element.add', pageId: pageId(), element: heading }, { mergeKey });
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

      copySelection: () => store.getState().copySelection(),
      cutSelection: () => store.getState().cutSelection(),
      pasteClipboard: () => store.getState().pasteClipboard(),
      copyStyle: () => store.getState().copyStyle(),
      pasteStyle: () => store.getState().pasteStyle(),

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

      nudgePhoto: (dx, dy) => {
        const state = store.getState();
        if (!state.photoPanId) return;
        const page = selectActivePage(state);
        const element = page.elements.find((candidate) => candidate.id === state.photoPanId);
        if (element?.type !== 'frame' || element.locked || !element.assetId) return;
        const asset = state.document.assets[element.assetId];
        if (!asset) return;
        const crop = panFramePhoto(element, asset, { x: dx, y: dy });
        if (!crop) return;
        dispatch(
          { type: 'element.update', pageId: page.id, elementId: element.id, patch: { crop } },
          { mergeKey: 'photo-pan' },
        );
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

      addGuide: (axis, kind, position, guideId, mergeKey) => {
        dispatch(
          {
            type: 'page.addGuide',
            pageId: pageId(),
            guide: { id: guideId ?? generateId('guide'), axis, kind, position },
          },
          mergeKey ? { mergeKey, mergeWindowMs: Number.POSITIVE_INFINITY } : undefined,
        );
      },

      updateGuide: (guideId, position, mergeKey) => {
        dispatch(
          { type: 'page.updateGuide', pageId: pageId(), guideId, position },
          mergeKey ? { mergeKey, mergeWindowMs: Number.POSITIVE_INFINITY } : undefined,
        );
      },

      removeGuide: (guideId) => {
        dispatch({ type: 'page.removeGuide', pageId: pageId(), guideId });
      },

      clearGuides: () => {
        dispatch({ type: 'page.clearGuides', pageId: pageId() });
      },

      toggleRulers: () => {
        const state = store.getState();
        state.setRulersVisible(!state.rulersVisible);
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
