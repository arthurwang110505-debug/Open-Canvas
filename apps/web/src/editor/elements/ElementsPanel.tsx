import { IconPreview } from '../panels/IconPicker';
import { popularIcons, searchIcons } from '@opencanvas/icons';
import { Button, Input, cn } from '@opencanvas/ui';
import { LayoutGrid, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';

import { useEditorActions } from '../actions';
import { elementDragProps } from '../elements/drag';
import { matchShape, SHAPE_ITEMS } from '../elements/shapeItems';

/** How many icons one screen of results shows before asking the user to narrow it down. */
const ICON_PAGE = 96;

type Category = 'all' | 'shapes' | 'icons';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'shapes', label: 'Shapes' },
  { id: 'icons', label: 'Icons' },
];

/**
 * The library: one search across shapes and icons, one place to drag from. Everything listed
 * here exists — there are no placeholder tiles for libraries that have not shipped yet.
 */
export function ElementsPanel() {
  const { addShape, addIcon } = useEditorActions();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const deferredQuery = useDeferredValue(query);

  const shapes = useMemo(
    () =>
      category === 'icons' ? [] : SHAPE_ITEMS.filter((item) => matchShape(item, deferredQuery)),
    [category, deferredQuery],
  );
  const icons = useMemo(() => {
    if (category === 'shapes') return [];
    const term = deferredQuery.trim();
    // Before anyone types, lead with the icons a page actually uses; an alphabetical dump of 372
    // is not a library, it is a directory.
    if (term.length === 0) {
      const popular = popularIcons();
      const seen = new Set(popular.map((entry) => entry.id));
      const rest = searchIcons('').filter((entry) => !seen.has(entry.id));
      return [...popular, ...rest];
    }
    return searchIcons(term);
  }, [category, deferredQuery]);
  const visibleIcons = icons.slice(0, ICON_PAGE);

  const nothingMatches = shapes.length === 0 && icons.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search elements"
          aria-label="Search elements"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 rounded-full bg-muted/60 pl-8 text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Element categories">
        {CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={category === entry.id}
            onClick={() => setCategory(entry.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              category === entry.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {shapes.length > 0 && (
        <section aria-label="Shapes" className="flex flex-col gap-2">
          {category === 'all' && (
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <LayoutGrid className="size-3" /> Shapes
            </h3>
          )}
          <div className="grid grid-cols-4 gap-2">
            {shapes.map((item) => (
              <Button
                key={item.kind}
                variant="outline"
                aria-label={item.label}
                title={`${item.label} — click or drag onto the canvas`}
                className="h-16 flex-col gap-1 rounded-xl p-1 text-[10px] font-normal hover:border-primary/30 hover:bg-primary/[0.04]"
                onClick={() => addShape(item.kind)}
                {...elementDragProps({ kind: 'shape', shape: item.kind })}
              >
                {item.icon}
                <span className="w-full truncate text-center">{item.label}</span>
              </Button>
            ))}
          </div>
        </section>
      )}

      {visibleIcons.length > 0 && (
        <section aria-label="Icons" className="flex flex-col gap-2">
          <h3 className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Icons</span>
            <span className="font-normal normal-case tracking-normal">
              {icons.length} {deferredQuery.trim() ? 'match' : 'icons'}
            </span>
          </h3>
          <div className="grid grid-cols-4 gap-2" role="listbox" aria-label="Icons">
            {visibleIcons.map((icon) => (
              <Button
                key={icon.id}
                variant="outline"
                role="option"
                aria-selected={false}
                aria-label={`Insert ${icon.id.replace(/-/g, ' ')}`}
                title={icon.id}
                className="h-14 flex-col gap-0.5 rounded-xl p-1 text-[10px] font-normal text-muted-foreground hover:border-primary/30"
                onClick={() => addIcon(icon.id)}
                {...elementDragProps({ kind: 'icon', iconId: icon.id })}
              >
                <IconPreview iconId={icon.id} className="size-6" />
                <span className="w-full truncate text-center">{icon.id.replace(/-/g, ' ')}</span>
              </Button>
            ))}
          </div>
          {icons.length > visibleIcons.length ? (
            <p className="text-[11px] text-muted-foreground">
              Showing the first {visibleIcons.length} of {icons.length} — type to narrow the list.
            </p>
          ) : null}
        </section>
      )}

      {nothingMatches ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No elements match “{query}”.
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Drag onto the page to place it where you drop it, or click to add it in the middle. Press{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">R</kbd> for a rectangle,{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">O</kbd> for an ellipse,{' '}
        <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">T</kbd> for text.
      </p>
    </div>
  );
}
