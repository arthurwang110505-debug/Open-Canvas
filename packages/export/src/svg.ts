import {
  clampedCornerRadius,
  err,
  findPage,
  linearGradientCoords,
  ok,
  type DesignDocument,
  type DesignElement,
  type EllipseElement,
  type Fill,
  type FrameElement,
  type GradientFill,
  type IconElement,
  type ImageAsset,
  type ImageElement,
  type Page,
  type PathElement,
  type RectElement,
  type Result,
  type Stroke,
  type TextElement,
} from '@opencanvas/document';
import { getIcon, ICON_VIEWBOX, type IconShape } from '@opencanvas/icons';

import { buildFontFaceCss, type EmbeddedFontFace } from './fonts';
import { TEXT_BASELINE_EM, wrapTextLines, type TextMeasurer } from './textLayout';
import { describeCause, type ExportError } from './types';

/** Turns an asset into an embeddable reference (a `data:` URL keeps the file portable). */
export type ImageHrefResolver = (asset: ImageAsset) => Promise<string> | string;

/**
 * Gradients are declared once per distinct paint and referenced by id. Ids are counters, never
 * document data, so a crafted document cannot smuggle markup into an attribute.
 */
interface RenderContext {
  hrefs: ReadonlyMap<string, string>;
  /** Natural sizes of the assets on the page, so frames can map a crop window into the photo. */
  assets: Readonly<Record<string, ImageAsset>>;
  measure?: TextMeasurer;
  gradientIds: Map<string, string>;
  gradients: string[];
  /** One `<clipPath>` per frame, referenced by the frame's own group. */
  clipPaths: string[];
}

