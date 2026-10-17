import type { DesignDocument } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { useEffect, useState } from 'react';

import { EditorPage } from '../editor/EditorPage';
import { createPersistence, type PersistenceController } from '../editor/persistence';
import { navigate } from '../router';
import { useProjects } from './useProjects';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; document: DesignDocument }
  | { status: 'error'; message: string };

export interface ProjectEditorProps {
  projectId: string;
}

/**
 * Loads a saved design and mounts the editor on it. Autosave is wired here because this is
 * where the project store and the document id are known; the editor itself stays
 * storage-agnostic (it only sees a `save(document)` callback).
 */
export function ProjectEditor({ projectId }: ProjectEditorProps) {
  const { store } = useProjects();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const [persistence] = useState<PersistenceController>(() =>
    createPersistence({
      save: async (document) => {
        const saved = await store.save(document);
        if (!saved.ok) throw new Error(saved.error.message);
      },
    }),
  );

  useEffect(() => {
    let cancelled = false;
    void store.load(projectId).then((loaded) => {
      if (cancelled) return;
      if (loaded.ok) setState({ status: 'ready', document: loaded.value });
      else setState({ status: 'error', message: loaded.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [store, projectId, attempt]);

  // Persist pending changes when the tab is hidden/closed and when leaving the editor.
  useEffect(() => {
    const flush = () => {
      void persistence.flush();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      flush();
    };
  }, [persistence]);

  const reload = () => {
    setState({ status: 'loading' });
    setAttempt((current) => current + 1);
  };

  if (state.status === 'loading') {
    return (
      <div className="grid h-full place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Opening design…</p>
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="grid h-full place-items-center overflow-y-auto bg-background p-6">
        <div className="max-w-md space-y-3 rounded-lg border border-border bg-panel p-6 text-center">
          <h1 className="font-semibold">This design could not be opened</h1>
          <p role="alert" className="text-sm text-muted-foreground">
            {state.message}
          </p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ name: 'dashboard' })}>
              Back to designs
            </Button>
            <Button variant="secondary" size="sm" onClick={reload}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <EditorPage
      document={state.document}
      persistence={persistence}
      assetServices={{ blobStore: store.assetBlobStore(projectId) }}
    />
  );
}
