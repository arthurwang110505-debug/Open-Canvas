import type { EditorStore } from '@opencanvas/editor-core';
import { createContext } from 'react';

import type { CanvasController } from './canvasController';

export interface EditorContextValue {
  store: EditorStore;
  canvas: CanvasController;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
