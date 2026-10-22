import type { CropLayout, FabricCanvasAdapter, ViewportRect } from '@opencanvas/canvas-fabric';
import { nextZoomIn, nextZoomOut, type EditorStore } from '@opencanvas/editor-core';
import { createStore, type StoreApi } from 'zustand/vanilla';

export interface CanvasControllerState {
  /** True once a Fabric adapter is mounted and can be driven by the toolbar. */
  ready: boolean;
  /** Alignment guides and snapping while dragging; applied to every mounted adapter. */
  snapping: boolean;
  /** Increments whenever the viewport pans, zooms or fits; anchors floating UI. */
  viewportRevision: number;
  /** True between pointer down and pointer up on the canvas. */
  interacting: boolean;
  /** True while inline text editing is active. */
  editingText: boolean;
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
  setSnapping: (enabled: boolean) => void;
  /** Page coordinates under a viewport point, or `null` while the canvas is not mounted. */
  clientToPage: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Viewport coordinates of a page point, or `null` while the canvas is not mounted. */
  pageToClient: (x: number, y: number) => { x: number; y: number } | null;
  /** Shows a photo uncropped for on-canvas cropping; see `CropOverlay`. */
  beginCropEdit: (elementId: string) => boolean;
  /** Live crop geometry while the overlay is dragged; nothing is committed. */
  previewCrop: (layout: CropLayout) => void;
  endCropEdit: () => void;
  /** Client-space rectangle of the current selection, or `null` when nothing is selected. */
  getSelectionClientRect: () => ViewportRect | null;
  /** Called by the adapter when the viewport changes; refreshes floating UI. */
  bumpViewport: () => void;
  /** Called by the adapter on pointer down/up. */
  setInteracting: (interacting: boolean) => void;
  /** Called by the adapter when inline text editing starts or ends. */
  setEditingText: (editing: boolean) => void;
}

export function createCanvasController(store: EditorStore): CanvasController {
  let adapter: FabricCanvasAdapter | null = null;
  const state = createStore<CanvasControllerState>(() => ({
    ready: false,
    snapping: true,
    viewportRevision: 0,
    interacting: false,
    editingText: false,
  }));

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
      instance.setSnapping(state.getState().snapping);
      state.setState({ ready: true, viewportRevision: state.getState().viewportRevision + 1 });
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
    setSnapping: (enabled) => {
      state.setState({ snapping: enabled });
      adapter?.setSnapping(enabled);
    },
    clientToPage: (clientX, clientY) => adapter?.clientToPage(clientX, clientY) ?? null,
    pageToClient: (x, y) => adapter?.pageToClient(x, y) ?? null,
    beginCropEdit: (elementId) => adapter?.beginCropEdit(elementId) ?? false,
    previewCrop: (layout) => adapter?.previewCrop(layout),
    endCropEdit: () => adapter?.endCropEdit(),
    getSelectionClientRect: () => adapter?.getSelectionClientRect() ?? null,
    bumpViewport: () => state.setState({ viewportRevision: state.getState().viewportRevision + 1 }),
    setInteracting: (interacting) => {
      if (state.getState().interacting !== interacting) state.setState({ interacting });
    },
    setEditingText: (editingText) => {
      if (state.getState().editingText !== editingText) state.setState({ editingText });
    },
  };
}
