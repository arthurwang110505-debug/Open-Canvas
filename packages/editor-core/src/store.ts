import {
  collectElementIds,
  type DesignDocument,
  type ImageCrop,
  type Result,
} from '@opencanvas/document';
import { createStore, type StoreApi } from 'zustand/vanilla';

import type { CommandError, EditorCommand } from './commands';
import { applyCommand } from './reducer';
import { clampZoom } from './zoom';

export interface DispatchOptions {
  /**
   * Consecutive dispatches sharing a `mergeKey` (within the merge window) collapse into a
   * single history entry, e.g. while typing a value into a numeric input.
   */
  mergeKey?: string;
  /**
   * Set to `false` for derived mutations that must not create an undo step
   * (for example storing the measured height of an auto-sized text box).
   */
  recordHistory?: boolean;
}

/** A box being cropped on the canvas: where the drag has put the element and what it shows. */
export interface CropDraft {
  box: { x: number; y: number; width: number; height: number };
  crop?: ImageCrop | undefined;
}

export interface EditorState {
  document: DesignDocument;
  activePageId: string;
  selectedIds: readonly string[];
  past: readonly DesignDocument[];
  future: readonly DesignDocument[];
  /** True when `document` differs from the last saved snapshot. */
  dirty: boolean;
  zoom: number;
  /** Last rejected command, surfaced to the UI; cleared with `clearError()`. */
  lastError: CommandError | null;
  /**
   * The frame whose photo is being repositioned inside its mask ("adjust photo" mode). UI state,
   * not document state: it changes no data and never reaches the undo history.
   */
  photoPanId: string | null;
  /**
   * The image being cropped on the canvas, if any. Like `photoPanId` this is UI state: the draft
   * changes on every pointer move, and the document only changes when the crop is applied.
   */
  cropId: string | null;
  cropDraft: CropDraft | null;
}

/** Actions are plain closures (no `this`), so they can be destructured freely. */
export interface EditorActions {
  dispatch: (
    command: EditorCommand,
    options?: DispatchOptions,
  ) => Result<DesignDocument, CommandError>;
  undo: () => boolean;
  redo: () => boolean;
  canUndo: () => boolean;
  canRedo: () => boolean;
  setSelection: (ids: readonly string[]) => void;
  clearSelection: () => void;
  /** Enters (`id`) or leaves (`null`) adjust-photo mode for a frame. */
  setPhotoPan: (elementId: string | null) => void;
  /** Starts cropping an image on the canvas; no-op for anything but an image on the active page. */
  beginCrop: (elementId: string) => void;
  /** Records the box a crop drag has reached; no history, no document change. */
  updateCropDraft: (draft: CropDraft) => void;
  /** Writes the draft to the document as one undoable change and leaves crop mode. */
  applyCrop: () => void;
  /** Leaves crop mode without changing the document. */
  cancelCrop: () => void;
  setActivePage: (pageId: string) => void;
  setZoom: (zoom: number) => void;
  /**
   * Records which document snapshot is persisted. Pass the snapshot that was actually written:
   * when the user kept editing while the save ran, the store stays dirty and undoing back to
   * that snapshot reports clean. Defaults to the current document.
   */
  markSaved: (saved?: DesignDocument) => void;
  /** Replaces the document (open project, import, AI result) and resets history. */
  loadDocument: (document: DesignDocument) => void;
  clearError: () => void;
}

export type EditorStoreState = EditorState & EditorActions;
export type EditorStore = StoreApi<EditorStoreState>;

export interface CreateEditorStoreOptions {
  /** Maximum number of undo steps kept in memory. */
  historyLimit?: number;
  /** Window (ms) during which dispatches with the same `mergeKey` coalesce. */
  mergeWindowMs?: number;
  now?: () => Date;
  initialZoom?: number;
}

const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_MERGE_WINDOW_MS = 800;

function firstPageId(document: DesignDocument): string {
  const page = document.pages[0];
  if (!page) throw new Error('A document must contain at least one page.');
  return page.id;
}

