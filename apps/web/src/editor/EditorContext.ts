import type { EditorStore } from '@opencanvas/editor-core';
import { createContext } from 'react';

import type { CanvasController } from './canvasController';
import type { NotificationStore } from './notifications';
import type { PersistenceController } from './persistence';

export interface EditorContextValue {
  store: EditorStore;
  canvas: CanvasController;
  notifications: NotificationStore;
  /** Autosave bridge; disabled when the editor is used without a persistence backend. */
  persistence: PersistenceController;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
