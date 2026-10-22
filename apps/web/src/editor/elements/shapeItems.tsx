import { Circle, Hexagon, Minus, Sparkles, Square, Squircle, Star, Triangle } from 'lucide-react';
import type { ReactNode } from 'react';

import type { FrameKind, ShapeKind } from '../actions';

export interface ShapeItem {
  kind: ShapeKind;
  label: string;
  icon: ReactNode;
  keywords: string;
}

/** The eight primitives, drawn from the same list the panel shows and the drag payload accepts. */
export const SHAPE_ITEMS: readonly ShapeItem[] = [
  {
    kind: 'rect',
    label: 'Rectangle',
    icon: <Square className="size-6" />,
    keywords: 'rect square box',
  },
  {
    kind: 'rounded-rect',
    label: 'Rounded rectangle',
    icon: <Squircle className="size-6" />,
    keywords: 'rounded squircle pill',
  },
  {
    kind: 'ellipse',
    label: 'Ellipse',
    icon: <Circle className="size-6" />,
    keywords: 'circle oval ellipse',
  },
  {
    kind: 'line',
    label: 'Line',
    icon: <Minus className="size-6" />,
    keywords: 'line divider rule',
  },
  {
    kind: 'triangle',
    label: 'Triangle',
    icon: <Triangle className="size-6" />,
    keywords: 'triangle arrow',
  },
  {
    kind: 'star',
    label: 'Star',
    icon: <Star className="size-6" />,
    keywords: 'star favorite rating',
  },
  {
    kind: 'hexagon',
    label: 'Hexagon',
    icon: <Hexagon className="size-6" />,
    keywords: 'hexagon polygon',
  },
  {
    kind: 'sparkle',
    label: 'Sparkle',
    icon: <Sparkles className="size-6" />,
    keywords: 'sparkle magic shine',
  },
];

export function matchShape(item: ShapeItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return item.label.toLowerCase().includes(q) || item.keywords.includes(q) || item.kind.includes(q);
}

export interface FrameItem {
  kind: FrameKind;
  label: string;
  icon: ReactNode;
  keywords: string;
}

/**
 * Frames are masks that hold a photo. Only shapes the schema can express are offered — a frame
 * that could not be exported is worse than one that is missing from the panel.
 */
export const FRAME_ITEMS: readonly FrameItem[] = [
  {
    kind: 'frame-rect',
    label: 'Photo frame',
    icon: <Square className="size-6" />,
    keywords: 'frame photo portrait image',
  },
  {
    kind: 'frame-rounded',
    label: 'Rounded frame',
    icon: <Squircle className="size-6" />,
    keywords: 'frame rounded photo image',
  },
  {
    kind: 'frame-ellipse',
    label: 'Oval frame',
    icon: <Circle className="size-6" />,
    keywords: 'frame oval ellipse photo',
  },
  {
    kind: 'frame-circle',
    label: 'Circle frame',
    icon: <Circle className="size-6 [stroke-dasharray:2_2]" />,
    keywords: 'frame circle round avatar photo',
  },
];

export function matchFrame(item: FrameItem, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (term.length === 0) return true;
  return item.label.toLowerCase().includes(term) || item.keywords.includes(term);
}
