import { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { selectActivePage, type EditorStoreState } from '@opencanvas/editor-core';
import { cn } from '@opencanvas/ui';
import { useEffect, useRef, useState, type DragEvent } from 'react';

import { useAssetServices } from './assets/useAssetServices';
import { useImageImport } from './assets/useImageImport';
import { useCanvasController, useEditorStore, useNotificationStore } from './hooks';

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
  const notifications = useNotificationStore();
  const assetServices = useAssetServices();
  const { importFiles } = useImageImport();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dropActive, setDropActive] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvasElement = canvasRef.current;
    if (!container || !canvasElement) return;

    const adapter = new FabricCanvasAdapter(
      canvasElement,
      {
        onElementsModified: (changes) => {
          const { activePageId, dispatch } = store.getState();
          dispatch({
            type: 'element.updateMany',
            pageId: activePageId,
            updates: changes.map((change) => ({
              elementId: change.elementId,
              patch: change.patch,
            })),
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
        onAssetError: (elementId, assetId, error) => {
          const asset = store.getState().document.assets[assetId];
          notifications.getState().show({
            kind: 'error',
            title: `Image "${asset?.name ?? elementId}" could not be displayed`,
            message: error.message,
          });
        },
      },
      {
        resolveAssetUrl: assetServices.resolveAssetUrl,
        ...(assetServices.loadImage ? { loadImage: assetServices.loadImage } : {}),
      },
    );

    const renderScene = () => {
      const state = store.getState();
      adapter.render({
        page: selectActivePage(state),
        size: state.document.size,
        selectedIds: state.selectedIds,
        assets: state.document.assets,
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
  }, [store, controller, notifications, assetServices]);

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDropActive(false);
    const at =
      Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
        ? controller.clientToPage(event.clientX, event.clientY)
        : null;
    void importFiles(Array.from(event.dataTransfer.files), at ? { at } : undefined);
  };

  return (
    <div
      ref={containerRef}
      data-testid="canvas-stage"
      className={cn(
        'relative h-full w-full overflow-hidden bg-workspace',
        dropActive && 'ring-2 ring-ring ring-inset',
      )}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        setDropActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropActive(false);
      }}
      onDrop={onDrop}
    >
      <canvas ref={canvasRef} aria-label="Design canvas" />
      {dropActive && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid place-items-center bg-background/40 text-sm font-medium"
        >
          Drop images to add them to the page
        </div>
      )}
    </div>
  );
}
