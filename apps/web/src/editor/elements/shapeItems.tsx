import { Circle, Hexagon, Minus, Sparkles, Square, Squircle, Star, Triangle } from 'lucide-react';
import type { ReactNode } from 'react';

import type { ShapeKind } from '../actions';

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
