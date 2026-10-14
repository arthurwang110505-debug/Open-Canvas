import type { EditorStore, EditorStoreState } from '@opencanvas/editor-core';
import { useContext } from 'react';
import { useStore } from 'zustand';

import type { CanvasController } from './canvasController';
import { EditorContext, type EditorContextValue } from './EditorContext';
import type { NotificationState, NotificationStore } from './notifications';

function useEditorContext(): EditorContextValue {
  const context = useContext(EditorContext);
  if (!context) throw new Error('Editor hooks must be used inside <EditorProvider>.');
  return context;
}

export function useEditorStore(): EditorStore {
  return useEditorContext().store;
}

/** Subscribes to a slice of editor state. */
export function useEditor<T>(selector: (state: EditorStoreState) => T): T {
  return useStore(useEditorContext().store, selector);
}

export function useCanvasController(): CanvasController {
  return useEditorContext().canvas;
}

export function useCanvasReady(): boolean {
  return useStore(useEditorContext().canvas.state, (state) => state.ready);
}

export function useNotificationStore(): NotificationStore {
  return useEditorContext().notifications;
}

export function useNotification<T>(selector: (state: NotificationState) => T): T {
  return useStore(useEditorContext().notifications, selector);
}

export function useSnappingEnabled(): boolean {
  return useStore(useEditorContext().canvas.state, (state) => state.snapping);
}
