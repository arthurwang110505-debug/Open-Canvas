import type {
  DesignElement,
  EllipseElement,
  Fill,
  ImageElement,
  ImageFit,
  PathElement,
  PathPoint,
  RectElement,
  TextElement,
} from '@opencanvas/document';

/**
 * Pure conversion helpers between the OpenCanvas geometry convention and Fabric.js.
 *
 * OpenCanvas: `x`/`y` is the top-left corner of the un-rotated element; `rotation` (degrees)
 * is applied around that corner — identical to SVG `translate(x y) rotate(r)`.
 *
 * Fabric 7: `left`/`top` is the element *center* (origin defaults to center/center) and
 * `angle` rotates around it. Both conventions describe the same rigid transform, so the
 * conversion is a rotation of the half-size vector.
 *
 * This module intentionally does not import Fabric so it stays trivially unit-testable.
 */

export interface Point {
  x: number;
  y: number;
}

export interface BoxGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** Fabric reports its own transform in these terms (see `util.qrDecompose`). */
export interface DecomposedTransform {
  translateX: number;
  translateY: number;
  angle: number;
  scaleX: number;
  scaleY: number;
}

const DEG_TO_RAD = Math.PI / 180;

/** Keeps document values tidy: Fabric emits long floating tails after every interaction. */
export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function rotateVector(x: number, y: number, degrees: number): Point {
  const rad = degrees * DEG_TO_RAD;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
}

/** Center of a box expressed with the OpenCanvas (top-left + rotation) convention. */
export function topLeftToCenter(box: BoxGeometry): Point {
  const half = rotateVector(box.width / 2, box.height / 2, box.rotation);
  return { x: box.x + half.x, y: box.y + half.y };
}

/** Top-left corner for a box whose center, size and rotation are known. */
export function centerToTopLeft(
  center: Point,
  size: { width: number; height: number },
  rotation: number,
): Point {
  const half = rotateVector(size.width / 2, size.height / 2, rotation);
  return { x: center.x - half.x, y: center.y - half.y };
}

export function normalizeAngle(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Converts the transform Fabric reports after an interaction (center, angle, scale) back
 * into document geometry. Scale is baked into width/height so the document never stores
 * Fabric-specific scale factors.
 */
export function geometryFromTransform(
  transform: DecomposedTransform,
  unscaledSize: { width: number; height: number },
  minimumSize = 1,
): BoxGeometry {
  const width = Math.max(minimumSize, unscaledSize.width * transform.scaleX);
  const height = Math.max(minimumSize, unscaledSize.height * transform.scaleY);
  const rotation = normalizeAngle(transform.angle);
  const topLeft = centerToTopLeft(
    { x: transform.translateX, y: transform.translateY },
    { width, height },
    rotation,
  );
  return {
    x: roundTo(topLeft.x),
    y: roundTo(topLeft.y),
    width: roundTo(width),
    height: roundTo(height),
    rotation: roundTo(rotation),
  };
}

// ---------------------------------------------------------------------------
// Element -> Fabric option objects
// ---------------------------------------------------------------------------

/**
 * Fabric multiplies `fontSize * lineHeight` by this constant when measuring lines
 * (`FabricText._fontSizeMult`). Dividing it out makes the document's `lineHeight` behave like
 * CSS `line-height`, which is what exporters implement.
 */
export const FABRIC_FONT_SIZE_MULT = 1.13;

export function fillToFabric(fill: Fill): string {
  switch (fill.type) {
    case 'solid':
      return fill.color;
    case 'none':
      return '';
  }
}

export interface CommonFabricProps {
  left: number;
  top: number;
  angle: number;
  opacity: number;
  visible: boolean;
  scaleX: 1;
  scaleY: 1;
  lockMovementX: boolean;
  lockMovementY: boolean;
  lockRotation: boolean;
  lockScalingX: boolean;
  lockScalingY: boolean;
  hasControls: boolean;
}

export interface RectFabricProps extends CommonFabricProps {
  width: number;
  height: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeUniform: true;
  rx: number;
  ry: number;
}

export interface EllipseFabricProps extends CommonFabricProps {
  rx: number;
  ry: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeUniform: true;
}

export interface TextFabricProps extends CommonFabricProps {
  width: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  textAlign: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  charSpacing: number;
  underline: boolean;
  fill: string;
  editable: boolean;
}

/**
 * Fabric draws an image as `drawImage(source, cropX, cropY, width, height)` and then applies
 * `scaleX`/`scaleY`, so every fit mode is expressed as a crop window plus a scale.
 */
export interface ImageFitProps {
  width: number;
  height: number;
  cropX: number;
  cropY: number;
  scaleX: number;
  scaleY: number;
}

export interface ImageFabricProps
  extends Omit<CommonFabricProps, 'scaleX' | 'scaleY'>, ImageFitProps {
  /** Images never draw a stroke; a non-zero default would inflate the bounding box. */
  strokeWidth: 0;
  flipX: boolean;
  flipY: boolean;
}

export interface PathFabricProps extends CommonFabricProps {
  path: string;
  stroke: string;
  strokeWidth: number;
  strokeUniform: true;
  strokeLineCap: 'round';
  strokeLineJoin: 'round';
  fill: string;
}

export type ElementFabricProps =
  | { kind: 'rect'; props: RectFabricProps }
  | { kind: 'ellipse'; props: EllipseFabricProps }
  | { kind: 'text'; props: TextFabricProps }
  | { kind: 'image'; props: ImageFabricProps }
  | { kind: 'path'; props: PathFabricProps };

function commonProps(element: DesignElement): CommonFabricProps {
  const center = topLeftToCenter(element);
  return {
    left: center.x,
    top: center.y,
    angle: element.rotation,
    opacity: element.opacity,
    visible: element.visible,
    scaleX: 1,
    scaleY: 1,
    lockMovementX: element.locked,
    lockMovementY: element.locked,
    lockRotation: element.locked,
    lockScalingX: element.locked,
    lockScalingY: element.locked,
    hasControls: !element.locked,
  };
}

export function rectToFabricProps(element: RectElement): RectFabricProps {
  const radius = Math.min(element.cornerRadius, element.width / 2, element.height / 2);
  return {
    ...commonProps(element),
    width: element.width,
    height: element.height,
    fill: fillToFabric(element.fill),
    stroke: element.stroke?.color ?? '',
    strokeWidth: element.stroke?.width ?? 0,
    strokeUniform: true,
    rx: radius,
    ry: radius,
  };
}

export function pathPointsToData(points: readonly PathPoint[], closed: boolean): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  if (!first) return '';
  let d = `M ${first.x} ${first.y}`;
  for (const p of rest) d += ` L ${p.x} ${p.y}`;
  if (closed) d += ' Z';
  return d;
}

