import type { DesignDocument } from '@opencanvas/document';
import { createEditorStore } from '@opencanvas/editor-core';
import { useState, type ReactNode } from 'react';

import { createCanvasController } from './canvasController';
import { EditorContext, type EditorContextValue } from './EditorContext';
import { createNotificationStore } from './notifications';
import { createPersistence, type PersistenceController } from './persistence';

export interface EditorProviderProps {
  document: DesignDocument;
  /** Autosave bridge; omit to run the editor without persistence. */
  persistence?: PersistenceController;
  children: ReactNode;
}

export function EditorProvider({ document, persistence, children }: EditorProviderProps) {
  const [value] = useState<EditorContextValue>(() => {
    const store = createEditorStore(document);
    return {
      store,
      canvas: createCanvasController(store),
      notifications: createNotificationStore(),
      persistence: persistence ?? createPersistence(),
    };
  });
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
