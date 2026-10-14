import { collectElementIds, type DesignDocument, type Result } from '@opencanvas/document';
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
  setActivePage: (pageId: string) => void;
  setZoom: (zoom: number) => void;
  /** Marks the current document as persisted; `dirty` becomes true again on the next change. */
  markSaved: () => void;
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
      if (command.type === 'element.add') {
        selectedIds = [command.element.id];
      } else if (command.type === 'element.duplicate') {
        const page = nextDocument.pages.find((p) => p.id === command.pageId);
        const added = page ? page.elements.slice(-command.elementIds.length) : [];
        selectedIds = added.map((element) => element.id);
      } else if (command.type === 'element.delete') {
        selectedIds = pruneSelection(nextDocument, state.selectedIds);
      }

      set({
        document: nextDocument,
        past,
        future,
        selectedIds,
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
      set({
        document: previous,
        past: state.past.slice(0, -1),
        future: [state.document, ...state.future],
        selectedIds: selectionAfterHistoryStep(
          state.document,
          previous,
          state.activePageId,
          state.selectedIds,
        ),
        dirty: previous !== savedDocument,
      });
      return true;
    },

    redo: () => {
      const state = get();
      const [next, ...rest] = state.future;
      if (!next) return false;
      lastMerge = null;
      set({
        document: next,
        past: [...state.past, state.document].slice(-historyLimit),
        future: rest,
        selectedIds: selectionAfterHistoryStep(
          state.document,
          next,
          state.activePageId,
          state.selectedIds,
        ),
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
      if (!unchanged) set({ selectedIds: unique });
    },

    clearSelection: () => {
      if (get().selectedIds.length > 0) set({ selectedIds: [] });
    },

    setActivePage: (pageId) => {
      const state = get();
      if (!state.document.pages.some((page) => page.id === pageId)) {
        // Switching to a page that does not exist is a programming error, not user input.
        throw new Error(`Cannot activate unknown page "${pageId}".`);
      }
      if (pageId !== state.activePageId) set({ activePageId: pageId, selectedIds: [] });
    },

    setZoom: (zoom) => {
      const clamped = clampZoom(zoom);
      if (clamped !== get().zoom) set({ zoom: clamped });
    },

    markSaved: () => {
      savedDocument = get().document;
      set({ dirty: false });
    },

    loadDocument: (document) => {
      savedDocument = document;
      lastMerge = null;
      set({
        document,
        activePageId: firstPageId(document),
        selectedIds: [],
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
