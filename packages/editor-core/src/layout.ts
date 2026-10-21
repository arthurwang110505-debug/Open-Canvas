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
    const geometry = {
      x: round(element.x * scale + (applyOffset ? offsetX : 0)),
      y: round(element.y * scale + (applyOffset ? offsetY : 0)),
      width: round(element.width * scale),
      height: round(element.height * scale),
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
          fontSize: round(element.fontSize * scale),
          letterSpacing: round(element.letterSpacing * scale),
        };
      case 'image':
      case 'icon':
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
