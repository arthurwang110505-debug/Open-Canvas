import { createPathElement } from '@opencanvas/document';
import { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { selectActivePage, type EditorStoreState } from '@opencanvas/editor-core';
import { Button, cn } from '@opencanvas/ui';
import { LayoutTemplate, Square, Type } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent, type PointerEvent } from 'react';

import { useEditorActions } from './actions';
import { useAssetServices } from './assets/useAssetServices';
import { useImageImport } from './assets/useImageImport';
import { ZoomControl } from './ZoomControl';
import { useCanvasController, useEditor, useEditorStore, useNotificationStore } from './hooks';
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
  const actions = useEditorActions();
  const isEmpty = useEditor((state) => selectActivePage(state).elements.length === 0);
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
        onViewportChanged: () => controller.bumpViewport(),
        onInteractionChanged: (interacting) => controller.setInteracting(interacting),
        onTextEditingChanged: (editing) => controller.setEditingText(editing),
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
    const canvas = adapter.getFabricCanvas() as unknown as {
      selection: boolean;
      isDrawingMode: boolean;
      discardActiveObject: () => unknown;
      renderAll: () => void;
    };
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
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // The pointer may already have been released (pointercancel); nothing to undo.
      }
      const pts = pointsRef.current;
      adapterRef.current?.setPreviewPath(null, strokeColor, strokeWidth);
      pointsRef.current = [];
      if (pts.length < 2) return;
      // Create path element via factory (computes bounds + relative points)
      try {
        const element = createPathElement(pts, {
          stroke: { color: strokeColor, width: strokeWidth },
        });
        const { activePageId, dispatch } = store.getState();
        dispatch({ type: 'element.add', pageId: activePageId, element });
      } catch (err) {
        console.warn('Failed to create path', err);
      }
    },
    [drawEnabled, store, strokeColor, strokeWidth],
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
      <ZoomControl />
      {isEmpty && !drawEnabled && !dropActive ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center px-6">
          <div className="pointer-events-none flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-border/80 bg-white/95 px-6 py-5 text-center shadow-[0_12px_40px_rgba(16,24,40,0.12)] backdrop-blur">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
              <LayoutTemplate className="size-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">Start your design</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add something to the page, or drop an image anywhere.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              <Button
                size="sm"
                className="pointer-events-auto rounded-full"
                onClick={() => actions.addText('heading')}
              >
                <Type /> Add a text box
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="pointer-events-auto rounded-full"
                onClick={() => actions.addShape('rect')}
              >
                <Square /> Add a shape
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tip: press <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">R</kbd>{' '}
              for a rectangle,{' '}
              <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">T</kbd> for text.
            </p>
          </div>
        </div>
      ) : null}
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
