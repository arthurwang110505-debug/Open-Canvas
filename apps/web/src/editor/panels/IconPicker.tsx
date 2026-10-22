import { getIcon, ICON_FAMILIES, searchIcons } from '@opencanvas/icons';
import { Button, cn } from '@opencanvas/ui';
import { createElement, useDeferredValue, useId, useMemo, useState } from 'react';

/**
 * One icon drawn from its catalogue data. The editor draws icons as inline SVG (not as React
 * components), which is the same geometry the canvas and the exporters use — so the panel, the
 * canvas and a downloaded file can never disagree about what an icon looks like.
 */
export function IconPreview({
  iconId,
  color = 'currentColor',
  strokeWidth = 2,
  className,
}: {
  iconId: string;
  color?: string;
  strokeWidth?: number;
  className?: string;
}) {
  const icon = getIcon(iconId);
  if (!icon) return null;
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.shapes.map(([tag, attributes], index) =>
        createElement(tag, {
          key: index,
          ...attributes,
          // The few solid details in the set (e.g. the keyhole dot) take the icon colour.
          fill: attributes['fill'] === 'currentColor' ? color : undefined,
        }),
      )}
    </svg>
  );
}

/**
 * The replace picker that opens from an icon's properties: search across names and keywords, then
 * swap the selected icon. Search runs over the data, never over the rendered nodes.
 */
export function IconPicker({
  onPick,
  selectedId,
  className,
}: {
  onPick: (iconId: string) => void;
  selectedId?: string;
  className?: string;
}) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [family, setFamily] = useState<string>('all');
  const listId = useId();

  const results = useMemo(() => {
    const matched = searchIcons(deferredQuery);
    return family === 'all' ? matched : matched.filter((entry) => entry.family === family);
  }, [deferredQuery, family]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search icons"
        aria-label="Search icons"
        className="h-8 w-full rounded-full border border-border bg-muted/60 px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Icon categories">
        {[{ id: 'all', label: 'All' }, ...ICON_FAMILIES].map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-pressed={family === entry.id}
            onClick={() => setFamily(entry.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
              family === entry.id
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label="Replace icon"
        className="grid max-h-[420px] grid-cols-4 gap-2 overflow-y-auto pr-1"
      >
        {results.map((entry) => (
          <Button
            key={entry.id}
            variant="outline"
            role="option"
            aria-selected={selectedId === entry.id}
            aria-label={`Insert ${entry.id.replace(/-/g, ' ')}`}
            title={entry.id}
            className={cn(
              'h-14 flex-col gap-0.5 rounded-xl p-1 text-[10px] font-normal text-muted-foreground',
              selectedId === entry.id && 'border-primary text-foreground',
            )}
            onClick={() => onPick(entry.id)}
          >
            <IconPreview iconId={entry.id} className="size-6" />
            <span className="w-full truncate text-center">{entry.id.replace(/-/g, ' ')}</span>
          </Button>
        ))}
      </div>
      {results.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No icons match “{query}”.</p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {results.length} icon{results.length === 1 ? '' : 's'} · click to swap the selected icon.
        </p>
      )}
    </div>
  );
}
