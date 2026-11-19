import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Circle,
  Cloud,
  Diamond,
  Heart,
  Hexagon,
  MessageSquare,
  Minus,
  Moon,
  Octagon,
  Pentagon,
  Plus,
  Ribbon,
  Sparkles,
  Square,
  Squircle,
  Star,
  Triangle,
} from 'lucide-react';
import type { ReactNode } from 'react';

import type { FrameKind, ShapeKind } from '../actions';

export interface ShapeItem {
  kind: ShapeKind;
  label: string;
  icon: ReactNode;
  keywords: string;
}

/**
 * The shape library, drawn from the same list the panel shows and the drag payload
 * accepts. Sprint 4 expanded the original eight primitives to 22 Canva-style shapes;
 * every entry is a real path/rect/ellipse the exporter can draw.
 */
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
    keywords: 'triangle',
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
  {
    kind: 'pentagon',
    label: 'Pentagon',
    icon: <Pentagon className="size-6" />,
    keywords: 'pentagon polygon five',
  },
  {
    kind: 'octagon',
    label: 'Octagon',
    icon: <Octagon className="size-6" />,
    keywords: 'octagon polygon eight stop',
  },
  {
    kind: 'diamond',
    label: 'Diamond',
    icon: <Diamond className="size-6" />,
    keywords: 'diamond rhombus gem',
  },
  {
    kind: 'arrow-right',
    label: 'Arrow right',
    icon: <ArrowRight className="size-6" />,
    keywords: 'arrow right direction next',
  },
  {
    kind: 'arrow-left',
    label: 'Arrow left',
    icon: <ArrowLeft className="size-6" />,
    keywords: 'arrow left direction back',
  },
  {
    kind: 'arrow-up',
    label: 'Arrow up',
    icon: <ArrowUp className="size-6" />,
    keywords: 'arrow up direction',
  },
  {
    kind: 'arrow-down',
    label: 'Arrow down',
    icon: <ArrowDown className="size-6" />,
    keywords: 'arrow down direction',
  },
  {
    kind: 'arrow-both',
    label: 'Double arrow',
    icon: <ArrowLeftRight className="size-6" />,
    keywords: 'double arrow both directions horizontal',
  },
  {
    kind: 'heart',
    label: 'Heart',
    icon: <Heart className="size-6" />,
    keywords: 'heart love',
  },
  {
    kind: 'plus',
    label: 'Plus',
    icon: <Plus className="size-6" />,
    keywords: 'plus cross add',
  },
  {
    kind: 'moon',
    label: 'Moon',
    icon: <Moon className="size-6" />,
    keywords: 'moon crescent night',
  },
  {
    kind: 'cloud',
    label: 'Cloud',
    icon: <Cloud className="size-6" />,
    keywords: 'cloud weather sky',
  },
  {
    kind: 'speech-bubble',
    label: 'Speech bubble',
    icon: <MessageSquare className="size-6" />,
    keywords: 'speech bubble chat message quote',
  },
  {
    kind: 'ribbon',
    label: 'Ribbon',
    icon: <Ribbon className="size-6" />,
    keywords: 'ribbon banner award',
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
