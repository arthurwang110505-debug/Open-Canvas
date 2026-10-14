import type {
  DesignElement,
  EllipseElement,
  Fill,
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

export type ElementFabricProps =
  | { kind: 'rect'; props: RectFabricProps }
  | { kind: 'ellipse'; props: EllipseFabricProps }
  | { kind: 'text'; props: TextFabricProps };

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

export function elementToFabricProps(element: DesignElement): ElementFabricProps {
  switch (element.type) {
    case 'rect':
      return { kind: 'rect', props: rectToFabricProps(element) };
    case 'ellipse':
      return { kind: 'ellipse', props: ellipseToFabricProps(element) };
    case 'text':
      return { kind: 'text', props: textToFabricProps(element) };
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
