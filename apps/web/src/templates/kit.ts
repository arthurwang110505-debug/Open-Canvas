import {
  CANVAS_PRESETS,
  createBlankDocument,
  createEllipseElement,
  createIconElement,
  createPathElement,
  createRectElement,
  createTextElement,
  type DesignDocument,
  type Page,
  type PathPoint,
  type RectElement,
  type TextElement,
} from '@opencanvas/document';

export function presetSize(presetId: string): { width: number; height: number } {
  const preset = CANVAS_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) throw new Error(`unknown preset ${presetId}`);
  return { width: preset.width, height: preset.height };
}

export interface TextOptions {
  /** Left edge, as a fraction of the page width. */
  x: number;
  /** Top edge, as a fraction of the page height. */
  y: number;
  /** Box width, as a fraction of the page width. */
  w: number;
  /** Font size as a fraction of the page's short side — so one layout fits every preset. */
  size: number;
  weight?: number;
  font?: string;
  color?: string;
  align?: 'left' | 'center' | 'right';
  lineHeight?: number;
  /** Letter spacing in ems (0.1 = a tenth of the font size). */
  tracking?: number;
  opacity?: number;
}

export interface RectOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  /** A colour, or `'none'` for an outline-only shape. */
  fill?: string;
  radius?: number;
  stroke?: { color: string; width: number };
  opacity?: number;
  rotation?: number;
}

export interface PolygonOptions {
  fill?: string;
  stroke?: { color: string; width: number };
  opacity?: number;
}

/**
 * Draws in fractions of the page, so every blueprint works in any preset: `x`/`w` are shares of
 * the width, `y`/`h` shares of the height, and type size is a share of the short side.
 */
export class Frame {
  readonly page: Page;
  readonly width: number;
  readonly height: number;
  private readonly short: number;

  constructor(document: DesignDocument) {
    this.page = document.pages[0]!;
    this.width = document.size.width;
    this.height = document.size.height;
    this.short = Math.min(this.width, this.height);
  }

  static document(options: { templateId: string; name: string; presetId: string }): {
    document: DesignDocument;
    frame: Frame;
  } {
    const { width, height } = presetSize(options.presetId);
    const document = createBlankDocument({
      width,
      height,
      name: options.name,
      templateId: options.templateId,
      source: 'template',
    });
    return { document, frame: new Frame(document) };
  }

  background(color: string): void {
    this.page.background = { type: 'solid', color };
  }

  /** Font size in page pixels for a fraction-of-short-side size. */
  px(size: number): number {
    return Math.max(8, Math.round(size * this.short));
  }

  text(content: string, options: TextOptions): TextElement {
    const fontSize = this.px(options.size);
    const lineHeight = options.lineHeight ?? 1.15;
    const lines = content.split('\n').length;
    const element = createTextElement({
      x: Math.round(options.x * this.width),
      y: Math.round(options.y * this.height),
      width: Math.round(options.w * this.width),
      height: Math.round(fontSize * lineHeight * lines + fontSize * 0.35),
      text: content,
      fontFamily: options.font ?? 'Inter',
      fontSize,
      fontWeight: options.weight ?? 400,
      color: options.color ?? '#111827',
      textAlign: options.align ?? 'left',
      lineHeight,
      letterSpacing: Math.round((options.tracking ?? 0) * fontSize),
      ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
    });
    this.page.elements.push(element);
    return element;
  }

  rect(options: RectOptions): RectElement {
    const element = createRectElement({
      x: Math.round(options.x * this.width),
      y: Math.round(options.y * this.height),
      width: Math.round(options.w * this.width),
      height: Math.round(options.h * this.height),
      fill:
        options.fill === 'none'
          ? { type: 'none' }
          : { type: 'solid', color: options.fill ?? '#111827' },
      cornerRadius: Math.round((options.radius ?? 0) * this.short),
      ...(options.stroke ? { stroke: options.stroke } : {}),
      ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
      ...(options.rotation !== undefined ? { rotation: options.rotation } : {}),
    });
    this.page.elements.push(element);
    return element;
  }

