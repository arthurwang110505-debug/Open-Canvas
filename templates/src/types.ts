/**
 * Templates are declarative: plain data describing one page of shapes and text. They never
 * contain image bytes, so a template file is small, reviewable and free of third-party assets
 * (see `templates/LICENSES.md`).
 */

export type TemplateCategory = 'social' | 'print' | 'presentation' | 'video' | 'brand';

/** Shared placement fields, in the template's own pixel coordinate space. */
export interface TemplatePlacement {
  /** Stable per template; becomes the document element id. */
  id: string;
  /** Optional layer name shown in the layers panel. */
  name?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Clockwise degrees around the top-left corner, matching the document model. */
  rotation?: number;
  opacity?: number;
}

export interface TemplateRect extends TemplatePlacement {
  kind: 'rect';
  /** Hex color; omit for no fill (an outline-only shape). */
  fill?: string;
  stroke?: { color: string; width: number };
  cornerRadius?: number;
}

export interface TemplateEllipse extends TemplatePlacement {
  kind: 'ellipse';
  fill?: string;
  stroke?: { color: string; width: number };
}

export interface TemplateText extends TemplatePlacement {
  kind: 'text';
  text: string;
  /** Defaults to `DEFAULT_TEMPLATE_FONT` (bundled with the app). */
  fontFamily?: string;
  fontSize: number;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  underline?: boolean;
  color: string;
}

export type TemplateElement = TemplateRect | TemplateEllipse | TemplateText;

export interface TemplateDefinition {
  /** Stable identifier, stored in `document.metadata.templateId`. */
  id: string;
  /** Shown in the gallery and used as the new design's name. */
  name: string;
  category: TemplateCategory;
  /** One line describing what the template is for. */
  description: string;
  width: number;
  height: number;
  /** The matching `CANVAS_PRESETS` id when the size is a standard one. */
  presetId?: string;
  /** Page background as a hex color. */
  background: string;
  /** Paint order: the first element is the back-most one. */
  elements: readonly TemplateElement[];
}

export type TemplateErrorCode = 'unknown-template' | 'invalid-template' | 'invalid-document';

export interface TemplateError {
  code: TemplateErrorCode;
  message: string;
  cause?: unknown;
}