export function pathToFabricProps(element: PathElement): PathFabricProps {
  // Points are relative to element's top-left; Fabric Path with center origin needs them centered.
  // Shift so that path's center is at (0,0) in object space: subtract half width/height.
  const cx = element.width / 2;
  const cy = element.height / 2;
  const centered = element.points.map((p) => ({ x: p.x - cx, y: p.y - cy }));
  const d = pathPointsToData(centered, element.closed);
  return {
    ...commonProps(element),
    path: d,
    stroke: element.stroke.color,
    strokeWidth: element.stroke.width,
    strokeUniform: true,
    strokeLineCap: 'round',
    strokeLineJoin: 'round',
    fill: fillToFabric(element.fill),
  };
}

export function ellipseToFabricProps(element: EllipseElement): EllipseFabricProps {
  return {
    ...commonProps(element),
    rx: element.width / 2,
    ry: element.height / 2,
    fill: fillToFabric(element.fill),
    stroke: element.stroke?.color ?? '',
    strokeWidth: element.stroke?.width ?? 0,
    strokeUniform: true,
  };
}

export function textToFabricProps(element: TextElement): TextFabricProps {
  return {
    ...commonProps(element),
    width: element.width,
    text: element.text,
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    textAlign: element.textAlign,
    lineHeight: element.lineHeight / FABRIC_FONT_SIZE_MULT,
    // Fabric expresses letter spacing in thousandths of an em.
    charSpacing: (element.letterSpacing / element.fontSize) * 1000,
    underline: element.underline,
    fill: element.color,
    editable: !element.locked,
  };
}

export function imageCssFilter(filters: {
  brightness: number;
  contrast: number;
  saturate: number;
  blur: number;
}): string {
  const parts: string[] = [];
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturate !== 100) parts.push(`saturate(${filters.saturate}%)`);
  if (filters.blur) parts.push(`blur(${filters.blur}px)`);
  return parts.join(' ') || 'none';
}

/**
 * Computes the crop window and scale that place a `natural`-sized bitmap into `box`.
 *
 * - `cover`: scale uniformly until the box is filled, crop the overflow symmetrically.
 * - `fill`: stretch the whole bitmap to the box (non-uniform scale, no crop).
 * When `crop` is present (normalized 0-1 rect), it selects a sub-rect of the natural image
 * first; the fit is then applied inside that cropped region.
 */