/** Drops the photo-pan target when its element is no longer on the page. */
function prunePhotoPan(
  document: DesignDocument,
  pageId: string,
  photoPanId: string | null,
): string | null {
  if (!photoPanId) return null;
  const page = document.pages.find((candidate) => candidate.id === pageId);
  return page?.elements.some((element) => element.id === photoPanId) ? photoPanId : null;
}

function pruneSelection(document: DesignDocument, selectedIds: readonly string[]): string[] {
  if (selectedIds.length === 0) return [];
  const existing = collectElementIds(document);
  return selectedIds.filter((id) => existing.has(id));
}

/**
 * Selection after undo/redo: elements that (re)appear on the active page become the
 * selection (undoing a delete or redoing an insert highlights the affected elements);
 * otherwise the current selection is kept, minus elements that no longer exist.
 */
function selectionAfterHistoryStep(
  from: DesignDocument,
  to: DesignDocument,
  activePageId: string,
  selectedIds: readonly string[],
): string[] {
  const before = collectElementIds(from);
  const page = to.pages.find((p) => p.id === activePageId);
  const appeared = page?.elements.filter((element) => !before.has(element.id)) ?? [];
  if (appeared.length > 0) return appeared.map((element) => element.id);
  return pruneSelection(to, selectedIds);
}

