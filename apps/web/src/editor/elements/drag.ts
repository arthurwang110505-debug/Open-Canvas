import type { DragEvent } from 'react';

import type { FrameKind, ShapeKind } from '../actions';

/**
 * What the Elements panel drags onto the canvas. A custom MIME type keeps these drags apart from
 * file drops (which are images) and from drags inside the layers panel (which reorder layers).
 */
export const ELEMENT_DRAG_MIME = 'application/x-opencanvas-element';

export type ElementDragPayload =
  | { kind: 'shape'; shape: ShapeKind }
  | { kind: 'frame'; frame: FrameKind }
  | { kind: 'icon'; iconId: string }
  | { kind: 'photo'; photoId: string };

const FRAME_KINDS: ReadonlySet<string> = new Set<FrameKind>([
  'frame-rect',
  'frame-rounded',
  'frame-ellipse',
  'frame-circle',
]);

const SHAPE_KINDS: ReadonlySet<string> = new Set<ShapeKind>([
  'rect',
  'rounded-rect',
  'ellipse',
  'line',
  'triangle',
  'star',
  'hexagon',
  'sparkle',
]);

/**
 * What the panel is currently dragging. Browsers only expose a drag's *types* during `dragover`
 * and guard the values until the drop, so the drop ghost reads the payload from here and the
 * drop itself re-reads (and re-validates) the real data transfer.
 */
let activeDrag: ElementDragPayload | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Validates whatever another window/handler put on the clipboard-like drag payload. */
export function parseElementDragPayload(raw: string): ElementDragPayload | null {
  if (raw.length === 0 || raw.length > 200) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed['kind'] === 'shape' && typeof parsed['shape'] === 'string') {
    return SHAPE_KINDS.has(parsed['shape'])
      ? { kind: 'shape', shape: parsed['shape'] as ShapeKind }
      : null;
  }
  if (parsed['kind'] === 'frame' && typeof parsed['frame'] === 'string') {
    return FRAME_KINDS.has(parsed['frame'])
      ? { kind: 'frame', frame: parsed['frame'] as FrameKind }
      : null;
  }
  if (parsed['kind'] === 'icon' && typeof parsed['iconId'] === 'string') {
    const iconId = parsed['iconId'];
    // Same shape the document schema enforces, so a drop can never create an invalid element.
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(iconId) && iconId.length <= 64
      ? { kind: 'icon', iconId }
      : null;
  }
  if (parsed['kind'] === 'photo' && typeof parsed['photoId'] === 'string') {
    const photoId = parsed['photoId'];
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(photoId) && photoId.length <= 64
      ? { kind: 'photo', photoId }
      : null;
  }
  return null;
}

export function readElementDragPayload(
  dataTransfer: DataTransfer | null,
): ElementDragPayload | null {
  if (!dataTransfer) return null;
  const raw =
    typeof dataTransfer.getData === 'function' ? dataTransfer.getData(ELEMENT_DRAG_MIME) : '';
  const parsed = parseElementDragPayload(raw);
  if (parsed) return parsed;
  // No readable value (mid-gesture in a browser): trust the panel's own in-flight payload, but
  // only when the transfer actually carries our type.
  return hasElementDrag(dataTransfer) ? activeDrag : null;
}

export function hasElementDrag(dataTransfer: DataTransfer | null): boolean {
  return dataTransfer !== null && Array.from(dataTransfer.types ?? []).includes(ELEMENT_DRAG_MIME);
}

/** Data-attributes every draggable panel item shares, so tests can find them like a pointer. */
export function elementDragProps(payload: ElementDragPayload): {
  draggable: true;
  onDragStart: (event: DragEvent) => void;
  onDragEnd: () => void;
} {
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => {
      activeDrag = payload;
      event.dataTransfer.setData(ELEMENT_DRAG_MIME, JSON.stringify(payload));
      event.dataTransfer.effectAllowed = 'copy';
    },
    onDragEnd: () => {
      activeDrag = null;
    },
  };
}