export function computeImageFit(
  box: { width: number; height: number },
  natural: { width: number; height: number },
  fit: ImageFit,
  crop?: { x: number; y: number; width: number; height: number },
): ImageFitProps {
  // If a user crop is present, derive the effective natural size + offset
  let naturalWidth = Math.max(1, natural.width);
  let naturalHeight = Math.max(1, natural.height);
  let cropOffsetX = 0;
  let cropOffsetY = 0;
  if (crop) {
    const cw = Math.max(1, Math.round(naturalWidth * crop.width));
    const ch = Math.max(1, Math.round(naturalHeight * crop.height));
    cropOffsetX = Math.round(naturalWidth * crop.x);
    cropOffsetY = Math.round(naturalHeight * crop.y);
    naturalWidth = cw;
    naturalHeight = ch;
  }
  const boxWidth = Math.max(1, box.width);
  const boxHeight = Math.max(1, box.height);

  if (fit === 'fill') {
    return {
      width: naturalWidth,
      height: naturalHeight,
      cropX: cropOffsetX,
      cropY: cropOffsetY,
      scaleX: boxWidth / naturalWidth,
      scaleY: boxHeight / naturalHeight,
    };
  }

  const scale = Math.max(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const visibleWidth = Math.min(naturalWidth, boxWidth / scale);
  const visibleHeight = Math.min(naturalHeight, boxHeight / scale);
  return {
    width: visibleWidth,
    height: visibleHeight,
    cropX: cropOffsetX + (naturalWidth - visibleWidth) / 2,
    cropY: cropOffsetY + (naturalHeight - visibleHeight) / 2,
    scaleX: scale,
    scaleY: scale,
  };
}

/**
 * Props for an image element given the bitmap that is currently displayed for it. While the
 * real bitmap is still loading the adapter passes its placeholder size with `fit: 'fill'`
 * so the placeholder stretches over the whole box.
 */
export function imageToFabricProps(
  element: ImageElement,
  natural: { width: number; height: number },
  fit: ImageFit = element.fit,
): ImageFabricProps {
  const { scaleX: _sx, scaleY: _sy, ...common } = commonProps(element);
  return {
    ...common,
    strokeWidth: 0,
    flipX: element.flipH ?? false,
    flipY: element.flipV ?? false,
    ...computeImageFit(element, natural, fit, element.crop),
  };
}

export interface ElementToFabricContext {
  /** Bitmap size used for image elements (placeholder or decoded image). */
  imageSource: (element: ImageElement) => {
    natural: { width: number; height: number };
    fit: ImageFit;
  };
}

export function elementToFabricProps(
  element: DesignElement,
  context?: ElementToFabricContext,
): ElementFabricProps {
  switch (element.type) {
    case 'rect':
      return { kind: 'rect', props: rectToFabricProps(element) };
    case 'ellipse':
      return { kind: 'ellipse', props: ellipseToFabricProps(element) };
    case 'text':
      return { kind: 'text', props: textToFabricProps(element) };
    case 'image': {
      const source = context?.imageSource(element) ?? { natural: element, fit: 'fill' as const };
      return { kind: 'image', props: imageToFabricProps(element, source.natural, source.fit) };
    }
    case 'path':
      return { kind: 'path', props: pathToFabricProps(element) };
    case 'group':
      throw new Error(
        'Group elements are handled by FabricCanvasAdapter directly, not via elementToFabricProps.',
      );
  }
}

/**
 * Builds the document patch for an element after Fabric reports a transform. For text,
 * corner scaling changes the font size (as design tools do) instead of stretching glyphs.
 * For paths, points are scaled to match the new bounds.
 */
export function patchFromTransform(
  element: DesignElement,
  transform: DecomposedTransform,
  unscaledSize: { width: number; height: number },
): Partial<BoxGeometry> & { fontSize?: number; points?: PathPoint[] } {
  const geometry = geometryFromTransform(transform, unscaledSize);
  if (element.type === 'text') {
    const fontSize = roundTo(Math.max(1, element.fontSize * transform.scaleY));
    return { ...geometry, fontSize };
  }
  if (element.type === 'path') {
    const scaleX = transform.scaleX;
    const scaleY = transform.scaleY;
    // Points are relative to top-left; scaling stretches them from (0,0) origin.
    // For Fabric centered path, scaling is around center, but we approximate by scaling points.
    const points = element.points.map((p) => ({
      x: roundTo(p.x * scaleX),
      y: roundTo(p.y * scaleY),
    }));
    return { ...geometry, points };
  }
  return geometry;
}
