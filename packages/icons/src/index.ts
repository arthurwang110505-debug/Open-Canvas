import { ICON_ENTRIES, type IconEntry } from './data';
import type { IconShape } from './types';

export type { IconEntry } from './data';
export * from './geometry';
export * from './types';
export { ICON_ENTRIES } from './data';

/** Every icon by id, for O(1) lookups from a document or an export. */
export const ICONS: Readonly<Record<string, IconEntry>> = Object.fromEntries(
  ICON_ENTRIES.map((entry) => [entry.id, entry]),
);

/** Ids of the icons that ship with the app, in catalogue order. */
export const ICON_IDS: readonly string[] = ICON_ENTRIES.map((entry) => entry.id);

/** Families in picker order, with a display label. */
export const ICON_FAMILIES: readonly { id: string; label: string }[] = [
  { id: 'essentials', label: 'Essentials' },
  { id: 'arrows', label: 'Arrows' },
  { id: 'people', label: 'People' },
  { id: 'communication', label: 'Communication' },
  { id: 'time', label: 'Time' },
  { id: 'business', label: 'Business' },
  { id: 'technology', label: 'Technology' },
  { id: 'travel', label: 'Travel' },
  { id: 'food', label: 'Food' },
  { id: 'nature', label: 'Nature' },
  { id: 'animals', label: 'Animals' },
  { id: 'health', label: 'Health' },
  { id: 'media', label: 'Media' },
  { id: 'objects', label: 'Objects' },
];

/** Shape data for an icon id, or `undefined` when the id is unknown or from a future version. */
export function getIcon(id: string): IconEntry | undefined {
  return ICONS[id];
}

/**
 * Icons matching a search query, ranked so an exact name beats a keyword hit. Used by the picker;
 * taking the whole list keeps it a pure function that a test can pin down.
 */
export function searchIcons(
  query: string,
  icons: readonly IconEntry[] = ICON_ENTRIES,
): IconEntry[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
  if (terms.length === 0) return [...icons];

  const scored: { entry: IconEntry; score: number }[] = [];
  for (const entry of icons) {
    const name = entry.id.replace(/-/g, ' ');
    const haystack = `${name} ${entry.family} ${entry.keywords.join(' ')}`.toLowerCase();
    if (!terms.every((term) => haystack.includes(term))) continue;
    const score = terms.reduce((total, term) => {
      if (name === term) return total + 4;
      if (name.startsWith(term)) return total + 3;
      if (name.includes(term)) return total + 2;
      if (entry.keywords.some((keyword) => keyword.toLowerCase().startsWith(term)))
        return total + 1;
      return total;
    }, 0);
    scored.push({ entry, score });
  }
  // Stable, deterministic order: best score first, then catalogue order.
  return scored
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((item) => item.entry);
}

function attributeString(attributes: Readonly<Record<string, string>>): string {
  return Object.entries(attributes)
    .map(([key, value]) => `${key}="${value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`)
    .join(' ');
}

/**
 * Serialises one shape to SVG markup. This is deliberately a serializer rather than a component:
 * the export package and any server-side tool can call it. Every shape in the catalogue is a
 * leaf (no children), so the result is always self-closing.
 */
export function shapeToSvg([tag, attributes]: IconShape): string {
  return `<${tag} ${attributeString(attributes)}/>`;
}
