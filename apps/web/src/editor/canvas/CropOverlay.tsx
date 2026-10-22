import { cropAspect, panCrop, resizeCrop, type CropBox } from '@opencanvas/canvas-fabric';
import type { ImageAsset, ImageCrop, ImageElement } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { useCallback, useLayoutEffect, useRef, useState, type PointerEvent } from 'react';

import { useCanvasController, useCanvasState, useEditor, useEditorStore } from '../hooks';

/** Width / height of the aspect presets offered while cropping. */
const ASPECTS = [
  { id: 'free', label: 'Free', ratio: null },
  { id: 'square', label: '1:1', ratio: 1 },
  { id: 'portrait', label: '4:5', ratio: 4 / 5 },
  { id: 'wide', label: '16:9', ratio: 16 / 9 },
] as const;

type HandleSide = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

const HANDLES: readonly { handle: HandleSide; className: string; cursor: string }[] = [
  {
    handle: 'nw',
    className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2',
    cursor: 'nwse-resize',
  },
  {
    handle: 'n',
    className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2',
    cursor: 'ns-resize',
  },
  {
    handle: 'ne',
    className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2',
    cursor: 'nesw-resize',
  },
  {
    handle: 'e',
    className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2',
    cursor: 'ew-resize',
  },
  {
    handle: 'se',
    className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2',
    cursor: 'nwse-resize',
  },
  {
    handle: 's',
    className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2',
    cursor: 'ns-resize',
  },
  {
    handle: 'sw',
    className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2',
    cursor: 'nesw-resize',
  },
  {
    handle: 'w',
    className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
    cursor: 'ew-resize',
  },
];

/** Screen-space delta turned into the (possibly rotated) element's own axes. */
function toLocal(delta: { x: number; y: number }, degrees: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return { x: delta.x * cos + delta.y * sin, y: -delta.x * sin + delta.y * cos };
}

interface DragState {
  /** `move` pans the photo; a handle resizes the crop box. */
  mode: 'move' | HandleSide;
  clientX: number;
  clientY: number;
  box: CropBox;
  crop?: ImageCrop | undefined;
}

/**
 * Canvas crop mode. The photo is drawn uncropped underneath (the adapter's crop view), and this
 * overlay dims everything outside the box and owns the eight handles, the aspect presets and the
 * Enter / Escape shortcuts. It never writes to the document while dragging: `applyCrop` turns the
 * draft into one undoable change.
 */
export function CropOverlay() {
  const cropId = useEditor((state) => state.cropId);
  const rootRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<{ left: number; top: number } | null>(null);
  const viewportRevision = useCanvasState((state) => state.viewportRevision);
  const zoom = useEditor((state) => state.zoom);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const bounds = root.getBoundingClientRect();
    setOrigin((current) =>
      current?.left === bounds.left && current?.top === bounds.top
        ? current
        : { left: bounds.left, top: bounds.top },
    );
  }, []);

  useLayoutEffect(measure, [measure, viewportRevision, zoom, cropId]);

  // The measuring wrapper exists for as long as crop mode does; its contents wait for a measurement.
  if (!cropId) return null;
  return (
    <div
      ref={rootRef}
      data-testid="crop-overlay"
      role="dialog"
      aria-label="Crop image"
      className="absolute inset-0 z-30"
    >
      {origin ? <CropBody origin={origin} /> : null}
    </div>
  );
}

function CropBody({ origin }: { origin: { left: number; top: number } }) {
  const store = useEditorStore();
  const controller = useCanvasController();
  const cropId = useEditor((state) => state.cropId);
  const draft = useEditor((state) => state.cropDraft);
  const zoom = useEditor((state) => state.zoom);
  const element = useEditor((state) => {
    if (!state.cropId) return undefined;
    const page = state.document.pages.find((candidate) => candidate.id === state.activePageId);
    const found = page?.elements.find((candidate) => candidate.id === state.cropId);
    return found?.type === 'image' ? found : undefined;
  });
  const asset = useEditor((state) =>
    element ? state.document.assets[element.assetId] : undefined,
  );

  if (!cropId || !element || !asset || !draft) return null;
  return (
    <CropBoxView
      element={element}
      asset={asset}
      draft={{ box: draft.box, crop: draft.crop }}
      zoom={zoom}
      origin={origin}
      controller={controller}
      store={store}
    />
  );
}

