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
  /** Saves a resized copy as a new design; omit when the host has no project store. */
  onCreateResizedCopy?: EditorContextValue['onCreateResizedCopy'];
  children: ReactNode;
}

export function EditorProvider({
  document,
  persistence,
  onCreateResizedCopy,
  children,
}: EditorProviderProps) {
  const [value] = useState<EditorContextValue>(() => {
    const store = createEditorStore(document);
    return {
      store,
      canvas: createCanvasController(store),
      notifications: createNotificationStore(),
      persistence: persistence ?? createPersistence(),
      ...(onCreateResizedCopy ? { onCreateResizedCopy } : {}),
    };
  });
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
