import { createPathElement, type DesignElement } from '@opencanvas/document';
import { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';
import { selectActivePage, type EditorStoreState } from '@opencanvas/editor-core';
import { Button, cn } from '@opencanvas/ui';
import { LayoutTemplate, Square, Type } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';

import { useEditorActions } from './actions';
import { CanvasContextMenu, type ContextMenuPosition } from './CanvasContextMenu';
import { useAssetServices } from './assets/useAssetServices';
import { useImageImport } from './assets/useImageImport';
import { hasElementDrag, readElementDragPayload } from './elements/drag';
import { CropOverlay } from './canvas/CropOverlay';
import { Rulers } from './canvas/Rulers';
import { useCanvasController, useEditor, useEditorStore, useNotificationStore } from './hooks';
import { useDraw } from './draw/DrawContext';

/** What a dropped photo replaces: a frame it fills or an image it swaps. */
interface DropTarget {
  kind: 'frame' | 'image';
  id: string;
}

interface CanvasStageProps {
  onOpenPageSettings: () => void;
  onOpenProperties: () => void;
}

function elementAtPoint(
  elements: readonly DesignElement[],
  point: { x: number; y: number },
): DesignElement | undefined {
  for (let index = elements.length - 1; index >= 0; index -= 1) {
    const element = elements[index];
    if (!element?.visible) continue;
    const angle = (-element.rotation * Math.PI) / 180;
    const centreX = element.x + element.width / 2;
    const centreY = element.y + element.height / 2;
    const dx = point.x - centreX;
    const dy = point.y - centreY;
    const localX = centreX + dx * Math.cos(angle) - dy * Math.sin(angle);
    const localY = centreY + dx * Math.sin(angle) + dy * Math.cos(angle);
    if (
      localX >= element.x &&
      localX <= element.x + element.width &&
      localY >= element.y &&
      localY <= element.y + element.height
    ) {
      return element;
    }
  }
  return undefined;
}

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
export function CanvasStage({ onOpenPageSettings, onOpenProperties }: CanvasStageProps) {
  const store = useEditorStore();
  const controller = useCanvasController();
  const notifications = useNotificationStore();
  const assetServices = useAssetServices();
  const { importFiles, insertPhoto } = useImageImport();
  const { enabled: drawEnabled, strokeColor, strokeWidth } = useDraw();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const adapterRef = useRef<FabricCanvasAdapter | null>(null);
  const [dropActive, setDropActive] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  // Screen-space preview of what a dragged element will become, while it hovers the canvas.
  const [ghost, setGhost] = useState<{ x: number; y: number; size: number } | null>(null);
  const zoom = useEditor((state) => state.zoom);
  const actions = useEditorActions();
  const isEmpty = useEditor((state) => selectActivePage(state).elements.length === 0);
  const isDrawingRef = useRef(false);
  const pointsRef = useRef<{ x: number; y: number }[]>([]);
  const altDragSequence = useRef(0);
  const altDragMergeKey = useRef<string | null>(null);

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
          const mergeKey = altDragMergeKey.current;
          altDragMergeKey.current = null;
          dispatch(
            {
              type: 'element.updateMany',
              pageId: activePageId,
              updates: changes.map((change) => ({
                elementId: change.elementId,
                patch: change.patch,
              })),
            },
            mergeKey ? { mergeKey, mergeWindowMs: Number.POSITIVE_INFINITY } : undefined,
          );
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
        onDuplicateRequested: (ids) => {
          const { activePageId, dispatch } = store.getState();
          const mergeKey = `alt-drag:${++altDragSequence.current}`;
          const outcome = dispatch(
            { type: 'element.duplicate', pageId: activePageId, elementIds: ids, offset: 0 },
            { mergeKey },
          );
          if (outcome.ok) altDragMergeKey.current = mergeKey;
          return outcome.ok;
        },
        onPhotoPanChanged: (elementId) => store.getState().setPhotoPan(elementId),
        onCropRequested: (elementId) => store.getState().beginCrop(elementId),
        onPhotoPanned: (elementId, crop) => {
          const { activePageId, dispatch } = store.getState();
          dispatch({ type: 'element.update', pageId: activePageId, elementId, patch: { crop } });
        },
        onZoomChanged: (zoom) => store.getState().setZoom(zoom),
        onViewportChanged: () => controller.bumpViewport(),
        onInteractionChanged: (interacting) => {
          if (!interacting) altDragMergeKey.current = null;
          controller.setInteracting(interacting);
        },
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

    adapter.setPhotoPanTarget(store.getState().photoPanId);
    const openCropId = store.getState().cropId;
    if (openCropId) adapter.beginCropEdit(openCropId);

    const unsubscribe = store.subscribe((state, previous) => {
      if (sceneChanged(state, previous)) renderScene();
      // Adjust-photo mode lives in the store (the properties panel toggles it too), so the
      // canvas follows it rather than owning it.
      if (state.photoPanId !== previous.photoPanId) adapter.setPhotoPanTarget(state.photoPanId);
      // Crop mode shows the photo uncropped on the canvas; the DOM overlay draws the box.
      if (state.cropId !== previous.cropId) {
        if (state.cropId) adapter.beginCropEdit(state.cropId);
        else adapter.endCropEdit();
      }
      if (state.cropId !== null && state.cropDraft !== previous.cropDraft && state.cropDraft) {
        adapter.previewCrop(state.cropDraft);
      }
    });

    const observer = new ResizeObserver(() => {
      resize();
    });
    observer.observe(container);

    let fontsCancelled = false;
    // `fonts.ready` resolves once at startup; a family picked later (see the font menu) arrives
    // afterwards, and `loadingdone` is what tells the canvas to re-measure with the real metrics.
    const remeasureText = () => {
      if (!fontsCancelled) adapter.invalidateTextLayout();
    };
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (fonts) {
      fonts.ready.catch((error: unknown) => {
        console.warn('Web fonts failed to load; text metrics may be approximate.', error);
      });
      fonts.addEventListener('loadingdone', remeasureText);
      void fonts.ready.then(remeasureText);
    }

    return () => {
      fontsCancelled = true;
      fonts?.removeEventListener('loadingdone', remeasureText);
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

  // A cancelled drag never reaches this element's `onDrop`, so clear the preview whenever the
  // gesture ends anywhere on the page.
  useEffect(() => {
    const clear = () => {
      setGhost(null);
      setDropActive(false);
    };
    window.addEventListener('dragend', clear);
    return () => window.removeEventListener('dragend', clear);
  }, []);

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes('Files');

  const pagePoint = (event: DragEvent<HTMLDivElement>) =>
    Number.isFinite(event.clientX) && Number.isFinite(event.clientY)
      ? controller.clientToPage(event.clientX, event.clientY)
      : null;

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (drawEnabled || store.getState().cropId) return;

      const state = store.getState();
      const page = selectActivePage(state);
      const point = controller.clientToPage(event.clientX, event.clientY);
      const target = point ? elementAtPoint(page.elements, point) : undefined;
      if (target) {
        if (!state.selectedIds.includes(target.id)) state.setSelection([target.id]);
      } else {
        state.setSelection([]);
      }

      const rect = event.currentTarget.getBoundingClientRect();
      setContextMenu({
        x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 232)),
        y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 560)),
      });
    },
    [controller, drawEnabled, store],
  );

  /**
   * What a dropped photo lands on: the top-most unlocked frame or image whose box contains the
   * point. A photo dropped on a frame fills it and one dropped on an image swaps it, so the drop
   * never stacks a second picture on top of the first.
   */
  const dropTargetAt = (point: { x: number; y: number } | null): DropTarget | null => {
    if (!point) return null;
    const state = store.getState();
    const page = state.document.pages.find((candidate) => candidate.id === state.activePageId);
    if (!page) return null;
    // The canvas is the page: a drop that lands slightly outside still belongs to the design.
    const { width, height } = state.document.size;
    const x = Math.min(Math.max(point.x, 0), width);
    const y = Math.min(Math.max(point.y, 0), height);
    for (let index = page.elements.length - 1; index >= 0; index -= 1) {
      const element = page.elements[index];
      if (
        (element?.type === 'frame' || element?.type === 'image') &&
        element.visible &&
        !element.locked &&
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y &&
        y <= element.y + element.height
      ) {
        return { kind: element.type, id: element.id };
      }
    }
    return null;
  };

  /** Insert options that swap or fill the target instead of adding an element. */
  const targetOptions = (target: DropTarget | null, at: { x: number; y: number } | undefined) =>
    target?.kind === 'frame'
      ? { frameId: target.id }
      : target?.kind === 'image'
        ? { replaceId: target.id }
        : at
          ? { at }
          : undefined;

  /** The element's eventual page size in screen pixels, or `null` for an unknown drag. */
  const ghostSize = (event: DragEvent<HTMLDivElement>): number | null => {
    const payload = readElementDragPayload(event.dataTransfer);
    if (!payload) return null;
    const { size } = store.getState().document;
    const fraction =
      payload.kind === 'icon'
        ? 0.2
        : payload.kind === 'photo'
          ? 0.45
          : payload.kind === 'frame'
            ? 0.4
            : 0.3;
    return Math.round(Math.min(size.width, size.height) * fraction * zoom);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (hasElementDrag(event.dataTransfer)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      const payload = readElementDragPayload(event.dataTransfer);
      // Over a frame or an image the drop replaces a picture instead of adding one, so a
      // "new element" preview would be a lie.
      if (payload?.kind === 'photo' && dropTargetAt(pagePoint(event))) {
        setGhost(null);
        return;
      }
      const size = ghostSize(event);
      const container = containerRef.current;
      if (size && container) {
        const rect = container.getBoundingClientRect();
        setGhost({
          x: event.clientX - rect.left - size / 2,
          y: event.clientY - rect.top - size / 2,
          size,
        });
      }
      return;
    }
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setDropActive(true);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    const payload = readElementDragPayload(event.dataTransfer);
    if (payload) {
      event.preventDefault();
      setGhost(null);
      const at = pagePoint(event) ?? undefined;
      if (payload.kind === 'icon') actions.addIcon(payload.iconId, at);
      else if (payload.kind === 'photo') {
        // A photo dropped on a frame fills it and one dropped on an image swaps it; anywhere
        // else it becomes a new image element.
        insertPhoto(payload.photoId, targetOptions(dropTargetAt(pagePoint(event)), at));
      } else if (payload.kind === 'frame') actions.addFrame(payload.frame, at);
      else actions.addShape(payload.shape, at);
      return;
    }
    if (!hasFiles(event)) return;
    event.preventDefault();
    setDropActive(false);
    const point = pagePoint(event);
    void importFiles(
      Array.from(event.dataTransfer.files),
      targetOptions(dropTargetAt(point), point ?? undefined),
    );
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
      onContextMenu={handleContextMenu}
      onDragOver={onDragOver}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropActive(false);
        setGhost(null);
      }}
      onDrop={onDrop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerUp}
    >
      <canvas ref={canvasRef} aria-label="Design canvas" />
      <CropOverlay />
      <Rulers />
      {contextMenu ? (
        <CanvasContextMenu
          position={contextMenu}
          onClose={closeContextMenu}
          onOpenPageSettings={onOpenPageSettings}
          onOpenProperties={onOpenProperties}
        />
      ) : null}
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
      {ghost && (
        <div
          aria-hidden="true"
          data-testid="element-drop-ghost"
          className="pointer-events-none absolute z-10 rounded-md border-2 border-dashed border-primary/70 bg-primary/10"
          style={{ left: ghost.x, top: ghost.y, width: ghost.size, height: ghost.size }}
        />
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
