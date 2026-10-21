import { getBlueprint } from './blueprints';
import { INSTANCES } from './instances';
import { SIGNATURE_TEMPLATES } from './signature';
import type { TemplateCategory, TemplateDefinition } from './types';

export type { TemplateCategory, TemplateDefinition } from './types';

/** Order follows the gallery, so "All" reads as an exhibition rather than an alphabet. */
const CATEGORY_ORDER: Record<Exclude<TemplateCategory, 'all'>, number> = {
  social: 0,
  presentation: 1,
  video: 2,
  print: 3,
  business: 4,
};

function buildGenerated(): TemplateDefinition[] {
  return INSTANCES.map((instance) => {
    const blueprint = getBlueprint(instance.blueprint);
    if (!blueprint) throw new Error(`unknown blueprint ${instance.blueprint}`);
    return {
      id: instance.id,
      label: instance.label,
      description: instance.description,
      category: instance.category,
      presetId: instance.presetId,
      tags: instance.tags,
      build: () =>
        blueprint.build({
          templateId: instance.id,
          presetId: instance.presetId,
          name: instance.label,
          palette: instance.palette,
          type: instance.type,
          content: instance.content,
          ...(instance.flip !== undefined ? { flip: instance.flip } : {}),
        }),
    };
  });
}

/**
 * The whole catalogue: hand-tuned signature designs first inside each category, then the
 * generated cuts. Both halves are `TemplateDefinition`s, so callers never branch on origin.
 */
export const TEMPLATES: TemplateDefinition[] = [...SIGNATURE_TEMPLATES, ...buildGenerated()]
  .map((template, index) => ({ template, index }))
  .sort((a, b) => {
    const category = CATEGORY_ORDER[a.template.category] - CATEGORY_ORDER[b.template.category];
    return category !== 0 ? category : a.index - b.index;
  })
  .map(({ template }) => template);

export function getTemplate(id: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

export function categoryLabel(cat: TemplateCategory): string {
  return {
    all: 'All',
    social: 'Social',
    presentation: 'Presentations',
    print: 'Posters & print',
    video: 'Video',
    business: 'Business',
  }[cat];
}
