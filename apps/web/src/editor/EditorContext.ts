import type { EditorStore } from '@opencanvas/editor-core';
import { createContext } from 'react';

import type { CanvasController } from './canvasController';
import type { NotificationStore } from './notifications';

export interface EditorContextValue {
  store: EditorStore;
  canvas: CanvasController;
  notifications: NotificationStore;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
