import { createGroupElement, createRectElement, type ElementAnimation } from '@opencanvas/document';
import { describe, expect, it } from 'vitest';

import {
  animationEndTime,
  animationStateAt,
  cubicBezierEasing,
  elementsAnimationEnd,
  hasElementAnimations,
  isSettledAnimationState,
  SETTLED_ANIMATION_STATE,
} from './animation';

const rise: ElementAnimation = { type: 'rise', duration: 1, delay: 0 };

describe('cubicBezierEasing', () => {
  it('pins both ends and stays inside them', () => {
    const ease = cubicBezierEasing(0.16, 1, 0.3, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-1)).toBe(0);
    expect(ease(2)).toBe(1);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(ease(t)).toBeGreaterThan(0);
      expect(ease(t)).toBeLessThan(1);
    }
  });

  it('never goes backwards', () => {
    const ease = cubicBezierEasing(0.16, 1, 0.3, 1);
    let previous = 0;
    for (let i = 1; i <= 50; i += 1) {
      const value = ease(i / 50);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('front-loads the motion the way the stylesheet promises', () => {
    // cubic-bezier(0.16, 1, 0.3, 1) is an "ease-out back off": most of the distance is covered
    // early. Halfway through the time, well over half the distance is done.
    const ease = cubicBezierEasing(0.16, 1, 0.3, 1);
    expect(ease(0.5)).toBeGreaterThan(0.85);
  });

  it('matches linear when the control points are linear', () => {
    const ease = cubicBezierEasing(0.25, 0.25, 0.75, 0.75);
    expect(ease(0.5)).toBeCloseTo(0.5, 5);
    expect(ease(0.25)).toBeCloseTo(0.25, 4);
  });
});

describe('animationStateAt', () => {
  it('holds the first frame during the delay, like animation-fill-mode: both', () => {
    const delayed: ElementAnimation = { type: 'fade', duration: 0.5, delay: 2 };
    expect(animationStateAt(delayed, 0).opacity).toBe(0);
    expect(animationStateAt(delayed, 1.99).opacity).toBe(0);
    // ...and only then starts moving.
    expect(animationStateAt(delayed, 2.25).opacity).toBeGreaterThan(0);
  });

  it('settles exactly on the drawn element once it is over', () => {
    expect(animationStateAt(rise, 1)).toEqual(SETTLED_ANIMATION_STATE);
    expect(animationStateAt(rise, 99)).toEqual(SETTLED_ANIMATION_STATE);
    expect(isSettledAnimationState(animationStateAt(rise, 1))).toBe(true);
  });

  it('interpolates every channel the keyframes touch', () => {
    const mid = animationStateAt(rise, 0.5);
    expect(mid.opacity).toBeGreaterThan(0);
    expect(mid.opacity).toBeLessThan(1);
    // `rise` starts 24 units low and climbs; it never overshoots above the resting position.
    expect(mid.translateY).toBeGreaterThan(0);
    expect(mid.translateY).toBeLessThan(24);
    expect(mid.translateX).toBe(0);
    expect(mid.scale).toBe(1);
    expect(mid.blur).toBe(0);
  });

  it('gives each entrance its own starting pose', () => {
    const at = (type: ElementAnimation['type']) =>
      animationStateAt({ type, duration: 1, delay: 0 }, 0);
    expect(at('fade')).toMatchObject({ opacity: 0, translateX: 0, translateY: 0, scale: 1 });
    expect(at('rise')).toMatchObject({ translateY: 24 });
    expect(at('pop')).toMatchObject({ scale: 0.82 });
    expect(at('pan')).toMatchObject({ translateX: -32 });
    expect(at('blur')).toMatchObject({ blur: 10 });
  });

  it('survives a time that is not a number', () => {
    expect(animationStateAt(rise, Number.NaN).opacity).toBe(0);
  });
});

describe('page timing', () => {
  function rect(id: string, animation?: ElementAnimation) {
    const element = createRectElement({ id, x: 0, y: 0, width: 10, height: 10 });
    return animation ? { ...element, animation } : element;
  }

  it('ends when the slowest entrance ends, counting the delay', () => {
    const elements = [
      rect('a', { type: 'fade', duration: 0.6, delay: 0 }),
      rect('b', { type: 'pop', duration: 0.4, delay: 1.5 }),
    ];
    expect(elementsAnimationEnd(elements)).toBeCloseTo(1.9, 5);
    expect(animationEndTime({ type: 'pop', duration: 0.4, delay: 1.5 })).toBeCloseTo(1.9, 5);
  });

  it('looks inside groups, where a child can animate on its own', () => {
    const group = createGroupElement([rect('child', { type: 'rise', duration: 1, delay: 2 })], {
      id: 'g1',
    });
    expect(elementsAnimationEnd([group])).toBeCloseTo(3, 5);
    expect(hasElementAnimations([group])).toBe(true);
  });

  it('ignores hidden elements, which are never drawn', () => {
    const hidden = { ...rect('h', { type: 'fade', duration: 5, delay: 5 }), visible: false };
    expect(elementsAnimationEnd([hidden, rect('v')])).toBe(0);
    expect(hasElementAnimations([hidden])).toBe(false);
  });

  it('reports no animation for a plain page', () => {
    expect(elementsAnimationEnd([rect('a'), rect('b')])).toBe(0);
    expect(hasElementAnimations([rect('a')])).toBe(false);
  });
});
