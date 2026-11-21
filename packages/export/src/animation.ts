import type { DesignElement, ElementAnimation, ElementAnimationType } from '@opencanvas/document';

/**
 * Sampling the entrance animations at a point in time.
 *
 * Present mode and shared links animate with CSS: the renderer tags each element with
 * `data-animate` and the stylesheet in `@opencanvas/ui` owns the keyframes. A video has no
 * stylesheet — every frame is drawn on its own — so the same motion has to be evaluated
 * numerically here. The two must agree, which is why this module mirrors the `element-*`
 * keyframes and the timing function from `theme.css` one for one. Change one, change both.
 */

/** `animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1)` in `theme.css`. */
export const ANIMATION_EASING: readonly [number, number, number, number] = [0.16, 1, 0.3, 1];

/** How far a Newton step may miss before the solver falls back to bisection. */
const EASING_PRECISION = 1e-6;

function bezierComponent(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return ((a * t + b) * t + c) * t;
}

function bezierSlope(t: number, a1: number, a2: number): number {
  const c = 3 * a1;
  const b = 3 * (a2 - a1) - c;
  const a = 1 - c - b;
  return (3 * a * t + 2 * b) * t + c;
}

/**
 * Solves a CSS `cubic-bezier` for a given progress. Newton-Raphson converges in a few steps for
 * the curves we use; bisection is the guard for the flat regions where the slope vanishes.
 */
export function cubicBezierEasing(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): (progress: number) => number {
  return (progress: number): number => {
    if (!Number.isFinite(progress)) return 0;
    if (progress <= 0) return 0;
    if (progress >= 1) return 1;

    let t = progress;
    for (let i = 0; i < 8; i += 1) {
      const x = bezierComponent(t, x1, x2) - progress;
      if (Math.abs(x) < EASING_PRECISION) return bezierComponent(t, y1, y2);
      const slope = bezierSlope(t, x1, x2);
      if (Math.abs(slope) < EASING_PRECISION) break;
      t -= x / slope;
    }

    let low = 0;
    let high = 1;
    t = progress;
    while (high - low > EASING_PRECISION) {
      const x = bezierComponent(t, x1, x2);
      if (x < progress) low = t;
      else high = t;
      t = (low + high) / 2;
    }
    return bezierComponent(t, y1, y2);
  };
}

const ease = cubicBezierEasing(...ANIMATION_EASING);

/**
 * What an entrance does to an element at one instant. Offsets are document units (the SVG user
 * space the page is drawn in), matching the pixel lengths in the stylesheet one to one.
 */
export interface ElementAnimationState {
  /** Multiplies the element's own opacity. */
  opacity: number;
  translateX: number;
  translateY: number;
  scale: number;
  /** Gaussian standard deviation, as CSS `blur()` defines it. */
  blur: number;
}

/** The element as the canvas draws it: what every entrance ends on, and every still export uses. */
export const SETTLED_ANIMATION_STATE: ElementAnimationState = {
  opacity: 1,
  translateX: 0,
  translateY: 0,
  scale: 1,
  blur: 0,
};

/**
 * The `from` frame of each `element-*` keyframe in `theme.css`. The `to` frame is always
 * `SETTLED_ANIMATION_STATE`, which is what makes an entrance safe to bake into a still.
 */
const ENTRANCE_FROM: Readonly<Record<ElementAnimationType, ElementAnimationState>> = {
  fade: { ...SETTLED_ANIMATION_STATE, opacity: 0 },
  rise: { ...SETTLED_ANIMATION_STATE, opacity: 0, translateY: 24 },
  pop: { ...SETTLED_ANIMATION_STATE, opacity: 0, scale: 0.82 },
  pan: { ...SETTLED_ANIMATION_STATE, opacity: 0, translateX: -32 },
  blur: { ...SETTLED_ANIMATION_STATE, opacity: 0, blur: 10 },
};

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** When the element has finished entering, measured from the moment the page appears. */
export function animationEndTime(animation: ElementAnimation): number {
  return animation.delay + animation.duration;
}

/**
 * The element's state `time` seconds after the page appeared.
 *
 * `animation-fill-mode: both` in the stylesheet means the element already shows its `from` frame
 * during the delay — an element with a one second delay is invisible at t=0 rather than popping
 * out of view when its turn comes. A video that ignored this would show every element at once on
 * the first frame.
 */
export function animationStateAt(animation: ElementAnimation, time: number): ElementAnimationState {
  const from = ENTRANCE_FROM[animation.type];
  if (!Number.isFinite(time) || time <= animation.delay) return { ...from };
  if (time >= animationEndTime(animation)) return { ...SETTLED_ANIMATION_STATE };

  const progress = (time - animation.delay) / animation.duration;
  const t = ease(progress);
  return {
    opacity: mix(from.opacity, 1, t),
    translateX: mix(from.translateX, 0, t),
    translateY: mix(from.translateY, 0, t),
    scale: mix(from.scale, 1, t),
    blur: mix(from.blur, 0, t),
  };
}

/** True when the state is indistinguishable from the element at rest. */
export function isSettledAnimationState(state: ElementAnimationState): boolean {
  return (
    state.opacity === 1 &&
    state.translateX === 0 &&
    state.translateY === 0 &&
    state.scale === 1 &&
    state.blur === 0
  );
}

function walk(elements: readonly DesignElement[], visit: (element: DesignElement) => void): void {
  for (const element of elements) {
    visit(element);
    if (element.type === 'group') walk(element.children, visit);
  }
}

/**
 * When the last entrance on these elements finishes. Groups are walked because a group and its
 * children can each carry their own animation, and both are emitted by the renderer.
 *
 * Hidden elements are skipped: they are not drawn, so they must not stretch a video either.
 */
export function elementsAnimationEnd(elements: readonly DesignElement[]): number {
  let end = 0;
  walk(elements, (element) => {
    if (!element.visible || !element.animation) return;
    end = Math.max(end, animationEndTime(element.animation));
  });
  return end;
}

/** Whether anything on these elements would move during playback. */
export function hasElementAnimations(elements: readonly DesignElement[]): boolean {
  let found = false;
  walk(elements, (element) => {
    if (element.visible && element.animation) found = true;
  });
  return found;
}
