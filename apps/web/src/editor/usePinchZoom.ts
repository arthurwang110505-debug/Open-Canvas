import {
  beginPinch,
  pinchExceedsSlop,
  updatePinch,
  type PinchState,
  type TouchPoint,
} from '@opencanvas/editor-core';
import { useEffect, type RefObject } from 'react';

import type { FabricCanvasAdapter } from '@opencanvas/canvas-fabric';

/**
 * Two-finger zoom and pan on the canvas.
 *
 * The listeners are attached in the capture phase, so a two-finger touch is claimed before
 * Fabric sees it — otherwise the canvas reads the fingers as a drag and the design moves
 * instead of the view. One finger is left completely alone: that is still how you pick
 * something up and move it.
 */
export function usePinchZoom(
  containerRef: RefObject<HTMLDivElement | null>,
  adapterRef: RefObject<FabricCanvasAdapter | null>,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let pinch: PinchState | null = null;
    let active = false;

    const pointsFrom = (event: TouchEvent): TouchPoint[] => {
      const bounds = container.getBoundingClientRect();
      return Array.from(event.touches).map((touch) => ({
        id: touch.identifier,
        // Canvas-local coordinates: the focal point has to be where the fingers are on the
        // canvas, not where they are on the screen.
        x: touch.clientX - bounds.left,
        y: touch.clientY - bounds.top,
      }));
    };

    const stop = () => {
      if (active) adapterRef.current?.endViewportGesture();
      pinch = null;
      active = false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) {
        stop();
        return;
      }
      const adapter = adapterRef.current;
      if (!adapter) return;
      // Re-seed on every extra finger so the gesture does not jump when one lands or lifts.
      pinch = beginPinch(pointsFrom(event), adapter.getZoom());
      if (!pinch) return;
      event.preventDefault();
      event.stopPropagation();
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pinch) return;
      const adapter = adapterRef.current;
      if (!adapter) return;

      const update = updatePinch(pinch, pointsFrom(event));
      if (!update) {
        // A tracked finger lifted; pick the gesture back up from whatever is still down.
        stop();
        pinch = beginPinch(pointsFrom(event), adapter.getZoom());
        return;
      }
      pinch = update.state;

      event.preventDefault();
      event.stopPropagation();

      // Resting two fingers must not nudge the view, so nothing is applied — and the canvas is
      // not taken away from Fabric — until the gesture has clearly begun.
      if (!pinchExceedsSlop(pinch)) return;
      if (!active) {
        adapter.beginViewportGesture();
        active = true;
      }
      adapter.applyViewportGesture({
        zoom: update.zoom,
        focus: update.focus,
        panX: update.panX,
        panY: update.panY,
      });
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!pinch) return;
      if (event.touches.length >= 2) {
        // Still a pinch, just with different fingers: re-seed rather than drift.
        pinch = beginPinch(pointsFrom(event), adapterRef.current?.getZoom() ?? 1);
        return;
      }
      stop();
    };

    const options = { capture: true, passive: false } as const;
    container.addEventListener('touchstart', onTouchStart, options);
    container.addEventListener('touchmove', onTouchMove, options);
    container.addEventListener('touchend', onTouchEnd, options);
    container.addEventListener('touchcancel', onTouchEnd, options);
    return () => {
      stop();
      container.removeEventListener('touchstart', onTouchStart, options);
      container.removeEventListener('touchmove', onTouchMove, options);
      container.removeEventListener('touchend', onTouchEnd, options);
      container.removeEventListener('touchcancel', onTouchEnd, options);
    };
  }, [containerRef, adapterRef]);
}
