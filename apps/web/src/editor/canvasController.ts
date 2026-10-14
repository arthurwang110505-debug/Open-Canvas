import type { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { nextZoomIn, nextZoomOut, type EditorStore } from '@opencanvas/editor-core';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface CanvasControllerState {
  /** True once a Fabric adapter is mounted and can be driven by the toolbar. */
  ready: boolean;
}

/**
 * Bridges UI chrome (toolbar, shortcuts) and the mounted canvas adapter. The adapter is
 * attached by `CanvasStage` when it mounts; controls check `ready` before acting.
 */
export interface CanvasController {
  state: StoreApi<CanvasControllerState>;
  attach: (adapter: FabricCanvasAdapter) => void;
  detach: (adapter: FabricCanvasAdapter) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  zoomTo: (zoom: number) => void;
  fitToScreen: () => void;
  beginTextEditing: (elementId: string) => void;
  isEditingText: () => boolean;
}

export function createCanvasController(store: EditorStore): CanvasController {
  let adapter: FabricCanvasAdapter | null = null;
  const state = createStore<CanvasControllerState>(() => ({ ready: false }));

  const withAdapter = (action: (instance: FabricCanvasAdapter) => void): void => {
    if (!adapter) {
      throw new Error('The canvas is not mounted yet; controls must be disabled until it is.');
    }
    action(adapter);
  };

  return {
    state,
    attach: (instance) => {
      adapter = instance;
      state.setState({ ready: true });
    },
    detach: (instance) => {
      if (adapter !== instance) return;
      adapter = null;
      state.setState({ ready: false });
    },
    zoomIn: () => withAdapter((a) => a.setZoom(nextZoomIn(store.getState().zoom))),
    zoomOut: () => withAdapter((a) => a.setZoom(nextZoomOut(store.getState().zoom))),
    zoomTo: (zoom) => withAdapter((a) => a.setZoom(zoom)),
    fitToScreen: () => withAdapter((a) => a.fitToViewport()),
    beginTextEditing: (elementId) => {
      // Editing can only start after React has flushed the element to the canvas.
      requestAnimationFrame(() => {
        adapter?.beginTextEditing(elementId);
      });
    },
    isEditingText: () => adapter?.isEditingText() ?? false,
  };
}
