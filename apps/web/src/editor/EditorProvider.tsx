import type { DesignDocument } from '@opencanvas/document';
import { createEditorStore } from '@opencanvas/editor-core';
import { useState, type ReactNode } from 'react';

import { createCanvasController } from './canvasController';
import { EditorContext, type EditorContextValue } from './EditorContext';
import { createNotificationStore } from './notifications';

export interface EditorProviderProps {
  document: DesignDocument;
  children: ReactNode;
}

export function EditorProvider({ document, children }: EditorProviderProps) {
  const [value] = useState<EditorContextValue>(() => {
    const store = createEditorStore(document);
    return {
      store,
      canvas: createCanvasController(store),
      notifications: createNotificationStore(),
    };
  });
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}
