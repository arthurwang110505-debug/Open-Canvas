import type {
  Asset,
  DesignDocument,
  DesignElement,
  DocumentSize,
  IconElement,
  ImageElement,
  ImageFit,
  Page,
} from '@opencanvas/document';
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  FabricImage,
  Gradient,
  type FabricObject,
  type ImageSource,
  Group,
  InteractiveFabricObject,
  Path,
  Point,
  Rect,
  Shadow,
  Textbox,
  filters,
  util,
  type TMat2D,
} from 'fabric';
import { AligningGuidelines } from 'fabric/extensions';

import { ICON_VIEWBOX } from '@opencanvas/icons';

import {
  elementToFabricProps,
  fillSignature,
  fillToFabric,
  iconPaths,
  iconToFabricProps,
  patchFromTransform,
  roundTo,
  topLeftToCenter,
  type BoxGeometry,
  type FabricFill,
  type PathFabricProps,
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
  /** Panning, zooming or fitting changed what part of the page is under the viewport. */
  onViewportChanged?: () => void;
  /** A pointer interaction (press, drag, release) started or ended. */
  onInteractionChanged?: (interacting: boolean) => void;
  /** Inline text editing started or ended, so chrome can step out of the way. */
  onTextEditingChanged?: (editing: boolean) => void;
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

/** A rectangle in client (viewport) coordinates. */
export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
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

/** Fabric's gradient classes are generic over their own type; either kind paints a shape. */
type AnyGradient = Gradient<'linear'> | Gradient<'radial'>;

/** Cache key for the page rectangle's paint; element ids cannot collide with it (no `$`). */
const PAGE_BACKGROUND_ID = '$page-background';

const DEFAULT_ACCENT = '#7a5cf9';
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;
const SNAP_MARGIN = 6;

type ElementObject = Rect | Ellipse | Textbox | FabricImage | Path | Group;

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

function buildFabricFilters(filtersConfig: {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
}): InstanceType<typeof filters.BaseFilter>[] {
  const out: InstanceType<typeof filters.BaseFilter>[] = [];
  if (filtersConfig.brightness !== 100) {
    const b = (filtersConfig.brightness - 100) / 100;
    out.push(new filters.Brightness({ brightness: Math.max(-1, Math.min(1, b)) }));
  }
  if (filtersConfig.contrast !== 100) {
    const c = (filtersConfig.contrast - 100) / 100;
    out.push(new filters.Contrast({ contrast: Math.max(-1, Math.min(1, c)) }));
  }
  if (filtersConfig.saturate !== 100) {
    const s = (filtersConfig.saturate - 100) / 100;
    out.push(new filters.Saturation({ saturation: Math.max(-1, Math.min(1, s)) }));
  }
  if (filtersConfig.blur) {
    const blurVal = Math.min(1, filtersConfig.blur / 50);
    out.push(new filters.Blur({ blur: blurVal }));
  }
  return out;
}

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
  /**
   * Which icon (and which colour/stroke) each icon group was built for. The geometry is baked into
   * its child paths, so a changed icon needs a new object rather than a property update.
   */
  private readonly iconSignatures = new WeakMap<FabricObject, string>();
  private readonly idsByObject = new WeakMap<FabricObject, string>();
  private readonly pageBackground: Rect;
  /** Cached gradients, keyed by element id (page background uses a reserved id). */
  private readonly gradients = new Map<string, { signature: string; gradient: AnyGradient }>();
  /** The paint currently applied to the page rectangle, so it is only rebuilt when it changes. */
  private pageBackgroundSignature = '';
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
  private previewPath: Path | null = null;

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
      shadow: new Shadow({
        color: 'rgba(15, 23, 42, 0.12)',
        blur: 24,
        offsetX: 0,
        offsetY: 8,
      }),
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

  getViewportTransform(): TMat2D {
    return this.canvas.viewportTransform;
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
    this.callbacks.onViewportChanged?.();
  }

  panBy(deltaX: number, deltaY: number): void {
    if (this.disposed) return;
    this.canvas.relativePan(new Point(deltaX, deltaY));
    this.canvas.requestRenderAll();
    this.callbacks.onViewportChanged?.();
  }

  /**
   * Bounding box of the current selection in client coordinates (viewport pixels), or `null`
   * when nothing is selected. Used to anchor floating UI to the object rather than the screen.
   */
  getSelectionClientRect(): ViewportRect | null {
    if (this.disposed) return null;
    const active = this.canvas.getActiveObject();
    if (!active) return null;
    const host = this.canvas.getElement().getBoundingClientRect();
    const bounds = active.getBoundingRect();
    return {
      left: host.left + bounds.left,
      top: host.top + bounds.top,
      width: bounds.width,
      height: bounds.height,
    };
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
    this.callbacks.onViewportChanged?.();
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

  /** Shows a temporary freehand preview while the user is drawing. */
  setPreviewPath(
    points: readonly { x: number; y: number }[] | null,
    stroke: string,
    strokeWidth: number,
  ): void {
    if (this.disposed) return;
    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
      this.previewPath = null;
    }
    if (!points || points.length < 2) {
      this.canvas.requestRenderAll();
      return;
    }
    // Build preview as a polyline in page coordinates — same as Path element but not persisted
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    const rel = points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
    const first = rel[0];
    if (!first) return;
    const center = { x: minX + w / 2, y: minY + h / 2 };
    // Top-left to center conversion without rotation
    const fabricCenter = { x: center.x, y: center.y }; // No rotation for preview
    // Use Path with center origin: shift points by -w/2, -h/2
    const cx = w / 2;
    const cy = h / 2;
    const centered = rel.map((p) => ({ x: p.x - cx, y: p.y - cy }));
    let centeredD = `M ${centered[0]?.x ?? 0} ${centered[0]?.y ?? 0}`;
    for (const p of centered.slice(1)) centeredD += ` L ${p.x} ${p.y}`;
    const preview = new Path(centeredD, {
      left: fabricCenter.x,
      top: fabricCenter.y,
      stroke,
      strokeWidth,
      fill: '',
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      selectable: false,
      evented: false,
      objectCaching: false,
    });
    this.previewPath = preview;
    this.canvas.add(preview);
    this.canvas.requestRenderAll();
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
    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
      this.previewPath = null;
    }
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

  // ---------------------------------------------------------------------------
  // Fills
  // ---------------------------------------------------------------------------

  /**
   * Fabric gradients are objects, not values, so they are cached per element and rebuilt only
   * when the fill's appearance changes. Their coordinates are fractions of the object's bounding
   * box, which is exactly SVG's `objectBoundingBox` unit — the canvas and an exported file can
   * therefore be compared pixel for pixel.
   */
  private fillFor(id: string, fill: FabricFill): string | AnyGradient {
    if (typeof fill === 'string') {
      this.gradients.delete(id);
      return fill;
    }
    const signature = fillSignature(fill);
    const cached = this.gradients.get(id);
    if (cached?.signature === signature) return cached.gradient;
    const gradient: AnyGradient =
      fill.type === 'linear'
        ? new Gradient<'linear'>({
            type: 'linear',
            gradientUnits: 'percentage',
            coords: fill.coords,
            colorStops: fill.colorStops,
          })
        : new Gradient<'radial'>({
            type: 'radial',
            gradientUnits: 'percentage',
            coords: fill.coords,
            colorStops: fill.colorStops,
          });
    this.gradients.set(id, { signature, gradient });
    return gradient;
  }

  /** The paint a mapped `fill` calls for, gradient or plain colour. */
  private paint(id: string, fill: FabricFill): string | AnyGradient {
    return this.fillFor(id, fill);
  }

  private syncPage(scene: CanvasScene): void {
    const { width, height } = scene.size;
    this.pageSize = { width, height };
    // Center-origin objects: left/top is the page center.
    const background = fillToFabric(scene.page.background);
    // The page rectangle is painted even for `none` (white paper, not a transparent hole).
    const paint = background === '' ? '#ffffff' : this.paint(PAGE_BACKGROUND_ID, background);
    const signature = fillSignature(background);
    const props: Record<string, unknown> = { left: width / 2, top: height / 2, width, height };
    // Re-assigning an identical gradient every frame forces Fabric to repaint the whole page.
    if (signature !== this.pageBackgroundSignature) props['fill'] = paint;
    this.pageBackground.set(props);
    this.pageBackgroundSignature = signature;
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
        existing && this.objectMatchesElement(existing, element)
          ? existing
          : this.replaceObject(element, existing);
      this.applyElement(object, element);
    }

    for (const [id, object] of this.objects) {
      if (!seen.has(id)) {
        this.canvas.remove(object);
        this.objects.delete(id);
        this.forgetImage(id);
        this.gradients.delete(id);
      }
    }
    this.elements = nextElements;
  }

  /**
   * Whether an existing Fabric object can be updated in place. Type alone is not enough for icons
   * (their geometry is baked into child paths) or for groups (an icon is also a `Group`).
   */
  private objectMatchesElement(object: ElementObject, element: DesignElement): boolean {
    if (!objectMatchesType(object, element.type)) return false;
    const signature = this.iconSignatures.get(object);
    if (element.type === 'icon') return signature === iconSignature(element);
    return signature === undefined;
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
    if (element.type === 'group') {
      return this.createGroupObject(element);
    }
    // Icons carry their own shape data, so they are built before the generic property mapping
    // (which narrows the element type for the renderers below).
    if (element.type === 'icon') {
      return this.createIconObject(element);
    }
    const mapped = elementToFabricProps(element, this.fabricContext);
    switch (mapped.kind) {
      case 'rect':
        return new Rect({ ...mapped.props, fill: this.paint(element.id, mapped.props.fill) });
      case 'ellipse':
        return new Ellipse({ ...mapped.props, fill: this.paint(element.id, mapped.props.fill) });
      case 'text':
        return new Textbox(mapped.props.text, { ...mapped.props, splitByGrapheme: false });
      case 'image':
        return new FabricImage(this.loadingBitmap, mapped.props);
      case 'path': {
        const { path, fill, ...rest } = mapped.props;
        return new Path(path, { ...rest, fill: this.paint(element.id, fill) });
      }
      case 'icon':
        throw new Error('Icon elements are built before property mapping.');
    }
  }

  /**
   * Builds the icon as one group of paths in grid units, scaled onto the element box. An invisible
   * 24×24 frame is included so the group's intrinsic size is exactly the grid: that keeps
   * `geometryFromTransform` (and therefore every resize) exact, and makes the canvas transform
   * identical to the exporter's `scale(width / 24, height / 24)`.
   */
  private createIconObject(element: IconElement): Group {
    const props = iconToFabricProps(element);
    const children: FabricObject[] = iconPaths(element).map(({ d, filled }) => {
      return new Path(d, {
        fill: filled ? element.color : 'none',
        stroke: filled ? undefined : element.color,
        strokeWidth: element.strokeWidth,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      });
    });
    children.push(
      new Rect({
        width: ICON_VIEWBOX,
        height: ICON_VIEWBOX,
        // Fabric positions a grouped child by its centre, so the frame sits at (12, 12) — the
        // middle of the grid — and the group's box ends up exactly 24×24.
        left: ICON_VIEWBOX / 2,
        top: ICON_VIEWBOX / 2,
        fill: 'transparent',
        strokeWidth: 0,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      }),
    );
    const group = new Group(children, {
      ...props,
      selectable: !element.locked,
      evented: !element.locked,
      subTargetCheck: false,
    });
    this.iconSignatures.set(group, iconSignature(element));
    return group;
  }

  private createGroupObject(group: DesignElement & { type: 'group' }): Group {
    const groupCenter = topLeftToCenter(group);
    const childObjects: FabricObject[] = group.children.map((child) => {
      // Image inside group not yet fully supported (placeholder)
      if (child.type === 'group') {
        // Nested group: recursively create
        const nested = this.createGroupObject(child);
        // nested is already a Group with absolute positioning? Need to offset to parent group center
        // For nested, its center absolute is topLeftToCenter(child absolute) -> compute relative
        const childAbsCenter = topLeftToCenter({
          x: group.x + child.x,
          y: group.y + child.y,
          width: child.width,
          height: child.height,
          rotation: child.rotation,
        });
        // Reposition nested group to be relative to parent
        nested.set({
          left: childAbsCenter.x - groupCenter.x,
          top: childAbsCenter.y - groupCenter.y,
        });
        return nested;
      }
      if (child.type === 'image') {
        // For v1, render image as rect placeholder inside group
        const mapped = elementToFabricProps(child, this.fabricContext);
        let obj: FabricObject;
        if (mapped.kind === 'image') obj = new FabricImage(this.loadingBitmap, mapped.props);
        else obj = new Rect({ width: child.width, height: child.height, fill: '#e5e7eb' });
        const childAbsCenter = topLeftToCenter({
          x: group.x + child.x,
          y: group.y + child.y,
          width: child.width,
          height: child.height,
          rotation: child.rotation,
        });
        obj.set({ left: childAbsCenter.x - groupCenter.x, top: childAbsCenter.y - groupCenter.y });
        return obj;
      }
      const mapped = elementToFabricProps(child, this.fabricContext);
      let fabricObj: FabricObject;
      switch (mapped.kind) {
        case 'rect':
          fabricObj = new Rect({ ...mapped.props, fill: this.paint(child.id, mapped.props.fill) });
          break;
        case 'ellipse':
          fabricObj = new Ellipse({
            ...mapped.props,
            fill: this.paint(child.id, mapped.props.fill),
          });
          break;
        case 'text':
          fabricObj = new Textbox(mapped.props.text, { ...mapped.props, splitByGrapheme: false });
          break;
        case 'image':
          fabricObj = new FabricImage(this.loadingBitmap, mapped.props);
          break;
        case 'path': {
          const { path, fill, ...rest } = mapped.props;
          fabricObj = new Path(path, { ...rest, fill: this.paint(child.id, fill) });
          break;
        }
        case 'icon':
          if (child.type !== 'icon') throw new Error('Icon props require an icon element.');
          fabricObj = this.createIconObject(child);
          break;
      }
      const childAbsCenter = topLeftToCenter({
        x: group.x + child.x,
        y: group.y + child.y,
        width: child.width,
        height: child.height,
        rotation: child.rotation,
      });
      // Override to group-relative coordinates (Fabric Group expects children relative to group center)
      fabricObj.set({
        left: childAbsCenter.x - groupCenter.x,
        top: childAbsCenter.y - groupCenter.y,
      });
      // Individual children inside a group should not be interactive
      fabricObj.set({ selectable: false, evented: false, hasControls: false, hasBorders: false });
      return fabricObj;
    });

    const commonCenter = topLeftToCenter(group);
    return new Group(childObjects, {
      left: commonCenter.x,
      top: commonCenter.y,
      angle: group.rotation,
      opacity: group.opacity,
      visible: group.visible,
      selectable: !group.locked,
      evented: !group.locked,
      hasControls: !group.locked,
      lockMovementX: group.locked,
      lockMovementY: group.locked,
      lockRotation: group.locked,
      lockScalingX: group.locked,
      lockScalingY: group.locked,
    });
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
    if (element.type === 'group' && object instanceof Group) {
      const center = topLeftToCenter(element);
      const props: Record<string, unknown> = {
        left: center.x,
        top: center.y,
        angle: element.rotation,
        opacity: element.opacity,
        visible: element.visible,
        selectable: !element.locked,
        evented: !element.locked,
        hasControls: !element.locked,
        lockMovementX: element.locked,
        lockMovementY: element.locked,
        lockRotation: element.locked,
        lockScalingX: element.locked,
        lockScalingY: element.locked,
      };
      let changed = false;
      for (const [key, value] of Object.entries(props)) {
        if (object.get(key) !== value) {
          object.set(key, value);
          changed = true;
        }
      }
      if (changed) object.setCoords();
      return;
    }
    if (element.type === 'path' && object instanceof Path) {
      const mapped = elementToFabricProps(element, this.fabricContext);
      // Path's `path` is the SVG data — set separately
      const { path, fill, ...rest } = (mapped as { kind: 'path'; props: PathFabricProps }).props;
      const props: Record<string, unknown> = {
        ...rest,
        path,
        fill: this.paint(element.id, fill),
      };
      // Fabric Path stores path as array internally, but constructor uses string; updating path
      // requires setting `path` property and re-calculating dimensions.
      if ((object as unknown as { path: unknown }).path !== path) {
        (object as unknown as { set: (k: string, v: unknown) => void }).set('path', path);
        (object as unknown as { set: (k: string, v: unknown) => void }).set('pathOffset', {
          x: 0,
          y: 0,
        });
      }
      let changed = false;
      for (const [key, value] of Object.entries(props)) {
        if (key === 'path') continue;
        if (object.get(key) !== value) {
          object.set(key, value);
          changed = true;
        }
      }
      if (changed || object.get('path') !== path) object.setCoords();
      return;
    }
    if (element.type === 'image' && object instanceof FabricImage) {
      this.ensureImageLoading(object, element);
      // Apply flip/filters; FabricImage uses flipX/flipY from mapping, but filters need applyFilters()
      const f = element.filters ?? { brightness: 100, contrast: 100, saturate: 100, blur: 0 };
      const desired = buildFabricFilters(f);
      const cur = (object as unknown as { filters: unknown[] }).filters as unknown[] | undefined;
      const same =
        cur?.length === desired.length &&
        cur?.every(
          (_, i) => (cur[i] as { type?: string })?.type === (desired[i] as { type?: string })?.type,
        );
      if (!same) {
        (object as unknown as { filters: unknown[] }).filters = desired as unknown[];
        try {
          (object as unknown as { applyFilters: () => void }).applyFilters();
        } catch {
          // filter backend may not be ready (e.g. in tests without node-canvas) — ignore
        }
      }
    }
    // Groups have no mapping; non-group elements go through the standard path
    if (element.type === 'group') return;
    const mapped = elementToFabricProps(element, this.fabricContext);
    const props: Record<string, unknown> = { ...mapped.props };
    // Rectangles and ellipses may be gradient-filled; the mapped fill is data, the canvas needs
    // an object. (Text and images have plain colour fills.)
    if ((element.type === 'rect' || element.type === 'ellipse') && 'fill' in props) {
      props['fill'] = this.paint(element.id, props['fill'] as FabricFill);
    }
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

    this.canvas.on('text:editing:entered', () => {
      this.callbacks.onTextEditingChanged?.(true);
    });

    this.canvas.on('text:editing:exited', (event) => {
      this.callbacks.onTextEditingChanged?.(false);
      if (this.applying) return;
      const id = this.idsByObject.get(event.target);
      if (!id) return;
      this.callbacks.onTextCommitted(id, event.target.text, roundTo(event.target.height));
    });

    this.canvas.on('mouse:down', () => {
      this.callbacks.onInteractionChanged?.(true);
    });
    this.canvas.on('mouse:up', () => {
      this.callbacks.onInteractionChanged?.(false);
      this.callbacks.onViewportChanged?.();
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
    case 'path':
      return object instanceof Path;
    case 'icon':
      // An icon is a group of paths; `iconSignatures` tells it apart from a group element.
      return object instanceof Group;
    case 'group':
      return object instanceof Group;
  }
}

/** Everything baked into an icon's child paths, so a change to any of it means a rebuild. */
function iconSignature(element: { iconId: string; color: string; strokeWidth: number }): string {
  return `${element.iconId}\u0000${element.color}\u0000${element.strokeWidth}`;
}
