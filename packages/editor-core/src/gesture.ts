import { clampZoom } from './zoom';

/**
 * The maths behind two-finger zoom and pan, with no DOM in sight.
 *
 * Touch handling is the kind of code that rots quietly: it only runs on hardware most people
 * testing the app do not have, so a regression can sit unnoticed for months. Keeping the
 * arithmetic pure means the awkward parts — a finger lifting mid-gesture, a pinch that is
 * really a two-finger drag, a zoom that would exceed the limits — are ordinary unit tests.
 */

export interface TouchPoint {
  /** Identifies one finger across the gesture; fingers can lift and land in any order. */
  id: number;
  /** Position in the canvas element's own coordinate space. */
  x: number;
  y: number;
}

export interface PinchState {
  /** The two fingers the gesture is tracking, in the order they were adopted. */
  readonly ids: readonly [number, number];
  /** Distance between them when the gesture last updated. */
  readonly distance: number;
  /** Midpoint between them when the gesture last updated. */
  readonly center: { x: number; y: number };
  /** Zoom when the gesture last updated. */
  readonly zoom: number;
  /** How far the fingers have travelled since the gesture began, in pixels. */
  readonly travel: number;
  /** How much the span has changed since the gesture began, as a ratio away from 1. */
  readonly spread: number;
}

export interface PinchUpdate {
  readonly state: PinchState;
  /** Zoom to apply, already clamped to the editor's limits. */
  readonly zoom: number;
  /** Point to zoom about, in canvas coordinates. */
  readonly focus: { x: number; y: number };
  /** Pan to apply, in viewport pixels, from the fingers moving together. */
  readonly panX: number;
  readonly panY: number;
}

function distanceBetween(a: TouchPoint, b: TouchPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function centerOf(a: TouchPoint, b: TouchPoint): { x: number; y: number } {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function pair(touches: readonly TouchPoint[], ids?: readonly [number, number]) {
  if (!ids) {
    const [a, b] = touches;
    return a && b ? ([a, b] as const) : null;
  }
  const a = touches.find((touch) => touch.id === ids[0]);
  const b = touches.find((touch) => touch.id === ids[1]);
  return a && b ? ([a, b] as const) : null;
}

/**
 * Starts tracking a pinch. Returns null unless at least two fingers are down — a gesture is
 * never guessed from one finger, because that is a drag and belongs to the canvas.
 */
export function beginPinch(touches: readonly TouchPoint[], zoom: number): PinchState | null {
  const found = pair(touches);
  if (!found) return null;
  const [a, b] = found;
  const distance = distanceBetween(a, b);
  // Two fingers in exactly the same spot carry no scale information; wait for them to separate.
  if (distance < 1) return null;
  return {
    ids: [a.id, b.id],
    distance,
    center: centerOf(a, b),
    zoom,
    travel: 0,
    spread: 0,
  };
}

/**
 * Advances a pinch. Returns null when the tracked fingers are no longer both down, which is the
 * caller's cue to end the gesture (or restart it from whatever is still touching).
 */
export function updatePinch(state: PinchState, touches: readonly TouchPoint[]): PinchUpdate | null {
  const found = pair(touches, state.ids);
  if (!found) return null;
  const [a, b] = found;
  const distance = distanceBetween(a, b);
  if (distance < 1) return null;
  const center = centerOf(a, b);

  const scale = distance / state.distance;
  const zoom = clampZoom(state.zoom * scale);
  // The pan comes from the midpoint moving, so a two-finger drag pans even when the span is
  // unchanged, and a pinch that drifts keeps the content under the fingers.
  const panX = center.x - state.center.x;
  const panY = center.y - state.center.y;

  return {
    state: {
      ids: state.ids,
      distance,
      center,
      // Track the clamped value: at the limit the gesture must not bank up invisible zoom and
      // then lurch when the fingers reverse.
      zoom,
      travel: state.travel + Math.hypot(panX, panY),
      spread: state.spread + Math.abs(scale - 1),
    },
    zoom,
    focus: center,
    panX,
    panY,
  };
}

/** Pixels of finger travel, or span change, before a two-finger touch counts as a gesture. */
export const PINCH_SLOP = 6;
export const SPREAD_SLOP = 0.02;

/**
 * Whether the fingers have moved enough to call this a gesture.
 *
 * Resting two fingers on the screen should not nudge the view, and a tap that happens to land
 * with two fingers should not count as a zoom.
 */
export function pinchExceedsSlop(state: PinchState): boolean {
  return state.travel >= PINCH_SLOP || state.spread >= SPREAD_SLOP;
}
