import { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { selectActivePage, type EditorStoreState } from '@opencanvas/editor-core';
import { useEffect, useRef } from 'react';

import { useCanvasController, useEditorStore } from './hooks';

function sceneChanged(next: EditorStoreState, previous: EditorStoreState): boolean {
  return (
    next.document !== previous.document ||
    next.selectedIds !== previous.selectedIds ||
    next.activePageId !== previous.activePageId
  );
}

/**
 * Hosts the Fabric canvas. State flows one way: store -> adapter.render(); user interactions
 * come back as commands through the adapter callbacks, never as direct state writes.
 */
export function CanvasStage() {
  const store = useEditorStore();
  const controller = useCanvasController();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvasElement = canvasRef.current;
    if (!container || !canvasElement) return;

    const adapter = new FabricCanvasAdapter(canvasElement, {
      onElementsModified: (changes) => {
        const { activePageId, dispatch } = store.getState();
        dispatch({
          type: 'element.updateMany',
          pageId: activePageId,
          updates: changes.map((change) => ({ elementId: change.elementId, patch: change.patch })),
        });
      },
      onTextCommitted: (elementId, text, height) => {
        const { activePageId, dispatch } = store.getState();
        dispatch({
          type: 'element.update',
          pageId: activePageId,
          elementId,
          patch: { text, height },
        });
      },
      onTextMeasured: (elementId, height) => {
        const { activePageId, dispatch } = store.getState();
        dispatch(
          { type: 'element.update', pageId: activePageId, elementId, patch: { height } },
          { recordHistory: false },
        );
      },
      onSelectionChanged: (ids) => store.getState().setSelection(ids),
      onZoomChanged: (zoom) => store.getState().setZoom(zoom),
    });

    const renderScene = () => {
      const state = store.getState();
      adapter.render({
        page: selectActivePage(state),
        size: state.document.size,
        selectedIds: state.selectedIds,
      });
    };

    const resize = () => {
      const { width, height } = container.getBoundingClientRect();
      adapter.setViewportSize(width, height);
    };

    resize();
    renderScene();
    adapter.fitToViewport();
    controller.attach(adapter);

    const unsubscribe = store.subscribe((state, previous) => {
      if (sceneChanged(state, previous)) renderScene();
    });

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);

    // Text metrics depend on web fonts; re-measure once they are available.
    let fontsCancelled = false;
    if (typeof document.fonts !== 'undefined') {
      document.fonts.ready
        .then(() => {
          if (!fontsCancelled) adapter.invalidateTextLayout();
        })
        .catch((error: unknown) => {
          console.warn('Web fonts failed to load; text metrics may be approximate.', error);
        });
    }

    return () => {
      fontsCancelled = true;
      observer.disconnect();
      unsubscribe();
      controller.detach(adapter);
      adapter.dispose();
    };
  }, [store, controller]);

  return (
    <div
      ref={containerRef}
      data-testid="canvas-stage"
      className="relative h-full w-full overflow-hidden bg-workspace"
    >
      <canvas ref={canvasRef} aria-label="Design canvas" />
    </div>
  );
}
