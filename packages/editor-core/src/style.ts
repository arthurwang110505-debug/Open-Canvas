import type { DesignElement } from '@opencanvas/document';

import type { ElementPatch } from './commands';

/**
 * Visual properties that can travel from `source` to `target` without changing identity, content,
 * geometry, assets, crop, locking or visibility. Unsupported properties are simply omitted.
 */
export function compatibleStylePatch(source: DesignElement, target: DesignElement): ElementPatch {
  const patch: ElementPatch = { opacity: source.opacity };

  const sourceHasFill =
    source.type === 'rect' ||
    source.type === 'ellipse' ||
    source.type === 'path' ||
    source.type === 'frame';
  const targetHasFill =
    target.type === 'rect' ||
    target.type === 'ellipse' ||
    target.type === 'path' ||
    target.type === 'frame';
  if (sourceHasFill && targetHasFill) patch.fill = source.fill;

  const targetHasStroke =
    target.type === 'rect' || target.type === 'ellipse' || target.type === 'path';
  if (targetHasStroke) {
    if ('stroke' in source) patch.stroke = source.stroke;
    // Rectangles and ellipses can deliberately have no stroke; copying one clears the target's.
    else if (source.type === 'rect' || source.type === 'ellipse') patch.stroke = undefined;
  }

  if (
    (target.type === 'rect' || target.type === 'frame') &&
    (source.type === 'rect' || source.type === 'frame')
  ) {
    patch.cornerRadius = source.cornerRadius;
  }

  if (source.type === 'text' && target.type === 'text') {
    Object.assign(patch, {
      fontFamily: source.fontFamily,
      fontSize: source.fontSize,
      fontWeight: source.fontWeight,
      fontStyle: source.fontStyle,
      textAlign: source.textAlign,
      lineHeight: source.lineHeight,
      letterSpacing: source.letterSpacing,
      underline: source.underline,
      textTransform: source.textTransform,
      listStyle: source.listStyle,
    });
  }

  if (
    (source.type === 'text' || source.type === 'icon') &&
    (target.type === 'text' || target.type === 'icon')
  ) {
    patch.color = source.color;
  }

  if (source.type === 'icon' && target.type === 'icon') {
    patch.strokeWidth = source.strokeWidth;
  }

  if (source.type === 'image' && target.type === 'image') {
    patch.filters = source.filters;
  }

  return patch;
}