export function createEditorStore(
  initialDocument: DesignDocument,
  options: CreateEditorStoreOptions = {},
): EditorStore {
  const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;
  const mergeWindowMs = options.mergeWindowMs ?? DEFAULT_MERGE_WINDOW_MS;
  const now = options.now ?? (() => new Date());

  // Bookkeeping that is intentionally not part of the observable state.
  let savedDocument: DesignDocument = initialDocument;
  let lastMerge: { key: string; at: number } | null = null;

  return createStore<EditorStoreState>()((set, get) => ({
    document: initialDocument,
    activePageId: firstPageId(initialDocument),
    selectedIds: [],
    past: [],
    future: [],
    dirty: false,
    zoom: clampZoom(options.initialZoom ?? 1),
    lastError: null,
    photoPanId: null,
    cropId: null,
    cropDraft: null,

    dispatch: (command, dispatchOptions = {}) => {
      const state = get();
      const outcome = applyCommand(state.document, command, { now });
      if (!outcome.ok) {
        set({ lastError: outcome.error });
        return outcome;
      }
      const nextDocument = outcome.value;
      if (nextDocument === state.document) return outcome;

      const recordHistory = dispatchOptions.recordHistory ?? true;
      const timestamp = now().getTime();
      const mergeKey = dispatchOptions.mergeKey;
      const canMerge =
        recordHistory &&
        mergeKey !== undefined &&
        lastMerge !== null &&
        lastMerge.key === mergeKey &&
        timestamp - lastMerge.at <= mergeWindowMs;

      let past = state.past;
      let future = state.future;
      if (recordHistory) {
        if (!canMerge) {
          past = [...state.past, state.document].slice(-historyLimit);
        }
        future = [];
        lastMerge = mergeKey !== undefined ? { key: mergeKey, at: timestamp } : null;
      }

      let selectedIds = state.selectedIds;
      let activePageId = state.activePageId;
      if (command.type === 'element.add') {
        selectedIds = [command.element.id];
      } else if (command.type === 'element.duplicate') {
        const page = nextDocument.pages.find((p) => p.id === command.pageId);
        const added = page ? page.elements.slice(-command.elementIds.length) : [];
        selectedIds = added.map((element) => element.id);
      } else if (command.type === 'element.delete') {
        selectedIds = pruneSelection(nextDocument, state.selectedIds);
      } else if (command.type === 'element.group') {
        const newGroupId =
          command.groupId ??
          nextDocument.pages
            .find((p) => p.id === command.pageId)
            ?.elements.find(
              (el) =>
                !state.document.pages
                  .find((pp) => pp.id === command.pageId)
                  ?.elements.some((prev) => prev.id === el.id),
            )?.id;
        // newGroupId is the id of the element that appears in next but not in prev (the group)
        if (newGroupId) selectedIds = [newGroupId];
        else {
          // fallback: find group by diff
          const prevIds = new Set(
            state.document.pages.find((p) => p.id === command.pageId)?.elements.map((e) => e.id) ??
              [],
          );
          const diff = nextDocument.pages
            .find((p) => p.id === command.pageId)
            ?.elements.find((e) => !prevIds.has(e.id));
          selectedIds = diff ? [diff.id] : [];
        }
      } else if (command.type === 'element.ungroup') {
        const prevPage = state.document.pages.find((p) => p.id === command.pageId);
        const group = prevPage?.elements.find((e) => e.id === command.groupId);
        if (group?.type === 'group') {
          selectedIds = group.children.map((c) => c.id);
        } else {
          selectedIds = [];
        }
      } else if (command.type === 'page.add' || command.type === 'page.duplicate') {
        // New page becomes active and selected — find the id that was inserted
        const beforeIds = new Set(state.document.pages.map((p) => p.id));
        const newPage = nextDocument.pages.find((p) => !beforeIds.has(p.id));
        if (newPage) activePageId = newPage.id;
        selectedIds = [];
      } else if (command.type === 'page.delete') {
        if (!nextDocument.pages.some((p) => p.id === state.activePageId)) {
          // Deleted active page — pick nearest remaining (same index or last)
          const deletedIndex = state.document.pages.findIndex((p) => p.id === command.pageId);
          const fallbackIndex = Math.min(deletedIndex, nextDocument.pages.length - 1);
          const fallback = nextDocument.pages[fallbackIndex] ?? nextDocument.pages[0];
          if (fallback) activePageId = fallback.id;
        }
        selectedIds = pruneSelection(nextDocument, state.selectedIds);
      } else if (command.type === 'page.reorder') {
        // keep activePageId as-is; no selection change
      }
      // Safety: if active page vanished for any other reason (e.g. undo/redo via dispatch path), fallback
      if (!nextDocument.pages.some((p) => p.id === activePageId)) {
        const fb = nextDocument.pages[0];
        if (fb) activePageId = fb.id;
      }

      set({
        document: nextDocument,
        activePageId,
        past,
        future,
        selectedIds,
        photoPanId: prunePhotoPan(nextDocument, activePageId, state.photoPanId),
        cropId: prunePhotoPan(nextDocument, activePageId, state.cropId),
        cropDraft: prunePhotoPan(nextDocument, activePageId, state.cropId) ? state.cropDraft : null,
        dirty: nextDocument !== savedDocument,
        lastError: null,
      });
      return outcome;
    },

    undo: () => {
      const state = get();
      const previous = state.past[state.past.length - 1];
      if (!previous) return false;
      lastMerge = null;
      let activePageId = state.activePageId;
      if (!previous.pages.some((p) => p.id === activePageId)) {
        const fb = previous.pages[0];
        if (fb) activePageId = fb.id;
      }
      set({
        document: previous,
        activePageId,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
        selectedIds: selectionAfterHistoryStep(
          state.document,
          previous,
          activePageId,
          state.selectedIds,
        ),
        photoPanId: prunePhotoPan(previous, activePageId, state.photoPanId),
        cropId: prunePhotoPan(previous, activePageId, state.cropId),
        cropDraft: prunePhotoPan(previous, activePageId, state.cropId) ? state.cropDraft : null,
        dirty: previous !== savedDocument,
      });
      return true;
    },

    redo: () => {
      const state = get();
      const [next, ...rest] = state.future;
      if (!next) return false;
      lastMerge = null;
      let activePageId = state.activePageId;
      if (!next.pages.some((p) => p.id === activePageId)) {
        const fb = next.pages[0];
        if (fb) activePageId = fb.id;
      }
      set({
        document: next,
        activePageId,
        past: [...state.past, state.document].slice(-historyLimit),
        future: rest,
        selectedIds: selectionAfterHistoryStep(
          state.document,
          next,
          activePageId,
          state.selectedIds,
        ),
        photoPanId: prunePhotoPan(next, activePageId, state.photoPanId),
        cropId: prunePhotoPan(next, activePageId, state.cropId),
        cropDraft: prunePhotoPan(next, activePageId, state.cropId) ? state.cropDraft : null,
        dirty: next !== savedDocument,
      });
      return true;
    },

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    setSelection: (ids) => {
      const state = get();
      const page = state.document.pages.find((p) => p.id === state.activePageId);
      const onPage = new Set(page?.elements.map((element) => element.id) ?? []);
      const unique = Array.from(new Set(ids)).filter((id) => onPage.has(id));
      const unchanged =
        unique.length === state.selectedIds.length &&
        unique.every((id, index) => state.selectedIds[index] === id);
      // Adjust-photo mode ends as soon as its frame is no longer the thing being edited.
      const photoPanId =
        state.photoPanId !== null && unique.includes(state.photoPanId) ? state.photoPanId : null;
      if (unchanged && photoPanId === state.photoPanId) return;
      set({ selectedIds: unique, photoPanId });
    },

    clearSelection: () => {
      const state = get();
      if (state.selectedIds.length === 0 && state.photoPanId === null && state.cropId === null) {
        return;
      }
      set({ selectedIds: [], photoPanId: null, cropId: null, cropDraft: null });
    },

    setPhotoPan: (elementId) => {
      const state = get();
      if (state.photoPanId === elementId) return;
      // Only one canvas mode at a time: adjusting a photo and cropping exclude each other.
      set({ photoPanId: elementId, ...(elementId ? { cropId: null, cropDraft: null } : {}) });
    },

    beginCrop: (elementId) => {
      const state = get();
      const page = state.document.pages.find((candidate) => candidate.id === state.activePageId);
      const element = page?.elements.find((candidate) => candidate.id === elementId);
      if (!page || element?.type !== 'image') return;
      state.setSelection([elementId]);
      set({
        cropId: elementId,
        cropDraft: {
          box: { x: element.x, y: element.y, width: element.width, height: element.height },
          ...(element.crop !== undefined ? { crop: element.crop } : {}),
        },
        photoPanId: null,
      });
    },

    updateCropDraft: (draft) => {
      if (get().cropId === null) return;
      set({ cropDraft: draft });
    },

    applyCrop: () => {
      const state = get();
      const elementId = state.cropId;
      const draft = state.cropDraft;
      const page = state.document.pages.find((candidate) => candidate.id === state.activePageId);
      const element = page?.elements.find((candidate) => candidate.id === elementId);
      set({ cropId: null, cropDraft: null });
      if (!page || !elementId || !draft || element?.type !== 'image') return;
      const sameBox =
        draft.box.x === element.x &&
        draft.box.y === element.y &&
        draft.box.width === element.width &&
        draft.box.height === element.height;
      const sameCrop =
        draft.crop?.x === element.crop?.x &&
        draft.crop?.y === element.crop?.y &&
        draft.crop?.width === element.crop?.width &&
        draft.crop?.height === element.crop?.height;
      if (sameBox && sameCrop) return;
      get().dispatch({
        type: 'element.update',
        pageId: page.id,
        elementId,
        patch: { ...draft.box, crop: draft.crop },
      });
    },

    cancelCrop: () => {
      if (get().cropId === null) return;
      set({ cropId: null, cropDraft: null });
    },

    setActivePage: (pageId) => {
      const state = get();
      if (!state.document.pages.some((page) => page.id === pageId)) {
        // Switching to a page that does not exist is a programming error, not user input.
        throw new Error(`Cannot activate unknown page "${pageId}".`);
      }
      if (pageId !== state.activePageId) {
        set({
          activePageId: pageId,
          selectedIds: [],
          photoPanId: null,
          cropId: null,
          cropDraft: null,
        });
      }
    },

    setZoom: (zoom) => {
      const clamped = clampZoom(zoom);
      if (clamped !== get().zoom) set({ zoom: clamped });
    },

    markSaved: (saved = get().document) => {
      savedDocument = saved;
      const dirty = get().document !== savedDocument;
      if (dirty !== get().dirty) set({ dirty });
    },

    loadDocument: (document) => {
      savedDocument = document;
      lastMerge = null;
      set({
        document,
        activePageId: firstPageId(document),
        selectedIds: [],
        photoPanId: null,
        cropId: null,
        cropDraft: null,
        past: [],
        future: [],
        dirty: false,
        lastError: null,
      });
    },

    clearError: () => {
      if (get().lastError) set({ lastError: null });
    },
  }));
}
