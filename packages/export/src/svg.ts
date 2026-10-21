import {
  err,
  findPage,
  ok,
  type DesignDocument,
  type DesignElement,
  type EllipseElement,
  type Fill,
  type ImageAsset,
  type ImageElement,
  type Page,
  type PathElement,
  type RectElement,
  type Result,
  type Stroke,
  type TextElement,
} from '@opencanvas/document';

import { buildFontFaceCss, type EmbeddedFontFace } from './fonts';
import { TEXT_BASELINE_EM, wrapTextLines, type TextMeasurer } from './textLayout';
import { describeCause, type ExportError } from './types';

/** Turns an asset into an embeddable reference (a `data:` URL keeps the file portable). */
export type ImageHrefResolver = (asset: ImageAsset) => Promise<string> | string;

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

function fillAttributes(fill: Fill): string {
  return fill.type === 'solid' ? ` fill="${escapeXml(fill.color)}"` : ' fill="none"';
}

function strokeAttributes(stroke: Stroke | undefined): string {
  if (!stroke || stroke.width <= 0) return '';
  // Like the canvas renderer, the stroke straddles the shape's edge.
  return ` stroke="${escapeXml(stroke.color)}" stroke-width="${formatNumber(stroke.width)}"`;
}

function cornerRadius(element: RectElement): number {
  return Math.min(element.cornerRadius, element.width / 2, element.height / 2);
}

function renderRect(element: RectElement): string {
  const radius = cornerRadius(element);
  const rounded = radius > 0 ? ` rx="${formatNumber(radius)}"` : '';
  return `    <rect width="${formatNumber(element.width)}" height="${formatNumber(
    element.height,
  )}"${rounded}${fillAttributes(element.fill)}${strokeAttributes(element.stroke)}/>`;
}

function renderEllipse(element: EllipseElement): string {
  const rx = element.width / 2;
  const ry = element.height / 2;
  return `    <ellipse cx="${formatNumber(rx)}" cy="${formatNumber(ry)}" rx="${formatNumber(
    rx,
  )}" ry="${formatNumber(ry)}"${fillAttributes(element.fill)}${strokeAttributes(element.stroke)}/>`;
}

function textAnchor(alignment: TextElement['textAlign']): 'start' | 'middle' | 'end' {
  if (alignment === 'center') return 'middle';
  if (alignment === 'right') return 'end';
  // SVG has no justified text; it falls back to the start edge like the canvas does for one line.
  return 'start';
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

function renderPath(element: PathElement): string {
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
  const fill = fillAttributes(element.fill);
  return `    <path d="${d}"${fill}${stroke}/>`;
}

function collectImages(elements: readonly DesignElement[]): ImageElement[] {
  const out: ImageElement[] = [];
  const walk = (list: readonly DesignElement[]) => {
    for (const el of list) {
      if (el.type === 'image') out.push(el);
      else if (el.type === 'group') walk(el.children);
    }
  };
  walk(elements);
  return out;
}

function renderElement(
  element: DesignElement,
  hrefs: ReadonlyMap<string, string>,
  measure?: TextMeasurer,
): string {
  const rotation = element.rotation !== 0 ? ` rotate(${formatNumber(element.rotation)})` : '';
  const opacity = element.opacity < 1 ? ` opacity="${formatNumber(element.opacity)}"` : '';
  if (element.type === 'group') {
    const inner = element.children.map((child) => renderElement(child, hrefs, measure)).join('\n');
    // Group itself is a container; its children are already positioned relative to group's origin
    return `  <g transform="translate(${formatNumber(element.x)} ${formatNumber(element.y)})${rotation}"${opacity}>\n${inner}\n  </g>`;
  }
  let shape: string;
  switch (element.type) {
    case 'rect':
      shape = renderRect(element);
      break;
    case 'ellipse':
      shape = renderEllipse(element);
      break;
    case 'text':
      shape = renderText(element, measure);
      break;
    case 'image':
      shape = renderImage(element, hrefs);
      break;
    case 'path':
      shape = renderPath(element);
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
  const lines: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(
      width * scale,
    )}" height="${formatNumber(height * scale)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(
      height,
    )}">`,
    `  <title>${escapeXml(document.name)}</title>`,
  ];
  const fontCss = buildFontFaceCss(options.fontFaces ?? []);
  if (fontCss.length > 0) {
    lines.push(
      `  <defs>`,
      `    <style type="text/css">`,
      ...fontCss.split('\n').map((rule) => `      ${escapeXml(rule)}`),
      `    </style>`,
      `  </defs>`,
    );
  }
  if (options.background !== false && page.background.type === 'solid') {
    lines.push(
      `  <rect width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${escapeXml(
        page.background.color,
      )}"/>`,
    );
  }
  for (const element of elements) {
    lines.push(renderElement(element, hrefs, options.measureText));
  }
  lines.push('</svg>');
  return ok(lines.join('\n'));
}
