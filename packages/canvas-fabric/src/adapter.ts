import type {
  Asset,
  DesignDocument,
  DesignElement,
  DocumentSize,
  ImageElement,
  ImageFit,
  Page,
} from '@opencanvas/document';
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  type FabricObject,
  type ImageSource,
  InteractiveFabricObject,
  Point,
  Rect,
  Textbox,
  util,
  type TMat2D,
} from 'fabric';
import { AligningGuidelines } from 'fabric/extensions';

import {
  elementToFabricProps,
  fillToFabric,
  patchFromTransform,
  roundTo,
  type BoxGeometry,
} from './mapping';
import { PLACEHOLDER_SIZE, createPlaceholderBitmap } from './placeholder';

export interface ElementGeometryChange {
  elementId: string;
  patch: Partial<BoxGeometry> & { fontSize?: number };
}

export interface CanvasAdapterCallbacks {
  /** Fired once per user interaction (drag, scale, rotate) with the resulting geometry. */
  onElementsModified: (changes: readonly ElementGeometryChange[]) => void;
  /** Fired when the user finishes inline text editing. */
  onTextCommitted: (elementId: string, text: string, measuredHeight: number) => void;
  /** Fired when auto-sized text changes height because of a property change. */
  onTextMeasured: (elementId: string, measuredHeight: number) => void;
  onSelectionChanged: (elementIds: readonly string[]) => void;
  onZoomChanged: (zoom: number) => void;
  /**
   * Fired when an image element cannot be displayed: the asset record is missing, its bytes
   * are not available, or the browser failed to decode them. The element stays on the
   * canvas with an error placeholder so the user can still select and delete it.
   */
  onAssetError: (elementId: string, assetId: string, error: AssetLoadError) => void;
}

export interface AssetLoadError {
  code: 'asset-missing' | 'unavailable' | 'load-failed';
  message: string;
}

export interface CanvasScene {
  page: Page;
  size: DocumentSize;
  selectedIds: readonly string[];
  /** Asset records referenced by image elements on the page. */
  assets: DesignDocument['assets'];
}

/** Maps an asset record to a URL the browser can load, or `null` when unavailable. */
export type AssetUrlResolver = (asset: Asset) => Promise<string | null>;

/** Loads a URL into something Fabric can draw. Injectable so tests can skip the network. */
export type ImageSourceLoader = (
  url: string,
  options: { signal: AbortSignal },
) => Promise<ImageSource>;

export interface CanvasAdapterOptions {
  accentColor?: string;
  /**
   * Resolves asset records to loadable URLs. Without a resolver images cannot be displayed:
   * every image element shows the error placeholder and reports `unavailable`.
   */
  resolveAssetUrl?: AssetUrlResolver;
  /** Defaults to Fabric's loader with anonymous CORS so exported canvases stay untainted. */
  loadImage?: ImageSourceLoader;
  /** Alignment guides and snapping while moving or scaling objects. Defaults to `true`. */
  snapping?: boolean;
}

const DEFAULT_ACCENT = '#4f46e5';
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const SNAP_MARGIN = 6;

type ElementObject = Rect | Ellipse | Textbox | FabricImage;

interface ImageEntry {
  assetId: string;
  status: 'loading' | 'ready' | 'error';
  /** Decoded bitmap size once the image is ready. */
  natural: { width: number; height: number } | null;
  abort: AbortController | null;
}

class AssetLoadFailure extends Error {
  constructor(
    readonly code: AssetLoadError['code'],
    message: string,
  ) {
    super(message);
    this.name = 'AssetLoadFailure';
  }
}

const defaultImageLoader: ImageSourceLoader = (url, { signal }) =>
  util.loadImage(url, { signal, crossOrigin: 'anonymous' });

function sourceSize(source: ImageSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.width, height: source.height };
}

