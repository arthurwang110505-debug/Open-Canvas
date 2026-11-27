import { useCallback, useRef, useState } from 'react';

/** Past this many pixels, letting go closes the sheet. */
export const DISMISS_DISTANCE = 96;

/** Or past this speed, in px/ms, however far it travelled — a flick should work. */
export const DISMISS_VELOCITY = 0.5;

/** Downward drag beyond the sheet's own height is resisted rather than followed. */
const RUBBER_BAND = 0.35;

export interface DragSample {
  y: number;
  at: number;
}

/**
 * How far the sheet should sit from its resting place for a finger at `current`.
 *
 * Dragging up is resisted instead of blocked: a sheet that simply stops feels broken, where one
 * that pushes back tells you the gesture is understood and there is nowhere further to go.
 */
export function sheetOffset(startY: number, currentY: number): number {
  const delta = currentY - startY;
  if (delta >= 0) return delta;
  return delta * RUBBER_BAND;
}

/** Whether letting go here should dismiss: far enough, or fast enough. */
export function shouldDismiss(offset: number, from: DragSample, to: DragSample): boolean {
  if (offset >= DISMISS_DISTANCE) return true;
  const elapsed = to.at - from.at;
  if (elapsed <= 0) return false;
  const velocity = (to.y - from.y) / elapsed;
  return velocity >= DISMISS_VELOCITY && offset > 16;
}

export interface SheetDismissOptions {
  /** Whether the sheet is currently on screen and draggable. */
  enabled: boolean;
  onDismiss: () => void;
}

export interface SheetDismiss {
  /** Spread onto the sheet's grab handle. */
  handleProps: {
    onTouchStart: (event: React.TouchEvent) => void;
  };
  /** Live offset in pixels; 0 when at rest. */
  offset: number;
  dragging: boolean;
}

/**
 * Swipe-down-to-close for a bottom sheet.
 *
 * Only the handle starts a drag. Making the whole sheet draggable is tempting, but it fights
 * every scrollable list inside it — and these panels are mostly scrollable lists.
 */
export function useSheetDismiss({ enabled, onDismiss }: SheetDismissOptions): SheetDismiss {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const state = useRef<{ startY: number; last: DragSample; previous: DragSample } | null>(null);

  // A sheet that closes while a finger is down must not reopen holding the old offset.
  // Adjusting during render rather than in an effect means it never paints one frame at the
  // stale position on the way back in. The gesture ref needs no reset here: a new touch
  // overwrites it, and the in-flight listeners detach themselves on touchend.
  const [wasEnabled, setWasEnabled] = useState(enabled);
  if (wasEnabled !== enabled) {
    setWasEnabled(enabled);
    setOffset(0);
    setDragging(false);
  }

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;
      const sample = { y: touch.clientY, at: Date.now() };
      state.current = { startY: touch.clientY, last: sample, previous: sample };
      setDragging(true);
      setOffset(0);

      const move = (moveEvent: TouchEvent) => {
        const current = state.current;
        const point = moveEvent.touches[0];
        if (!current || !point) return;
        // Claim the gesture so the page behind does not scroll with it.
        if (moveEvent.cancelable) moveEvent.preventDefault();
        current.previous = current.last;
        current.last = { y: point.clientY, at: Date.now() };
        setOffset(sheetOffset(current.startY, point.clientY));
      };

      const end = () => {
        const current = state.current;
        window.removeEventListener('touchmove', move);
        window.removeEventListener('touchend', end);
        window.removeEventListener('touchcancel', end);
        state.current = null;
        setDragging(false);
        setOffset(0);
        if (!current) return;
        const travelled = sheetOffset(current.startY, current.last.y);
        if (shouldDismiss(travelled, current.previous, current.last)) onDismiss();
      };

      window.addEventListener('touchmove', move, { passive: false });
      window.addEventListener('touchend', end);
      window.addEventListener('touchcancel', end);
    },
    [enabled, onDismiss],
  );

  return { handleProps: { onTouchStart }, offset, dragging };
}
