import {
  createBlankDocument,
  createEllipseElement,
  createRectElement,
  createTextElement,
  err,
  ok,
  validateDocument,
  type DesignDocument,
  type DesignElement,
  type Fill,
  type Result,
} from '@opencanvas/document';

import type { TemplateDefinition, TemplateElement, TemplateError } from './types';

/** Inter is bundled with the app; the other families are common system fonts. */
export const DEFAULT_TEMPLATE_FONT = 'Inter';
/** Every template is a single page; a stable id keeps instantiation deterministic. */
export const TEMPLATE_PAGE_ID = 'page_1';
/** Families a template may name without adding a download. */
export const TEMPLATE_FONT_FAMILIES: readonly string[] = [
  'Inter',
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
];

export interface InstantiateTemplateOptions {
  /** Document id; a fresh one is generated when omitted. */
  id?: string;
  /** Design name; defaults to the template's name. */
  name?: string;
  /** Injected for deterministic tests. */
  now?: Date;
}

function solid(color: string): Fill {
  return { type: 'solid', color };
}

function toElement(element: TemplateElement): DesignElement {
  const placement = {
    id: element.id,
    name: element.name,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation ?? 0,
    opacity: element.opacity ?? 1,
  };
  switch (element.kind) {
    case 'rect':
      return createRectElement({
        ...placement,
        fill: element.fill ? solid(element.fill) : { type: 'none' },
        stroke: element.stroke,
        cornerRadius: element.cornerRadius ?? 0,
      });
    case 'ellipse':
      return createEllipseElement({
        ...placement,
        fill: element.fill ? solid(element.fill) : { type: 'none' },
        stroke: element.stroke,
      });
    case 'text':
      return createTextElement({
        ...placement,
        text: element.text,
        fontFamily: element.fontFamily ?? DEFAULT_TEMPLATE_FONT,
        fontSize: element.fontSize,
        fontWeight: element.fontWeight ?? 400,
        fontStyle: element.fontStyle ?? 'normal',
        textAlign: element.textAlign ?? 'left',
        lineHeight: element.lineHeight ?? 1.2,
        letterSpacing: element.letterSpacing ?? 0,
        underline: element.underline ?? false,
        color: element.color,
      });
  }
}

/**
 * Turns a definition into a real document: a new id and timestamps, `source: 'template'` with the
 * template id recorded, and every element validated against the document schema. A definition that
 * cannot produce a valid document is reported instead of producing something broken.
 */
export function instantiateTemplate(
  definition: TemplateDefinition,
  options: InstantiateTemplateOptions = {},
): Result<DesignDocument, TemplateError> {
  const document = createBlankDocument({
    id: options.id,
    name: options.name ?? definition.name,
    width: definition.width,
    height: definition.height,
    background: solid(definition.background),
    source: 'template',
    templateId: definition.id,
    now: options.now,
  });
  const page = document.pages[0];
  if (!page) {
    return err({
      code: 'invalid-template',
      message: `Template "${definition.id}" produced no page.`,
    });
  }
  // A template is one page, so a fixed page id keeps instantiation reproducible (same inputs ->
  // byte-identical document). Page ids only have to be unique inside a document.
  page.id = TEMPLATE_PAGE_ID;
  page.elements = definition.elements.map(toElement);

  const validated = validateDocument(document);
  if (!validated.ok) {
    return err({
      code: 'invalid-document',
      message: `Template "${definition.id}" is not a valid document: ${validated.error.message}`,
      cause: validated.error,
    });
  }
  return ok(validated.value);
}

/** Looks a definition up by id. */
export function findTemplate(
  templates: readonly TemplateDefinition[],
  id: string,
): Result<TemplateDefinition, TemplateError> {
  const found = templates.find((template) => template.id === id);
  if (!found) {
    return err({ code: 'unknown-template', message: `No template with id "${id}".` });
  }
  return ok(found);
}