function applySelectionStyle(accent: string): void {
  // Static defaults apply to every object created afterwards.
  InteractiveFabricObject.ownDefaults = {
    ...InteractiveFabricObject.ownDefaults,
    transparentCorners: false,
    cornerColor: '#ffffff',
    cornerStrokeColor: accent,
    cornerStyle: 'circle',
    cornerSize: 10,
    touchCornerSize: 24,
    borderColor: accent,
    borderScaleFactor: 1.5,
    padding: 0,
    objectCaching: false,
  };
}

/**
 * Renders a document page with Fabric.js and translates user interactions back into
 * document-level change descriptions. It never mutates the document itself: every change
 * flows out through callbacks and comes back in through `render()`.
 *
 * Loop prevention: while `render()` applies state to Fabric, `applying` is true and all
 * Fabric event handlers return early, so programmatic updates never echo back as commands.
 */
export class FabricCanvasAdapter {
  private readonly canvas: Canvas;
  private readonly callbacks: CanvasAdapterCallbacks;
  private readonly objects = new Map<string, ElementObject>();
  private readonly idsByObject = new WeakMap<FabricObject, string>();
  private readonly pageBackground: Rect;
  private readonly clip: Rect;
  private readonly accent: string;
  private readonly resolveAssetUrl: AssetUrlResolver | null;
  private readonly loadImage: ImageSourceLoader;
  private readonly images = new Map<string, ImageEntry>();
  private readonly loadingBitmap = createPlaceholderBitmap('loading');
  private readonly errorBitmap = createPlaceholderBitmap('error');
  private guidelines: AligningGuidelines | null = null;
  private elements = new Map<string, DesignElement>();
  private assets: DesignDocument['assets'] = {};
  private pageSize: DocumentSize = { width: 1, height: 1 };
  private applying = false;
  private disposed = false;

