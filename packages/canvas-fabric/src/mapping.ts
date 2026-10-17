import type {
  DesignElement,
  EllipseElement,
  Fill,
  ImageElement,
  ImageFit,
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
}

export type ElementFabricProps =
  | { kind: 'rect'; props: RectFabricProps }
  | { kind: 'ellipse'; props: EllipseFabricProps }
  | { kind: 'text'; props: TextFabricProps }
  | { kind: 'image'; props: ImageFabricProps };

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

/**
 * Computes the crop window and scale that place a `natural`-sized bitmap into `box`.
 *
 * - `cover`: scale uniformly until the box is filled, crop the overflow symmetrically.
 * - `fill`: stretch the whole bitmap to the box (non-uniform scale, no crop).
 */
export function computeImageFit(
  box: { width: number; height: number },
  natural: { width: number; height: number },
  fit: ImageFit,
): ImageFitProps {
  const naturalWidth = Math.max(1, natural.width);
  const naturalHeight = Math.max(1, natural.height);
  const boxWidth = Math.max(1, box.width);
  const boxHeight = Math.max(1, box.height);

  if (fit === 'fill') {
    return {
      width: naturalWidth,
      height: naturalHeight,
      cropX: 0,
      cropY: 0,
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
    cropX: (naturalWidth - visibleWidth) / 2,
    cropY: (naturalHeight - visibleHeight) / 2,
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
  return { ...common, strokeWidth: 0, ...computeImageFit(element, natural, fit) };
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
  }
}

/**
 * Builds the document patch for an element after Fabric reports a transform. For text,
 * corner scaling changes the font size (as design tools do) instead of stretching glyphs.
 */
export function patchFromTransform(
  element: DesignElement,
  transform: DecomposedTransform,
  unscaledSize: { width: number; height: number },
): Partial<BoxGeometry> & { fontSize?: number } {
  const geometry = geometryFromTransform(transform, unscaledSize);
  if (element.type === 'text') {
    const fontSize = roundTo(Math.max(1, element.fontSize * transform.scaleY));
    return { ...geometry, fontSize };
  }
  return geometry;
}
