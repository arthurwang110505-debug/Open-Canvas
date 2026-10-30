import type { EditorStore, EditorStoreState } from '@opencanvas/editor-core';
import { useContext } from 'react';
import { useStore } from 'zustand';

import type { CanvasController, CanvasControllerState } from './canvasController';
import { EditorContext, type EditorContextValue } from './EditorContext';

import type { NotificationState, NotificationStore } from './notifications';
import type { PersistenceController, PersistenceState } from './persistence';

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

/** Subscribes to a slice of canvas-controller state (viewport, interaction, snapping). */
export function useCanvasState<T>(selector: (state: CanvasControllerState) => T): T {
  return useStore(useEditorContext().canvas.state, selector);
}

export function useNotificationStore(): NotificationStore {
  return useEditorContext().notifications;
}

/** The host's resized-copy saver, when the editor is embedded in the project app. */
export function useCreateResizedCopy(): EditorContextValue['onCreateResizedCopy'] {
  return useEditorContext().onCreateResizedCopy;
}

export function useNotification<T>(selector: (state: NotificationState) => T): T {
  return useStore(useEditorContext().notifications, selector);
}

export function useSnappingEnabled(): boolean {
  return useStore(useEditorContext().canvas.state, (state) => state.snapping);
}

export function usePersistence(): PersistenceController {
  return useEditorContext().persistence;
}

/** Subscribes to autosave status (idle, scheduled, saving, error). */
export function usePersistenceState<T>(selector: (state: PersistenceState) => T): T {
  return useStore(useEditorContext().persistence.state, selector);
}
