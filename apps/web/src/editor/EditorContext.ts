import type { DocumentSize, Page } from '@opencanvas/document';
import type { EditorStore } from '@opencanvas/editor-core';
import { createContext } from 'react';

import type { CanvasController } from './canvasController';
import type { NotificationStore } from './notifications';
import type { PersistenceController } from './persistence';

/** A resized copy of the current design, ready to be saved as a new project. */
export interface ResizedCopyRequest {
  name: string;
  size: DocumentSize;
  pages: readonly Page[];
}

export interface EditorContextValue {
  store: EditorStore;
  canvas: CanvasController;
  notifications: NotificationStore;
  /** Autosave bridge; disabled when the editor is used without a persistence backend. */
  persistence: PersistenceController;
  /**
   * Saves a resized copy as a new design and opens it. Provided by the project host;
   * absent when the editor runs standalone, in which case the resize dialog only
   * offers resizing the current design.
   */
  onCreateResizedCopy?: (copy: ResizedCopyRequest) => Promise<boolean>;
}

export const EditorContext = createContext<EditorContextValue | null>(null);
