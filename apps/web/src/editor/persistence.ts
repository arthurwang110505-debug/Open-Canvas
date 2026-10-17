import type { DesignDocument } from '@opencanvas/document';
import type { EditorStore } from '@opencanvas/editor-core';
import { Autosaver, DEFAULT_AUTOSAVE_DELAY_MS } from '@opencanvas/storage';
import { createStore, type StoreApi } from 'zustand/vanilla';

export type SaveStatus = 'disabled' | 'idle' | 'scheduled' | 'saving' | 'error';

export interface PersistenceState {
  /** `disabled` when the editor runs without a persistence backend (tests, demo). */
  status: SaveStatus;
  lastSavedAt: string | null;
  errorMessage: string | null;
  /** Writes the current document immediately (toolbar button, Ctrl/⌘ S). */
  saveNow: () => Promise<void>;
}

export interface PersistenceController {
  state: StoreApi<PersistenceState>;
  /** Starts watching an editor store: every change schedules a debounced write. */
  attach: (editor: EditorStore) => void;
  /**
   * Stops watching (the editor unmounted). The last attached store is kept so a final
   * `flush()` can still persist pending changes; `dispose()` releases it.
   */
  detach: () => void;
  /** Writes a scheduled change now and waits for in-flight writes. */
  flush: () => Promise<void>;
  dispose: () => void;
}

export interface PersistenceOptions {
  /** Persists a document snapshot; must reject (or throw) when the write failed. */
  save: (document: DesignDocument) => Promise<void>;
  delayMs?: number;
  now?: () => Date;
}

/**
 * Bridges the editor store and a project store. The autosave rules live in
 * `@opencanvas/storage`; this controller owns the editor-specific parts: which snapshot is
 * written, marking it saved only after the write succeeded, and reporting status.
 */
export function createPersistence(options?: PersistenceOptions): PersistenceController {
  if (!options) {
    const state = createStore<PersistenceState>(() => ({
      status: 'disabled',
      lastSavedAt: null,
      errorMessage: null,
      saveNow: () => Promise.resolve(),
    }));
    const noop = () => {
      // No backend: nothing to attach, detach or dispose.
    };
    return { state, attach: noop, detach: noop, flush: () => Promise.resolve(), dispose: noop };
  }

  const now = options.now ?? (() => new Date());
  let editor: EditorStore | null = null;
  let unsubscribe: (() => void) | null = null;
  // Assigned while the store is created (synchronously) so the autosaver callbacks below can
  // publish status changes without a circular initialization.
  let publish: (partial: Partial<PersistenceState>) => void = () => {
    // Replaced synchronously by the store initializer below, before any save can run.
  };

  const autosaver = new Autosaver({
    delayMs: options.delayMs ?? DEFAULT_AUTOSAVE_DELAY_MS,
    save: async () => {
      const store = editor;
      if (!store) throw new Error('Autosave ran before the editor was attached.');
      // Capture the snapshot first: edits made while the write is in flight keep the store
      // dirty, so `markSaved(snapshot)` cannot claim more was persisted than actually was.
      const snapshot = store.getState().document;
      await options.save(snapshot);
      store.getState().markSaved(snapshot);
      publish({ lastSavedAt: now().toISOString(), errorMessage: null });
    },
    onError: (error) => {
      publish({ errorMessage: error instanceof Error ? error.message : String(error) });
    },
    onStatusChange: (status) => publish({ status }),
  });

  const state = createStore<PersistenceState>((set) => {
    publish = (partial) => set(partial);
    return {
      status: 'idle',
      lastSavedAt: null,
      errorMessage: null,
      saveNow: () => autosaver.saveNow(),
    };
  });

  return {
    state,
    attach(store) {
      editor = store;
      unsubscribe?.();
      unsubscribe = store.subscribe((current, previous) => {
        if (current.dirty && current.document !== previous.document) autosaver.schedule();
      });
      // A document that is already dirty when the editor mounts (restored session) is saved too.
      if (store.getState().dirty) autosaver.schedule();
    },
    detach() {
      unsubscribe?.();
      unsubscribe = null;
    },
    flush: () => autosaver.flush(),
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
      editor = null;
      autosaver.dispose();
    },
  };
}
