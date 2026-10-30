import type { DesignElement, DocumentSize } from '@opencanvas/document';

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Fits template content designed for one canvas size onto a page of another size:
 * a uniform scale (never stretching), centred on the page. Text sizes, stroke widths,
 * corner radii and path points scale with the geometry so the composition keeps its
 * proportions instead of just moving boxes around.
 */
export function fitElementsToSize(
  elements: readonly DesignElement[],
  from: DocumentSize,
  to: DocumentSize,
): DesignElement[] {
  if (from.width <= 0 || from.height <= 0) return [...elements];
  const scale = Math.min(to.width / from.width, to.height / from.height);
  const offsetX = (to.width - from.width * scale) / 2;
  const offsetY = (to.height - from.height * scale) / 2;

  // Group children are stored relative to the group origin, so they scale but never take the
  // page-level centring offset.
  const fit = (element: DesignElement, applyOffset: boolean): DesignElement => {
    // A thin rule drawn on an A4 poster is one unit tall; scaling it onto a 1080 canvas would
    // round it to zero and the document schema (rightly) rejects that. Keep every box visible.
    const geometry = {
      x: round(element.x * scale + (applyOffset ? offsetX : 0)),
      y: round(element.y * scale + (applyOffset ? offsetY : 0)),
      width: Math.max(1, round(element.width * scale)),
      height: Math.max(1, round(element.height * scale)),
    };

    switch (element.type) {
      case 'rect':
        return {
          ...element,
          ...geometry,
          cornerRadius: round(element.cornerRadius * scale),
          ...(element.stroke
            ? { stroke: { ...element.stroke, width: round(element.stroke.width * scale) } }
            : {}),
        };
      case 'ellipse':
        return {
          ...element,
          ...geometry,
          ...(element.stroke
            ? { stroke: { ...element.stroke, width: round(element.stroke.width * scale) } }
            : {}),
        };
      case 'text':
        return {
          ...element,
          ...geometry,
          fontSize: Math.max(1, round(element.fontSize * scale)),
          letterSpacing: round(element.letterSpacing * scale),
        };
      case 'image':
      case 'icon':
      case 'frame':
        // An icon's stroke width is measured on its own 24-unit grid, so it scales with the box.
        return { ...element, ...geometry };
      case 'path':
        return {
          ...element,
          ...geometry,
          points: element.points.map((point) => ({
            x: round(point.x * scale),
            y: round(point.y * scale),
          })),
          stroke: { ...element.stroke, width: round(element.stroke.width * scale) },
        };
      case 'group':
        return {
          ...element,
          ...geometry,
          children: element.children.map((child) => fit(child, false)),
        };
    }
  };

  return elements.map((element) => fit(element, true));
}

/** How page content should adapt when the canvas changes size. */
export type ResizeAdaptMode = 'fit' | 'scale';

/**
 * Stretches content to fill a page of another size: positions and boxes scale per axis, so
 * the composition touches every edge of the new page instead of letterboxing. Text scales
 * with the horizontal factor, which preserves line wrapping; stroke widths and corner radii
 * use the average factor so they stay proportionate on either axis. Aspect ratios of images
 * and frames are intentionally changed — callers must say so in the UI ("Stretch to fill").
 */
export function scaleElementsToSize(
  elements: readonly DesignElement[],
  from: DocumentSize,
  to: DocumentSize,
): DesignElement[] {
  if (from.width <= 0 || from.height <= 0) return [...elements];
  const scaleX = to.width / from.width;
  const scaleY = to.height / from.height;
  const average = (scaleX + scaleY) / 2;

  const scale = (element: DesignElement): DesignElement => {
    const geometry = {
      x: round(element.x * scaleX),
      y: round(element.y * scaleY),
      width: Math.max(1, round(element.width * scaleX)),
      height: Math.max(1, round(element.height * scaleY)),
    };

    switch (element.type) {
      case 'rect':
        return {
          ...element,
          ...geometry,
          cornerRadius: round(element.cornerRadius * average),
          ...(element.stroke
            ? { stroke: { ...element.stroke, width: round(element.stroke.width * average) } }
            : {}),
        };
      case 'ellipse':
        return {
          ...element,
          ...geometry,
          ...(element.stroke
            ? { stroke: { ...element.stroke, width: round(element.stroke.width * average) } }
            : {}),
        };
      case 'text':
        return {
          ...element,
          ...geometry,
          fontSize: Math.max(1, round(element.fontSize * scaleX)),
          letterSpacing: round(element.letterSpacing * scaleX),
        };
      case 'image':
      case 'icon':
      case 'frame':
        return { ...element, ...geometry };
      case 'path':
        return {
          ...element,
          ...geometry,
          points: element.points.map((point) => ({
            x: round(point.x * scaleX),
            y: round(point.y * scaleY),
          })),
          stroke: { ...element.stroke, width: round(element.stroke.width * average) },
        };
      case 'group':
        return { ...element, ...geometry, children: element.children.map(scale) };
    }
  };

  return elements.map(scale);
}

/** Adapts page content to a new canvas size with the chosen strategy. */
export function adaptElementsToSize(
  elements: readonly DesignElement[],
  from: DocumentSize,
  to: DocumentSize,
  mode: ResizeAdaptMode,
): DesignElement[] {
  return mode === 'fit'
    ? fitElementsToSize(elements, from, to)
    : scaleElementsToSize(elements, from, to);
}
