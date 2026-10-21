import { createPathElement } from '@opencanvas/document';
import { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { selectActivePage, type EditorStoreState } from '@opencanvas/editor-core';
import { cn } from '@opencanvas/ui';
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';

import { useAssetServices } from './assets/useAssetServices';
import { useImageImport } from './assets/useImageImport';
import { useCanvasController, useEditorStore, useNotificationStore } from './hooks';
import { useDraw } from './draw/DrawContext';

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
  const { enabled: drawEnabled, strokeColor, strokeWidth } = useDraw();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricCanvasAdapter | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);

  // Fabric adapter lifecycle
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

    adapterRef.current = adapter;

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
      adapterRef.current = null;
    };
  }, [store, controller, notifications, assetServices]);

  // Disable Fabric selection while drawing (so drag doesn't move objects)
  useEffect(() => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const canvas = adapter.getFabricCanvas() as unknown as { selection: boolean; isDrawingMode: boolean; discardActiveObject: () => unknown; renderAll: () => void };
    canvas.selection = !drawEnabled;
    canvas.isDrawingMode = false;
    if (drawEnabled) {
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  }, [drawEnabled]);

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

  // Drawing handlers — page-coords via controller.clientToPage, preview via adapter
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!drawEnabled) return;
      // Only left button
      if (e.button !== 0) return;
      e.preventDefault();
      // Capture pointer to container
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      const pt = controller.clientToPage(e.clientX, e.clientY);
      if (!pt) return;
      pointsRef.current = [pt];
      isDrawingRef.current = true;
      adapterRef.current?.setPreviewPath(pointsRef.current, strokeColor, strokeWidth);
    },
    [drawEnabled, controller, strokeColor, strokeWidth],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!drawEnabled || !isDrawingRef.current) return;
      const pt = controller.clientToPage(e.clientX, e.clientY);
      if (!pt) return;
      const pts = pointsRef.current;
      const last = pts[pts.length - 1];
      if (last && Math.hypot(pt.x - last.x, pt.y - last.y) < 2) return; // throttle
      pts.push(pt);
      adapterRef.current?.setPreviewPath(pts, strokeColor, strokeWidth);
    },
    [drawEnabled, controller, strokeColor, strokeWidth],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!drawEnabled || !isDrawingRef.current) return;
      isDrawingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      const pts = pointsRef.current;
      adapterRef.current?.setPreviewPath(null, strokeColor, strokeWidth);
      pointsRef.current = [];
      if (pts.length < 2) return;
      // Create path element via factory (computes bounds + relative points)
      try {
        const element = createPathElement(pts, { stroke: { color: strokeColor, width: strokeWidth } });
        const { activePageId, dispatch } = store.getState();
        dispatch({ type: 'element.add', pageId: activePageId, element });
      } catch (err) {
        console.warn('Failed to create path', err);
      }
    },
    [drawEnabled, controller, store, strokeColor, strokeWidth],
  );

  const handlePointerLeave = useCallback(() => {
    // Don't finish on leave — wait for up
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="canvas-stage"
      className={cn(
        'relative h-full w-full overflow-hidden bg-workspace',
        dropActive && 'ring-2 ring-ring ring-inset',
        drawEnabled && 'cursor-crosshair',
      )}
      style={
        {
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0)',
          backgroundSize: '20px 20px',
        } as React.CSSProperties
      }
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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} aria-label="Design canvas" />
      {drawEnabled && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background shadow">
          Drawing — drag on canvas. Press D or click Draw to exit.
        </div>
      )}
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
