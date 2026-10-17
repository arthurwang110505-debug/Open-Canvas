import { createBlankDocument, createRectElement, type DesignDocument } from '@opencanvas/document';
import { createEditorStore } from '@opencanvas/editor-core';
import { describe, expect, it } from 'vitest';

import { createPersistence } from './persistence';

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeEditor() {
  const document = createBlankDocument({ id: 'doc_persist', name: 'Persisted' });
  const store = createEditorStore(document);
  return { store, pageId: document.pages[0]?.id ?? '' };
}

function addRectangle(store: ReturnType<typeof makeEditor>['store'], pageId: string) {
  store
    .getState()
    .dispatch({ type: 'element.add', pageId, element: createRectElement({ id: 'r1' }) });
}

describe('createPersistence', () => {
  it('is inert without a backend', async () => {
    const persistence = createPersistence();
    const { store } = makeEditor();
    persistence.attach(store);
    await persistence.flush();
    persistence.detach();
    persistence.dispose();
    const state = persistence.state.getState();
    expect(state.status).toBe('disabled');
    expect(state.lastSavedAt).toBeNull();
    expect(state.errorMessage).toBeNull();
    expect(typeof state.saveNow).toBe('function');
    await expect(persistence.state.getState().saveNow()).resolves.toBeUndefined();
  });

  it('writes a changed document after the quiet period and clears the dirty flag', async () => {
    const saved: DesignDocument[] = [];
    const persistence = createPersistence({
      save: (document) => {
        saved.push(document);
        return Promise.resolve();
      },
      delayMs: 20,
    });
    const { store, pageId } = makeEditor();
    persistence.attach(store);

    addRectangle(store, pageId);
    expect(store.getState().dirty).toBe(true);
    expect(persistence.state.getState().status).toBe('scheduled');

    await wait(60);
    expect(saved).toHaveLength(1);
    expect(saved[0]?.pages[0]?.elements).toHaveLength(1);
    expect(store.getState().dirty).toBe(false);
    expect(persistence.state.getState().status).toBe('idle');
    expect(persistence.state.getState().lastSavedAt).not.toBeNull();
    persistence.dispose();
  });

  it('saves only the snapshot that was written when an edit lands mid-write', async () => {
    const saved: DesignDocument[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const persistence = createPersistence({
      save: async (document) => {
        saved.push(document);
        if (saved.length === 1) await gate;
      },
      delayMs: 10,
    });
    const { store, pageId } = makeEditor();
    persistence.attach(store);

    addRectangle(store, pageId);
    await wait(30);
    expect(persistence.state.getState().status).toBe('saving');

    // The user keeps editing while the first write is in flight.
    store.getState().dispatch({ type: 'element.update', pageId, elementId: 'r1', patch: { x: 9 } });
    expect(store.getState().dirty).toBe(true);

    release();
    await wait(60);
    expect(saved).toHaveLength(2);
    expect(saved[1]?.pages[0]?.elements[0]?.x).toBe(9);
    expect(store.getState().dirty).toBe(false);
    expect(persistence.state.getState().status).toBe('idle');
    persistence.dispose();
  });

  it('reports a failing write and recovers with saveNow', async () => {
    let fail = true;
    const persistence = createPersistence({
      save: () =>
        fail
          ? Promise.reject(new Error('The browser ran out of local storage space.'))
          : Promise.resolve(),
      delayMs: 10,
    });
    const { store, pageId } = makeEditor();
    persistence.attach(store);

    addRectangle(store, pageId);
    await wait(40);
    expect(persistence.state.getState().status).toBe('error');
    expect(persistence.state.getState().errorMessage).toBe(
      'The browser ran out of local storage space.',
    );
    expect(store.getState().dirty).toBe(true);

    fail = false;
    await persistence.state.getState().saveNow();
    expect(persistence.state.getState().status).toBe('idle');
    expect(persistence.state.getState().errorMessage).toBeNull();
    expect(store.getState().dirty).toBe(false);
    persistence.dispose();
  });

  it('still writes pending changes after detach (leaving the editor)', async () => {
    const saved: DesignDocument[] = [];
    const persistence = createPersistence({
      save: (document) => {
        saved.push(document);
        return Promise.resolve();
      },
      delayMs: 500,
    });
    const { store, pageId } = makeEditor();
    persistence.attach(store);
    addRectangle(store, pageId);

    persistence.detach();
    await persistence.flush();
    expect(saved).toHaveLength(1);
    expect(store.getState().dirty).toBe(false);
    persistence.dispose();
  });
});