  /** A square in page pixels, so monograms and swatches do not stretch with the preset. */
  square(options: {
    x: number;
    y: number;
    size: number;
    /** A colour, or `'none'` for a ring. */
    fill?: string;
    radius?: number;
  }): void {
    this.rect({
      x: options.x,
      y: options.y,
      w: options.size,
      h: (options.size * this.width) / this.height,
      ...(options.fill ? { fill: options.fill } : {}),
      ...(options.radius !== undefined ? { radius: options.radius } : {}),
    });
  }

  circle(options: {
    x: number;
    y: number;
    size: number;
    /** A colour, or `'none'` for a ring. */
    fill?: string;
    stroke?: { color: string; width: number };
    opacity?: number;
    /** `size` is a share of the short side; circles stay circles. */
  }): void {
    const side = Math.round(options.size * this.short);
    this.page.elements.push(
      createEllipseElement({
        x: Math.round(options.x * this.width),
        y: Math.round(options.y * this.height),
        width: side,
        height: side,
        fill:
          options.fill === 'none'
            ? { type: 'none' }
            : { type: 'solid', color: options.fill ?? '#111827' },
        ...(options.stroke ? { stroke: options.stroke } : {}),
        ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
      }),
    );
  }

  /** A polygon from points in page pixels (callers usually derive them from the frame). */
  polygon(points: readonly PathPoint[], options: PolygonOptions = {}): void {
    this.page.elements.push(
      createPathElement(points, {
        fill: options.fill
          ? { type: 'solid', color: options.fill }
          : { type: 'solid', color: '#111827' },
        closed: true,
        ...(options.stroke ? { stroke: options.stroke } : {}),
        ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
      }),
    );
  }

  /** A straight rule between two fractions of the page. */
  rule(
    from: { x: number; y: number },
    to: { x: number; y: number },
    options: { color: string; width: number; opacity?: number } = {
      color: '#111827',
      width: 2,
    },
  ): void {
    this.page.elements.push(
      createPathElement(
        [
          { x: Math.round(from.x * this.width), y: Math.round(from.y * this.height) },
          { x: Math.round(to.x * this.width), y: Math.round(to.y * this.height) },
        ],
        {
          stroke: { color: options.color, width: options.width },
          fill: { type: 'none' },
          closed: false,
          ...(options.opacity !== undefined ? { opacity: options.opacity } : {}),
        },
      ),
    );
  }

  icon(
    iconId: string,
    options: { x: number; y: number; size: number; color?: string; strokeWidth?: number },
  ): void {
    const side = Math.round(options.size * this.short);
    this.page.elements.push(
      createIconElement({
        iconId,
        x: Math.round(options.x * this.width),
        y: Math.round(options.y * this.height),
        width: side,
        height: side,
        color: options.color ?? '#111827',
        ...(options.strokeWidth !== undefined ? { strokeWidth: options.strokeWidth } : {}),
      }),
    );
  }

  /** A filled pill with label text, used for calls to action. */
  pill(
    label: string,
    options: {
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      color?: string;
      size?: number;
      font?: string;
      weight?: number;
    },
  ): void {
    this.rect({
      x: options.x,
      y: options.y,
      w: options.w,
      h: options.h,
      fill: options.fill ?? '#111827',
      radius: options.h / 2,
    });
    const pillHeight = (options.h * this.height) / this.short;
    const size = options.size ?? pillHeight * 0.48;
    // Font size as a share of page height, so the label can be centred on the pill.
    const sizeInHeight = (size * this.short) / this.height;
    this.text(label, {
      x: options.x,
      y: options.y + options.h / 2 - sizeInHeight * 0.62,
      w: options.w,
      size,
      weight: options.weight ?? 600,
      ...(options.color ? { color: options.color } : {}),
      ...(options.font ? { font: options.font } : {}),
      align: 'center',
    });
  }
}
