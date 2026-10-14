import type { DesignElement, DocumentSize, Page } from '@opencanvas/document';
import {
  ActiveSelection,
  Canvas,
  Ellipse,
  type FabricObject,
  InteractiveFabricObject,
  Point,
  Rect,
  Textbox,
  util,
  type TMat2D,
} from 'fabric';

import {
  elementToFabricProps,
  fillToFabric,
  patchFromTransform,
  roundTo,
  type BoxGeometry,
} from './mapping';

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
}

export interface CanvasScene {
  page: Page;
  size: DocumentSize;
  selectedIds: readonly string[];
}

export interface CanvasAdapterOptions {
  accentColor?: string;
}

const DEFAULT_ACCENT = '#4f46e5';
const MIN_ZOOM = 0.05;
const MAX_ZOOM = 8;

type ElementObject = Rect | Ellipse | Textbox;

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
  private elements = new Map<string, DesignElement>();
  private pageSize: DocumentSize = { width: 1, height: 1 };
  private applying = false;
  private disposed = false;

  constructor(
    element: HTMLCanvasElement,
    callbacks: CanvasAdapterCallbacks,
    options: CanvasAdapterOptions = {},
  ) {
    applySelectionStyle(options.accentColor ?? DEFAULT_ACCENT);
    this.callbacks = callbacks;
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

  /** Escape hatch for tests and advanced integrations. Prefer the typed API above. */
  getFabricCanvas(): Canvas {
    return this.canvas;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.objects.clear();
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
      }
    }
    this.elements = nextElements;
  }

  private replaceObject(
    element: DesignElement,
    existing: ElementObject | undefined,
  ): ElementObject {
    if (existing) this.canvas.remove(existing);
    const object = createObject(element);
    this.objects.set(element.id, object);
    this.idsByObject.set(object, element.id);
    this.canvas.add(object);
    return object;
  }

  private applyElement(object: ElementObject, element: DesignElement): void {
    const mapped = elementToFabricProps(element);
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
  }
}

function createObject(element: DesignElement): ElementObject {
  const mapped = elementToFabricProps(element);
  switch (mapped.kind) {
    case 'rect':
      return new Rect(mapped.props);
    case 'ellipse':
      return new Ellipse(mapped.props);
    case 'text':
      return new Textbox(mapped.props.text, { ...mapped.props, splitByGrapheme: false });
  }
}
