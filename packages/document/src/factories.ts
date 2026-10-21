import { CURRENT_SCHEMA_VERSION, DEFAULT_PRESET } from './constants';
import { getElementBounds, unionBounds } from './geometry';
import { generateId } from './ids';
import type {
  DesignDocument,
  DesignElement,
  EllipseElement,
  Fill,
  GroupElement,
  ImageAsset,
  ImageElement,
  Page,
  PathElement,
  PathPoint,
  RectElement,
  Stroke,
  TextElement,
} from './schema';

export interface CreateDocumentOptions {
  id?: string;
  name?: string;
  width?: number;
  height?: number;
  background?: Fill;
  /** Injected for deterministic tests. Defaults to `new Date()`. */
  now?: Date;
  source?: DesignDocument['metadata']['source'];
  templateId?: string;
}

export function createPage(options: { id?: string; name?: string; background?: Fill } = {}): Page {
  return {
    id: options.id ?? generateId('page'),
    ...(options.name !== undefined ? { name: options.name } : {}),
    background: options.background ?? { type: 'solid', color: '#ffffff' },
    elements: [],
  };
}

export function createBlankDocument(options: CreateDocumentOptions = {}): DesignDocument {
  const now = (options.now ?? new Date()).toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: options.id ?? generateId('doc'),
    name: options.name ?? 'Untitled design',
    size: {
      width: options.width ?? DEFAULT_PRESET.width,
      height: options.height ?? DEFAULT_PRESET.height,
    },
    pages: [createPage({ background: options.background })],
    assets: {},
    metadata: {
      createdAt: now,
      updatedAt: now,
      source: options.source ?? 'blank',
      ...(options.templateId !== undefined ? { templateId: options.templateId } : {}),
    },
  };
}

type ElementDefaults = Pick<
  RectElement,
  'id' | 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'locked' | 'visible'
>;

function baseDefaults(overrides: Partial<ElementDefaults>): ElementDefaults {
  return {
    id: overrides.id ?? generateId('el'),
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 200,
    height: overrides.height ?? 200,
    rotation: overrides.rotation ?? 0,
    opacity: overrides.opacity ?? 1,
    locked: overrides.locked ?? false,
    visible: overrides.visible ?? true,
  };
}

export function createRectElement(overrides: Partial<Omit<RectElement, 'type'>> = {}): RectElement {
  return {
    ...baseDefaults(overrides),
    type: 'rect',
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    fill: overrides.fill ?? { type: 'solid', color: '#4f46e5' },
    ...(overrides.stroke !== undefined ? { stroke: overrides.stroke } : {}),
    cornerRadius: overrides.cornerRadius ?? 0,
  };
}

export function createEllipseElement(
  overrides: Partial<Omit<EllipseElement, 'type'>> = {},
): EllipseElement {
  return {
    ...baseDefaults(overrides),
    type: 'ellipse',
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    fill: overrides.fill ?? { type: 'solid', color: '#f97316' },
    ...(overrides.stroke !== undefined ? { stroke: overrides.stroke } : {}),
  };
}

export function createTextElement(overrides: Partial<Omit<TextElement, 'type'>> = {}): TextElement {
  return {
    ...baseDefaults({ width: 400, height: 60, ...overrides }),
    type: 'text',
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    text: overrides.text ?? 'Add your text',
    fontFamily: overrides.fontFamily ?? 'Inter',
    fontSize: overrides.fontSize ?? 48,
    fontWeight: overrides.fontWeight ?? 400,
    fontStyle: overrides.fontStyle ?? 'normal',
    textAlign: overrides.textAlign ?? 'left',
    lineHeight: overrides.lineHeight ?? 1.2,
    letterSpacing: overrides.letterSpacing ?? 0,
    underline: overrides.underline ?? false,
    color: overrides.color ?? '#111827',
  };
}

export function createImageElement(
  overrides: Partial<Omit<ImageElement, 'type'>> & Pick<ImageElement, 'assetId'>,
): ImageElement {
  return {
    ...baseDefaults(overrides),
    type: 'image',
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    assetId: overrides.assetId,
    fit: overrides.fit ?? 'cover',
    flipH: overrides.flipH ?? false,
    flipV: overrides.flipV ?? false,
    filters: overrides.filters ?? { brightness: 100, contrast: 100, saturate: 100, blur: 0 },
    ...(overrides.crop !== undefined ? { crop: overrides.crop } : {}),
  };
}

export interface CreateImageAssetOptions {
  id?: string;
  name?: string;
  mimeType: ImageAsset['mimeType'];
  width: number;
  height: number;
  byteSize?: number;
  source?: ImageAsset['source'];
  now?: Date;
}

export function createImageAsset(options: CreateImageAssetOptions): ImageAsset {
  return {
    id: options.id ?? generateId('asset'),
    kind: 'image',
    ...(options.name !== undefined ? { name: options.name } : {}),
    mimeType: options.mimeType,
    width: options.width,
    height: options.height,
    ...(options.byteSize !== undefined ? { byteSize: options.byteSize } : {}),
    source: options.source ?? { type: 'local' },
    createdAt: (options.now ?? new Date()).toISOString(),
  };
}

export function createGroupElement(
  elements: readonly DesignElement[],
  overrides: Partial<Omit<GroupElement, 'type' | 'children'>> = {},
): GroupElement {
  if (elements.length === 0) throw new Error('Cannot create a group with no elements.');
  const bounds = unionBounds(elements.map((el) => getElementBounds(el)));
  const groupId = overrides.id ?? generateId('el');
  // Children are stored relative to group's origin
  const children = elements.map((el) => ({
    ...el,
    x: el.x - bounds.left,
    y: el.y - bounds.top,
  }));
  return {
    id: groupId,
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    x: overrides.x ?? bounds.left,
    y: overrides.y ?? bounds.top,
    width: overrides.width ?? bounds.width,
    height: overrides.height ?? bounds.height,
    rotation: overrides.rotation ?? 0,
    opacity: overrides.opacity ?? 1,
    locked: overrides.locked ?? false,
    visible: overrides.visible ?? true,
    type: 'group',
    children,
  };
}

export function createPathElement(
  points: readonly PathPoint[],
  overrides: Partial<Omit<PathElement, 'type' | 'points'>> & {
    stroke?: Stroke;
    closed?: boolean;
  } = {},
): PathElement {
  if (points.length < 2) throw new Error('A path must have at least two points.');
  // Compute bounds from points (points are in page coords)
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  const relPoints = points.map((p) => ({ x: p.x - minX, y: p.y - minY }));
  return {
    ...baseDefaults({ x: minX, y: minY, width, height, ...overrides }),
    type: 'path',
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
    points: relPoints,
    stroke: overrides.stroke ?? { color: '#111827', width: 4 },
    fill: overrides.fill ?? { type: 'none' },
    closed: overrides.closed ?? false,
  };
}