  constructor(
    element: HTMLCanvasElement,
    callbacks: CanvasAdapterCallbacks,
    options: CanvasAdapterOptions = {},
  ) {
    this.accent = options.accentColor ?? DEFAULT_ACCENT;
    applySelectionStyle(this.accent);
    this.callbacks = callbacks;
    this.resolveAssetUrl = options.resolveAssetUrl ?? null;
    this.loadImage = options.loadImage ?? defaultImageLoader;
    this.canvas = new Canvas(element, {
      preserveObjectStacking: true,
      selection: true,
      selectionColor: 'rgba(79, 70, 229, 0.08)',
      selectionBorderColor: options.accentColor ?? DEFAULT_ACCENT,
      selectionLineWidth: 1,
      uniformScaling: true,
      stopContextMenu: true,
      fireRightClick: false,
      renderOnAddRemove: false,
      enableRetinaScaling: true,
    });

    this.pageBackground = new Rect({
      left: 0,
      top: 0,
      width: 1,
      height: 1,
      fill: '#ffffff',
      strokeWidth: 0,
      selectable: false,
      evented: false,
      hoverCursor: 'default',
      excludeFromExport: true,
      objectCaching: false,
    });
    this.clip = new Rect({ left: 0, top: 0, width: 1, height: 1, strokeWidth: 0 });
    this.canvas.clipPath = this.clip;
    this.canvas.add(this.pageBackground);
    this.bindEvents();
    this.setSnapping(options.snapping ?? true);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /** Resizes the drawing surface to the workspace container. */
  setViewportSize(width: number, height: number): void {
    if (this.disposed) return;
    this.canvas.setDimensions({ width: Math.max(1, width), height: Math.max(1, height) });
    this.canvas.requestRenderAll();
  }

  getViewportSize(): { width: number; height: number } {
    return { width: this.canvas.getWidth(), height: this.canvas.getHeight() };
  }

  getZoom(): number {
    return this.canvas.getZoom();
  }

  /** Zooms around a viewport point (defaults to the viewport center). */
  setZoom(zoom: number, focalPoint?: { x: number; y: number }): void {
    if (this.disposed) return;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
    const focal = focalPoint ?? {
      x: this.canvas.getWidth() / 2,
      y: this.canvas.getHeight() / 2,
    };
    this.canvas.zoomToPoint(new Point(focal.x, focal.y), clamped);
    this.canvas.requestRenderAll();
    this.callbacks.onZoomChanged(clamped);
  }

  panBy(deltaX: number, deltaY: number): void {
    if (this.disposed) return;
    this.canvas.relativePan(new Point(deltaX, deltaY));
    this.canvas.requestRenderAll();
  }

  /** Fits and centers the page inside the viewport. */
  fitToViewport(padding = 48): void {
    if (this.disposed) return;
    const viewportWidth = this.canvas.getWidth();
    const viewportHeight = this.canvas.getHeight();
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          Math.max(1, viewportWidth - padding * 2) / this.pageSize.width,
          Math.max(1, viewportHeight - padding * 2) / this.pageSize.height,
        ),
      ),
    );
    const transform: TMat2D = [
      zoom,
      0,
      0,
      zoom,
      (viewportWidth - this.pageSize.width * zoom) / 2,
      (viewportHeight - this.pageSize.height * zoom) / 2,
    ];
    this.canvas.setViewportTransform(transform);
    this.canvas.requestRenderAll();
    this.callbacks.onZoomChanged(zoom);
  }

  /** Reconciles Fabric objects with the given page, preserving object identity by element id. */
  render(scene: CanvasScene): void {
    if (this.disposed) return;
    this.applying = true;
    try {
      this.assets = scene.assets;
      this.syncPage(scene);
      this.syncElements(scene.page.elements);
      this.syncOrder(scene.page.elements);
      this.syncSelection(scene.selectedIds);
      this.canvas.requestRenderAll();
    } finally {
      this.applying = false;
    }
    this.reportMeasuredTextHeights(scene.page.elements);
  }

  /** Starts inline editing for a text element (e.g. after inserting it). */
  beginTextEditing(elementId: string): boolean {
    const object = this.objects.get(elementId);
    if (!(object instanceof Textbox) || object.editable === false) return false;
    this.canvas.setActiveObject(object);
    object.enterEditing();
    object.selectAll();
    this.canvas.requestRenderAll();
    return true;
  }

  isEditingText(): boolean {
    const active = this.canvas.getActiveObject();
    return active instanceof Textbox && active.isEditing;
  }

  /**
   * Converts a point in CSS pixels relative to the browser viewport (e.g. `clientX/Y` of a
   * drop event) into page coordinates, taking zoom and pan into account.
   */
  clientToPage(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.canvas.getElement().getBoundingClientRect();
    const local = new Point(clientX - bounds.left, clientY - bounds.top);
    const page = local.transform(util.invertTransform(this.canvas.viewportTransform));
    return { x: roundTo(page.x), y: roundTo(page.y) };
  }

  /** Toggles alignment guides and snapping to other objects and the page edges/center. */
  setSnapping(enabled: boolean): void {
    if (this.disposed) return;
    if (enabled && !this.guidelines) {
      this.guidelines = new AligningGuidelines(this.canvas, {
        margin: SNAP_MARGIN,
        width: 1,
        color: this.accent,
      });
    } else if (!enabled && this.guidelines) {
      this.guidelines.dispose();
      this.guidelines = null;
    }
  }

  isSnappingEnabled(): boolean {
    return this.guidelines !== null;
  }

  /** Load state of an image element (diagnostics, tests and the layers panel). */
  getImageStatus(elementId: string): ImageEntry['status'] | undefined {
    return this.images.get(elementId)?.status;
  }

  /** Escape hatch for tests and advanced integrations. Prefer the typed API above. */
  getFabricCanvas(): Canvas {
    return this.canvas;
  }

  /**
   * Re-measures every text box, e.g. after web fonts finish loading, and reports heights
   * that changed as a result.
   */
  invalidateTextLayout(): void {
    if (this.disposed) return;
    for (const object of this.objects.values()) {
      if (object instanceof Textbox) {
        object.initDimensions();
        object.setCoords();
        object.dirty = true;
      }
    }
    this.canvas.requestRenderAll();
    this.reportMeasuredTextHeights(Array.from(this.elements.values()));
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const entry of this.images.values()) entry.abort?.abort();
    this.images.clear();
    this.guidelines?.dispose();
    this.guidelines = null;
    this.objects.clear();
    // With no render pending, Fabric tears the DOM down synchronously, which keeps React
    // StrictMode's mount -> unmount -> mount cycle (and fast navigation) free of races.
    this.canvas.cancelRequestedRender();
    void this.canvas.dispose();
  }

  // ---------------------------------------------------------------------------
  // Reconciliation
  // ---------------------------------------------------------------------------

  private syncPage(scene: CanvasScene): void {
    const { width, height } = scene.size;
    this.pageSize = { width, height };
    // Center-origin objects: left/top is the page center.
    this.pageBackground.set({
      left: width / 2,
      top: height / 2,
      width,
      height,
      fill: fillToFabric(scene.page.background) || '#ffffff',
    });
    this.pageBackground.setCoords();
    this.clip.set({ left: width / 2, top: height / 2, width, height });
    this.clip.setCoords();
  }

  private syncElements(elements: readonly DesignElement[]): void {
    const seen = new Set<string>();
    const nextElements = new Map<string, DesignElement>();

    // Objects inside an ActiveSelection use group-relative coordinates, so the selection is
    // dropped before touching any object and rebuilt by `syncSelection`.
    if (this.canvas.getActiveObject() instanceof ActiveSelection) {
      this.canvas.discardActiveObject();
    }

    for (const element of elements) {
      seen.add(element.id);
      nextElements.set(element.id, element);
      const previous = this.elements.get(element.id);
      if (previous === element && this.objects.has(element.id)) continue;

      const existing = this.objects.get(element.id);
      const object =
        existing && objectMatchesType(existing, element.type)
          ? existing
          : this.replaceObject(element, existing);
      this.applyElement(object, element);
    }

    for (const [id, object] of this.objects) {
      if (!seen.has(id)) {
        this.canvas.remove(object);
        this.objects.delete(id);
        this.forgetImage(id);
      }
    }
    this.elements = nextElements;
  }

  private replaceObject(
    element: DesignElement,
    existing: ElementObject | undefined,
  ): ElementObject {
    if (existing) {
      this.canvas.remove(existing);
      this.forgetImage(element.id);
    }
    const object = this.createObject(element);
    this.objects.set(element.id, object);
    this.idsByObject.set(object, element.id);
    this.canvas.add(object);
    return object;
  }

  private createObject(element: DesignElement): ElementObject {
    const mapped = elementToFabricProps(element, this.fabricContext);
    switch (mapped.kind) {
      case 'rect':
        return new Rect(mapped.props);
      case 'ellipse':
        return new Ellipse(mapped.props);
      case 'text':
        return new Textbox(mapped.props.text, { ...mapped.props, splitByGrapheme: false });
      case 'image':
        return new FabricImage(this.loadingBitmap, mapped.props);
    }
  }

  private readonly fabricContext = {
    imageSource: (
      element: ImageElement,
    ): { natural: { width: number; height: number }; fit: ImageFit } => {
      const entry = this.images.get(element.id);
      if (entry?.status === 'ready' && entry.natural && entry.assetId === element.assetId) {
        return { natural: entry.natural, fit: element.fit };
      }
      return { natural: { width: PLACEHOLDER_SIZE, height: PLACEHOLDER_SIZE }, fit: 'fill' };
    },
  };

  private applyElement(object: ElementObject, element: DesignElement): void {
    if (element.type === 'image' && object instanceof FabricImage) {
      this.ensureImageLoading(object, element);
    }
    const mapped = elementToFabricProps(element, this.fabricContext);
    const props: Record<string, unknown> = { ...mapped.props };
    // Never overwrite text the user is currently typing; it is committed on exit.
    if (object instanceof Textbox && object.isEditing) {
      delete props['text'];
    }
    let changed = false;
    for (const [key, value] of Object.entries(props)) {
      if (object.get(key) !== value) {
        object.set(key, value);
        changed = true;
      }
    }
    if (changed) object.setCoords();
  }

  private syncOrder(elements: readonly DesignElement[]): void {
    // Index 0 is always the page background.
    elements.forEach((element, index) => {
      const object = this.objects.get(element.id);
      if (!object) return;
      const current = this.canvas.getObjects().indexOf(object);
      if (current !== index + 1) this.canvas.moveObjectTo(object, index + 1);
    });
  }

  private syncSelection(selectedIds: readonly string[]): void {
    const desired = selectedIds
      .map((id) => this.objects.get(id))
      .filter((object): object is ElementObject => object?.visible === true);
    const current = this.currentSelectionIds();
    const same =
      desired.length === current.length &&
      desired.every((object, index) => this.idsByObject.get(object) === current[index]);
    if (same) return;

    if (desired.length === 0) {
      this.canvas.discardActiveObject();
    } else if (desired.length === 1 && desired[0]) {
      this.canvas.setActiveObject(desired[0]);
    } else {
      const selection = new ActiveSelection(desired, { canvas: this.canvas });
      this.canvas.setActiveObject(selection);
    }
  }

  private currentSelectionIds(): string[] {
    return this.canvas
      .getActiveObjects()
      .map((object) => this.idsByObject.get(object))
      .filter((id): id is string => id !== undefined);
  }

  private reportMeasuredTextHeights(elements: readonly DesignElement[]): void {
    for (const element of elements) {
      if (element.type !== 'text') continue;
      const object = this.objects.get(element.id);
      if (!(object instanceof Textbox) || object.isEditing) continue;
      const measured = roundTo(object.height);
      if (Number.isFinite(measured) && measured >= 1 && Math.abs(measured - element.height) > 0.5) {
        this.callbacks.onTextMeasured(element.id, measured);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Image assets
  // ---------------------------------------------------------------------------

  private forgetImage(elementId: string): void {
    const entry = this.images.get(elementId);
    if (!entry) return;
    entry.abort?.abort();
    this.images.delete(elementId);
  }

  /**
   * Starts loading the element's asset unless the same asset is already loading or shown.
   * A failed load is not retried until the element points at a different asset, so a
   * broken file does not trigger a request on every render.
   */
  private ensureImageLoading(object: FabricImage, element: ImageElement): void {
    const current = this.images.get(element.id);
    if (current?.assetId === element.assetId) return;
    current?.abort?.abort();

    const asset = this.assets[element.assetId];
    if (!asset) {
      this.images.set(element.id, {
        assetId: element.assetId,
        status: 'error',
        natural: null,
        abort: null,
      });
      object.setElement(this.errorBitmap);
      this.callbacks.onAssetError(element.id, element.assetId, {
        code: 'asset-missing',
        message: `The image asset "${element.assetId}" is not part of this document.`,
      });
      return;
    }

    const controller = new AbortController();
    this.images.set(element.id, {
      assetId: asset.id,
      status: 'loading',
      natural: null,
      abort: controller,
    });
    if (object.getElement() !== this.loadingBitmap) object.setElement(this.loadingBitmap);
    void this.loadAsset(element.id, asset, controller);
  }

  private async loadAsset(
    elementId: string,
    asset: Asset,
    controller: AbortController,
  ): Promise<void> {
    const isCurrent = () =>
      !this.disposed &&
      !controller.signal.aborted &&
      this.images.get(elementId)?.abort === controller;
    try {
      if (!this.resolveAssetUrl) {
        throw new AssetLoadFailure(
          'unavailable',
          'No asset resolver is configured for this canvas, so images cannot be displayed.',
        );
      }
      const url = await this.resolveAssetUrl(asset);
      if (!isCurrent()) return;
      if (url === null) {
        throw new AssetLoadFailure(
          'unavailable',
          `The file for "${asset.name ?? asset.id}" is not available in this browser.`,
        );
      }
      const source = await this.loadImage(url, { signal: controller.signal });
      if (!isCurrent()) return;
      const natural = sourceSize(source);
      if (!(natural.width >= 1 && natural.height >= 1)) {
        throw new AssetLoadFailure(
          'load-failed',
          `The image "${asset.name ?? asset.id}" decoded to an empty bitmap.`,
        );
      }
      this.finishImageLoad(elementId, { status: 'ready', natural }, source);
    } catch (cause) {
      if (!isCurrent()) return;
      const error: AssetLoadError =
        cause instanceof AssetLoadFailure
          ? { code: cause.code, message: cause.message }
          : {
              code: 'load-failed',
              message: `Could not load the image "${asset.name ?? asset.id}": ${
                cause instanceof Error ? cause.message : String(cause)
              }`,
            };
      this.finishImageLoad(elementId, { status: 'error', natural: null }, this.errorBitmap);
      this.callbacks.onAssetError(elementId, asset.id, error);
    }
  }

  private finishImageLoad(
    elementId: string,
    outcome: Pick<ImageEntry, 'status' | 'natural'>,
    source: ImageSource,
  ): void {
    const entry = this.images.get(elementId);
    if (!entry) return;
    entry.status = outcome.status;
    entry.natural = outcome.natural;
    entry.abort = null;
    const object = this.objects.get(elementId);
    const element = this.elements.get(elementId);
    if (!(object instanceof FabricImage) || element?.type !== 'image') return;
    this.applying = true;
    try {
      object.setElement(source);
      this.applyElement(object, element);
      object.setCoords();
    } finally {
      this.applying = false;
    }
    this.canvas.requestRenderAll();
  }

  // ---------------------------------------------------------------------------
  // Fabric events -> callbacks
  // ---------------------------------------------------------------------------

  private bindEvents(): void {
    this.canvas.on('object:modified', (event) => {
      if (this.applying) return;
      const target = event.target;
      const targets = target instanceof ActiveSelection ? target.getObjects() : [target];
      const changes: ElementGeometryChange[] = [];
      for (const object of targets) {
        const id = this.idsByObject.get(object);
        const element = id === undefined ? undefined : this.elements.get(id);
        if (!id || !element) continue;
        // calcTransformMatrix() yields the absolute transform even inside a selection group.
        const decomposed = util.qrDecompose(object.calcTransformMatrix());
        changes.push({
          elementId: id,
          patch: patchFromTransform(element, decomposed, {
            width: object.width,
            height: object.height,
          }),
        });
      }
      if (changes.length > 0) this.callbacks.onElementsModified(changes);
    });

    const emitSelection = () => {
      if (this.applying) return;
      this.callbacks.onSelectionChanged(this.currentSelectionIds());
    };
    this.canvas.on('selection:created', emitSelection);
    this.canvas.on('selection:updated', emitSelection);
    this.canvas.on('selection:cleared', emitSelection);

    this.canvas.on('text:editing:exited', (event) => {
      if (this.applying) return;
      const id = this.idsByObject.get(event.target);
      if (!id) return;
      this.callbacks.onTextCommitted(id, event.target.text, roundTo(event.target.height));
    });

    this.canvas.on('mouse:wheel', (event) => {
      const wheel = event.e;
      wheel.preventDefault();
      wheel.stopPropagation();
      if (wheel.ctrlKey || wheel.metaKey) {
        const factor = Math.exp(-wheel.deltaY * 0.0015);
        this.setZoom(this.canvas.getZoom() * factor, { x: wheel.offsetX, y: wheel.offsetY });
      } else {
        this.panBy(-wheel.deltaX, -wheel.deltaY);
      }
    });
  }
}

function objectMatchesType(object: ElementObject, type: DesignElement['type']): boolean {
  switch (type) {
    case 'rect':
      return object instanceof Rect;
    case 'ellipse':
      return object instanceof Ellipse;
    case 'text':
      return object instanceof Textbox;
    case 'image':
      return object instanceof FabricImage;
  }
}
