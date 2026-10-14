import { CURRENT_SCHEMA_VERSION, DEFAULT_PRESET } from './constants';
import { generateId } from './ids';
import type {
  DesignDocument,
  EllipseElement,
  Fill,
  Page,
  RectElement,
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
