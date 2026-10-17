import { err, type DesignDocument, type Result } from '@opencanvas/document';

import { BRAND_TEMPLATES } from './definitions/brand';
import { PRESENTATION_TEMPLATES, VIDEO_TEMPLATES } from './definitions/presentation';
import { PRINT_TEMPLATES } from './definitions/print';
import { SOCIAL_TEMPLATES } from './definitions/social';
import { findTemplate, instantiateTemplate, type InstantiateTemplateOptions } from './instantiate';
import type { TemplateCategory, TemplateDefinition, TemplateError } from './types';

export * from './types';
export {
  DEFAULT_TEMPLATE_FONT,
  TEMPLATE_FONT_FAMILIES,
  TEMPLATE_PAGE_ID,
  findTemplate,
  instantiateTemplate,
  type InstantiateTemplateOptions,
} from './instantiate';

/** Every shipped template, in gallery order. All original — see `templates/LICENSES.md`. */
export const TEMPLATES: readonly TemplateDefinition[] = [
  ...SOCIAL_TEMPLATES,
  ...PRESENTATION_TEMPLATES,
  ...VIDEO_TEMPLATES,
  ...PRINT_TEMPLATES,
  ...BRAND_TEMPLATES,
];

export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  'social',
  'presentation',
  'video',
  'print',
  'brand',
];

export const CATEGORY_LABELS: Readonly<Record<TemplateCategory, string>> = {
  social: 'Social',
  presentation: 'Presentation',
  video: 'Video',
  print: 'Print',
  brand: 'Brand & marketing',
};

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function templatesByCategory(category: TemplateCategory): TemplateDefinition[] {
  return TEMPLATES.filter((template) => template.category === category);
}

/**
 * Looks a template up by id and instantiates it into a validated document. This is what the app
 * calls when a design is created from a template.
 */
export function createDocumentFromTemplate(
  templateId: string,
  options: InstantiateTemplateOptions = {},
): Result<DesignDocument, TemplateError> {
  const found = findTemplate(TEMPLATES, templateId);
  if (!found.ok) return err(found.error);
  return instantiateTemplate(found.value, options);
}
