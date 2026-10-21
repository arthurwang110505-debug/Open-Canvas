import type { DesignDocument, DesignElement } from '@opencanvas/document';

export const ELEMENT_TYPE_LABELS: Record<DesignElement['type'], string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  text: 'Text',
  image: 'Image',
  path: 'Draw',
  icon: 'Icon',
  group: 'Group',
};

const MAX_LABEL = 40;

function truncate(text: string): string {
  const line = text.split('\n')[0]?.trim() ?? '';
  return line.length > MAX_LABEL ? `${line.slice(0, MAX_LABEL - 1)}…` : line;
}

/**
 * Human-readable name for an element: the user-given name when set, otherwise something
 * derived from its content (text, file name) or its type.
 */
export function describeElement(
  element: DesignElement,
  assets: DesignDocument['assets'] = {},
): string {
  if (element.name && element.name.trim().length > 0) return element.name.trim();
  switch (element.type) {
    case 'text': {
      const line = truncate(element.text);
      return line.length > 0 ? line : ELEMENT_TYPE_LABELS.text;
    }
    case 'image':
      return assets[element.assetId]?.name ?? ELEMENT_TYPE_LABELS.image;
    case 'rect':
    case 'ellipse':
      return ELEMENT_TYPE_LABELS[element.type];
    case 'path':
      return element.name?.trim() ? element.name.trim() : 'Draw';
    case 'icon': {
      // Icons carry no text, so the catalogue id is the most useful label: `heart` → `Heart`.
      const label = element.iconId.replace(/-/g, ' ');
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    case 'group':
      return element.name?.trim() ? element.name.trim() : `${element.children.length} selected`;
  }
}