export interface SvgPageOptions {
  /** Defaults to the first page. */
  pageId?: string;
  /** Multiplies the emitted width/height; the viewBox stays in document units. */
  scale?: number;
  /** Paints the page background. Default true. */
  background?: boolean;
  /** Renders elements the user hid. Default false. */
  includeHidden?: boolean;
  /** Required as soon as the page shows an image element. */
  resolveImageHref?: ImageHrefResolver;
  /** Enables word wrapping to the element width, matching the canvas. */
  measureText?: TextMeasurer;
  /**
   * Fonts to embed as `@font-face` rules. Data URLs make the SVG self-contained, so it keeps the
   * document's typefaces when opened elsewhere and when rasterized for PNG/PDF, where the page's
   * own font files are not available.
   */
  fontFaces?: readonly EmbeddedFontFace[];
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Characters XML 1.0 forbids even escaped; they would make the file unreadable. */
// eslint-disable-next-line no-control-regex -- the control ranges are exactly what must be stripped.
const ILLEGAL_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escapeXml(value: string): string {
  return value
    .replace(ILLEGAL_XML_CHARS, '')
    .replace(/[&<>"']/g, (character) => XML_ESCAPES[character] ?? character);
}

/** Keeps exported coordinates short without losing sub-pixel accuracy. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 100) / 100);
}

function clampScale(scale: number): number {
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(Math.max(scale, 0.05), 16);
}

/**
 * A gradient as an SVG `<linearGradient>`/`<radialGradient>` in `objectBoundingBox` units. The
 * canvas adapter uses Fabric's `percentage` units, which are the same fractions, so a gradient
 * sits identically on the canvas and in an exported file.
 */
function gradientMarkup(id: string, fill: GradientFill): string {
  const stops = fill.stops
    .map(
      (stop) =>
        `      <stop offset="${formatNumber(stop.offset)}" stop-color="${escapeXml(stop.color)}"/>`,
    )
    .join('\n');
  if (fill.type === 'linear') {
    const { x1, y1, x2, y2 } = linearGradientCoords(fill.angle);
    return [
      `    <linearGradient id="${id}" x1="${formatNumber(x1)}" y1="${formatNumber(
        y1,
      )}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}">`,
      stops,
      `    </linearGradient>`,
    ].join('\n');
  }
  return [
    `    <radialGradient id="${id}" cx="0.5" cy="0.5" r="0.5">`,
    stops,
    `    </radialGradient>`,
  ].join('\n');
}

function fillAttributes(fill: Fill, context: RenderContext): string {
  if (fill.type === 'none') return ' fill="none"';
  if (fill.type === 'solid') return ` fill="${escapeXml(fill.color)}"`;
  const signature = JSON.stringify(fill);
  let id = context.gradientIds.get(signature);
  if (!id) {
    id = `grad-${context.gradientIds.size + 1}`;
    context.gradientIds.set(signature, id);
    context.gradients.push(gradientMarkup(id, fill));
  }
  return ` fill="url(#${id})"`;
}

function strokeAttributes(stroke: Stroke | undefined): string {
  if (!stroke || stroke.width <= 0) return '';
  // Like the canvas renderer, the stroke straddles the shape's edge.
  return ` stroke="${escapeXml(stroke.color)}" stroke-width="${formatNumber(stroke.width)}"`;
}

function cornerRadius(element: RectElement): number {
  return Math.min(element.cornerRadius, element.width / 2, element.height / 2);
}

function renderRect(element: RectElement, context: RenderContext): string {
  const radius = cornerRadius(element);
  const rounded = radius > 0 ? ` rx="${formatNumber(radius)}"` : '';
  return `    <rect width="${formatNumber(element.width)}" height="${formatNumber(
    element.height,
  )}"${rounded}${fillAttributes(element.fill, context)}${strokeAttributes(element.stroke)}/>`;
}

function renderEllipse(element: EllipseElement, context: RenderContext): string {
  const rx = element.width / 2;
  const ry = element.height / 2;
  return `    <ellipse cx="${formatNumber(rx)}" cy="${formatNumber(ry)}" rx="${formatNumber(
    rx,
  )}" ry="${formatNumber(ry)}"${fillAttributes(element.fill, context)}${strokeAttributes(element.stroke)}/>`;
}

function textAnchor(alignment: TextElement['textAlign']): 'start' | 'middle' | 'end' {
  if (alignment === 'center') return 'middle';
  if (alignment === 'right') return 'end';
  // SVG has no justified text; it falls back to the start edge like the canvas does for one line.
  return 'start';
}

/**
 * The icon's shapes scaled from its 24×24 grid into the element box. Stroke width is a document
 * property expressed in grid units, so it scales with the icon exactly as it does on the canvas
 * (Fabric applies the same scale to a stroked path).
 */
export function iconSvgMarkup(element: IconElement): string {
  const icon = getIcon(element.iconId);
  // An id from a newer build cannot be drawn; the element stays in the document untouched so the
  // icon reappears when that build opens the file.
  if (!icon) return '';
  const shapes = icon.shapes
    .map(([tag, attributes]: IconShape) => {
      // Lucide marks the few solid details (e.g. the dots in `dice-5`) with `fill="currentColor"`.
      const filled = attributes['fill'] === 'currentColor';
      const attrs: Record<string, string> = {
        ...attributes,
        fill: filled ? element.color : 'none',
        stroke: filled ? 'none' : element.color,
        'stroke-width': String(element.strokeWidth),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      };
      return `      <${tag} ${Object.entries(attrs)
        .map(([key, value]) => `${key}="${escapeXml(value)}"`)
        .join(' ')}/>`;
    })
    .join('\n');
  const scaleX = element.width / ICON_VIEWBOX;
  const scaleY = element.height / ICON_VIEWBOX;
  return `    <g transform="scale(${formatNumber(scaleX)} ${formatNumber(scaleY)})">\n${shapes}\n    </g>`;
}

function renderText(element: TextElement, measure?: TextMeasurer): string {
  const lines = wrapTextLines(element, measure);
  const anchor = textAnchor(element.textAlign);
  const x = anchor === 'middle' ? element.width / 2 : anchor === 'end' ? element.width : 0;
  const lineHeight = element.fontSize * element.lineHeight;
  const decoration = element.underline ? ' text-decoration="underline"' : '';
  const spacing =
    element.letterSpacing !== 0 ? ` letter-spacing="${formatNumber(element.letterSpacing)}"` : '';
  const spans = lines
    .map((line, index) => {
      const y = element.fontSize * TEXT_BASELINE_EM + index * lineHeight;
      return `      <tspan x="${formatNumber(x)}" y="${formatNumber(y)}">${escapeXml(line)}</tspan>`;
    })
    .join('\n');
  return `    <text font-family="${escapeXml(element.fontFamily)}" font-size="${formatNumber(
    element.fontSize,
  )}" font-weight="${element.fontWeight}"${
    element.fontStyle === 'italic' ? ' font-style="italic"' : ''
  }${spacing}${decoration} fill="${escapeXml(element.color)}" text-anchor="${anchor}" xml:space="preserve">
${spans}
    </text>`;
}

function imageFilterStyle(filters: ImageElement['filters'] | undefined): string {
  if (!filters) return '';
  const parts: string[] = [];
  if (filters.brightness !== 100) parts.push(`brightness(${filters.brightness}%)`);
  if (filters.contrast !== 100) parts.push(`contrast(${filters.contrast}%)`);
  if (filters.saturate !== 100) parts.push(`saturate(${filters.saturate}%)`);
  if (filters.blur) parts.push(`blur(${formatNumber(filters.blur)}px)`);
  if (parts.length === 0) return '';
  return ` style="filter: ${parts.join(' ')};"`;
}

function renderImage(element: ImageElement, hrefs: ReadonlyMap<string, string>): string {
  const href = hrefs.get(element.assetId) ?? '';
  const aspect = element.fit === 'fill' ? 'none' : 'xMidYMid slice';
  const flipH = element.flipH ?? false;
  const flipV = element.flipV ?? false;
  let transform = '';
  if (flipH || flipV) {
    const sx = flipH ? -1 : 1;
    const sy = flipV ? -1 : 1;
    const tx = flipH ? -element.width : 0;
    const ty = flipV ? -element.height : 0;
    transform = ` transform="scale(${sx} ${sy}) translate(${formatNumber(tx)} ${formatNumber(ty)})"`;
  }
  const filter = imageFilterStyle(element.filters);
  return `    <image href="${escapeXml(href)}" width="${formatNumber(element.width)}" height="${formatNumber(element.height)}" preserveAspectRatio="${aspect}"${transform}${filter}/>`;
}

/**
 * A frame is its shape used as a mask. The photo is drawn inside a nested `<svg>` whose viewBox is
 * the crop window, so `slice`/`none` reproduce the canvas's cover/fill maths with the same source
 * region — including a user crop, which applies in source pixels before any scaling.
 */
function renderFrame(element: FrameElement, context: RenderContext): string {
  const width = formatNumber(element.width);
  const height = formatNumber(element.height);
  const radius = clampedCornerRadius(element.cornerRadius, element.width, element.height);
  const id = `frame-${context.clipPaths.length + 1}`;
  const mask =
    element.shape === 'ellipse'
      ? `<ellipse cx="${formatNumber(element.width / 2)}" cy="${formatNumber(
          element.height / 2,
        )}" rx="${formatNumber(element.width / 2)}" ry="${formatNumber(element.height / 2)}"/>`
      : `<rect width="${width}" height="${height}"${
          radius > 0 ? ` rx="${formatNumber(radius)}" ry="${formatNumber(radius)}"` : ''
        }/>`;
  context.clipPaths.push(`    <clipPath id="${id}">${mask}</clipPath>`);

  const lines = [
    `    <g clip-path="url(#${id})">`,
    `      <rect width="${width}" height="${height}"${fillAttributes(element.fill, context)}/>`,
  ];
  if (element.assetId !== undefined) {
    const asset = context.assets[element.assetId];
    const href = context.hrefs.get(element.assetId) ?? '';
    if (asset && href.length > 0) {
      const crop = element.crop ?? { x: 0, y: 0, width: 1, height: 1 };
      const window = [
        formatNumber(crop.x * asset.width),
        formatNumber(crop.y * asset.height),
        formatNumber(crop.width * asset.width),
        formatNumber(crop.height * asset.height),
      ].join(' ');
      const aspect = element.fit === 'fill' ? 'none' : 'xMidYMid slice';
      lines.push(
        `      <svg width="${width}" height="${height}" viewBox="${window}" preserveAspectRatio="${aspect}">`,
        `        <image href="${escapeXml(href)}" width="${asset.width}" height="${asset.height}"/>`,
        `      </svg>`,
      );
    }
  }
  lines.push('    </g>');
  return lines.join('\n');
}

function renderPath(element: PathElement, context: RenderContext): string {
  if (element.points.length === 0) return '';
  const [first, ...rest] = element.points;
  if (!first) return '';
  let d = `M ${formatNumber(first.x)} ${formatNumber(first.y)}`;
  for (const p of rest) d += ` L ${formatNumber(p.x)} ${formatNumber(p.y)}`;
  if (element.closed) d += ' Z';
  const stroke =
    element.stroke.width > 0
      ? ` stroke="${escapeXml(element.stroke.color)}" stroke-width="${formatNumber(element.stroke.width)}" stroke-linecap="round" stroke-linejoin="round"`
      : '';
  const fill = fillAttributes(element.fill, context);
  return `    <path d="${d}"${fill}${stroke}/>`;
}

/** Image elements and filled frames both need their asset's bytes embedded. */
type ImageSourceElement = ImageElement | (FrameElement & { assetId: string });

function collectImages(elements: readonly DesignElement[]): ImageSourceElement[] {
  const out: ImageSourceElement[] = [];
  const walk = (list: readonly DesignElement[]) => {
    for (const el of list) {
      if (el.type === 'image') out.push(el);
      else if (el.type === 'frame' && el.assetId !== undefined) {
        out.push(el as FrameElement & { assetId: string });
      } else if (el.type === 'group') walk(el.children);
    }
  };
  walk(elements);
  return out;
}

function renderElement(element: DesignElement, context: RenderContext): string {
  const rotation = element.rotation !== 0 ? ` rotate(${formatNumber(element.rotation)})` : '';
  const opacity = element.opacity < 1 ? ` opacity="${formatNumber(element.opacity)}"` : '';
  if (element.type === 'group') {
    const inner = element.children.map((child) => renderElement(child, context)).join('\n');
    // Group itself is a container; its children are already positioned relative to group's origin
    return `  <g transform="translate(${formatNumber(element.x)} ${formatNumber(element.y)})${rotation}"${opacity}>\n${inner}\n  </g>`;
  }
  let shape: string;
  switch (element.type) {
    case 'rect':
      shape = renderRect(element, context);
      break;
    case 'ellipse':
      shape = renderEllipse(element, context);
      break;
    case 'text':
      shape = renderText(element, context.measure);
      break;
    case 'image':
      shape = renderImage(element, context.hrefs);
      break;
    case 'path':
      shape = renderPath(element, context);
      break;
    case 'icon':
      shape = iconSvgMarkup(element);
      break;
    case 'frame':
      shape = renderFrame(element, context);
      break;
  }
  return `  <g transform="translate(${formatNumber(element.x)} ${formatNumber(
    element.y,
  )})${rotation}"${opacity}>
${shape}
  </g>`;
}

/**
 * Renders one page to a standalone SVG string, straight from the document model — no canvas
 * library and no DOM involved, so the output is identical in the browser, in tests and on a
 * server. Every value is escaped; nothing from the document is emitted as raw markup.
 */
export async function renderPageToSvg(
  document: DesignDocument,
  options: SvgPageOptions = {},
): Promise<Result<string, ExportError>> {
  const pageId = options.pageId ?? document.pages[0]?.id;
  const page: Page | undefined = pageId ? findPage(document, pageId) : undefined;
  if (!page) {
    return err({
      code: 'page-not-found',
      message: pageId
        ? `The document has no page with id "${pageId}".`
        : 'The document has no pages to export.',
    });
  }

  const elements = page.elements.filter(
    (element) => element.visible || options.includeHidden === true,
  );
  const hrefs = new Map<string, string>();
  const images = collectImages(elements);
  if (images.length > 0) {
    if (!options.resolveImageHref) {
      return err({
        code: 'image-resolver-required',
        message: 'This page contains images. Pass resolveImageHref so their bytes can be embedded.',
      });
    }
    for (const element of images) {
      const asset = document.assets[element.assetId];
      if (!asset) {
        return err({
          code: 'asset-missing',
          message: `The image element "${element.id}" references asset "${element.assetId}", which is missing from the document.`,
        });
      }
      if (hrefs.has(asset.id)) continue;
      try {
        hrefs.set(asset.id, await options.resolveImageHref(asset));
      } catch (cause) {
        return err({
          code: 'image-failed',
          message: `The image "${asset.name ?? asset.id}" could not be embedded: ${describeCause(
            cause,
          )}`,
          cause,
        });
      }
    }
  }

  const scale = clampScale(options.scale ?? 1);
  const { width, height } = document.size;
  const context: RenderContext = {
    hrefs,
    ...(options.measureText ? { measure: options.measureText } : {}),
    assets: document.assets,
    gradientIds: new Map(),
    gradients: [],
    clipPaths: [],
  };

  // The body is rendered first: it is what discovers which gradients (and therefore which
  // `<defs>` entries) the page needs.
  const body: string[] = [];
  if (options.background !== false && page.background.type !== 'none') {
    body.push(
      `  <rect width="${formatNumber(width)}" height="${formatNumber(
        height,
      )}"${fillAttributes(page.background, context)}/>`,
    );
  }
  for (const element of elements) {
    body.push(renderElement(element, context));
  }

  const defs: string[] = [];
  const fontCss = buildFontFaceCss(options.fontFaces ?? []);
  if (fontCss.length > 0) {
    defs.push(
      `    <style type="text/css">`,
      ...fontCss.split('\n').map((rule) => `      ${escapeXml(rule)}`),
      `    </style>`,
    );
  }
  defs.push(...context.gradients, ...context.clipPaths);

  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(
      width * scale,
    )}" height="${formatNumber(height * scale)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(
      height,
    )}">`,
    `  <title>${escapeXml(document.name)}</title>`,
  ];
  if (defs.length > 0) lines.push('  <defs>', ...defs, '  </defs>');
  lines.push(...body, '</svg>');
  return ok(lines.join('\n'));
}