interface CropBoxViewProps {
  element: ImageElement;
  asset: ImageAsset;
  draft: { box: CropBox; crop?: ImageCrop | undefined };
  zoom: number;
  origin: { left: number; top: number };
  controller: ReturnType<typeof useCanvasController>;
  store: ReturnType<typeof useEditorStore>;
}

function CropBoxView({ element, asset, draft, zoom, origin, controller, store }: CropBoxViewProps) {
  // Drag state is React state, not a ref: the gesture starts once per pointerdown, so a render
  // there costs nothing, and every pointermove handler closes over the live drag.
  const [drag, setDrag] = useState<DragState | null>(null);
  const natural = { width: asset.width, height: asset.height };
  const topLeft = controller.pageToClient(draft.box.x, draft.box.y);
  if (!topLeft) return null;

  const screen = {
    left: topLeft.x - origin.left,
    top: topLeft.y - origin.top,
    width: draft.box.width * zoom,
    height: draft.box.height * zoom,
  };
  const base = { ...element, ...draft.box, crop: draft.crop };

  const startDrag = (mode: DragState['mode']) => (event: PointerEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      mode,
      clientX: event.clientX,
      clientY: event.clientY,
      box: draft.box,
      crop: draft.crop,
    });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    const local = toLocal(
      {
        x: (event.clientX - drag.clientX) / zoom,
        y: (event.clientY - drag.clientY) / zoom,
      },
      element.rotation,
    );
    if (drag.mode === 'move') {
      store.getState().updateCropDraft(panCrop(base, natural, local));
      return;
    }
    const box = { ...drag.box };
    if (drag.mode.includes('e')) box.width = drag.box.width + local.x;
    if (drag.mode.includes('w')) {
      box.x = drag.box.x + local.x;
      box.width = drag.box.width - local.x;
    }
    if (drag.mode.includes('s')) box.height = drag.box.height + local.y;
    if (drag.mode.includes('n')) {
      box.y = drag.box.y + local.y;
      box.height = drag.box.height - local.y;
    }
    store.getState().updateCropDraft(resizeCrop(element, natural, drag.mode, box));
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (!drag) return;
    setDrag(null);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  const applyAspect = (ratio: number | null) => {
    if (ratio === null) return;
    store.getState().updateCropDraft(cropAspect(base, natural, ratio));
  };

  return (
    <>
      {/* Clicking away applies, like leaving a crop tool in Canva. */}
      <div
        data-testid="crop-backdrop"
        className="absolute inset-0 cursor-pointer"
        onPointerDown={() => store.getState().applyCrop()}
      />
      <div
        className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
        style={{ ...screen, transform: `rotate(${element.rotation}deg)` }}
      >
        <div
          className="size-full cursor-move"
          aria-label="Move photo inside crop"
          role="presentation"
          onPointerDown={startDrag('move')}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {/* Rule-of-thirds guides, the way a crop tool shows its framing. */}
          <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
            {Array.from({ length: 9 }, (_, index) => (
              <div key={index} className="border border-white/20" />
            ))}
          </div>
        </div>
        {HANDLES.map(({ handle, className, cursor }) => (
          <button
            key={handle}
            type="button"
            aria-label={`Resize crop ${handle}`}
            data-crop-handle={handle}
            className={`absolute size-3 rounded-full border-2 border-white bg-primary shadow ${className}`}
            style={{ cursor, touchAction: 'none' }}
            onPointerDown={startDrag(handle)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        ))}
      </div>
      <div className="pointer-events-auto absolute inset-x-0 top-3 flex justify-center">
        <div className="flex items-center gap-1 rounded-full border border-border bg-white px-2 py-1.5 shadow-lg">
          <div className="flex items-center gap-1" role="group" aria-label="Crop aspect">
            {ASPECTS.map((aspect) => (
              <Button
                key={aspect.id}
                variant="ghost"
                size="sm"
                onClick={() => applyAspect(aspect.ratio)}
                disabled={aspect.ratio === null}
              >
                {aspect.label}
              </Button>
            ))}
          </div>
          <span className="mx-1 h-5 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={() => store.getState().cancelCrop()}>
            Cancel
          </Button>
          <Button size="sm" onClick={() => store.getState().applyCrop()}>
            Apply
          </Button>
        </div>
      </div>
    </>
  );
}
