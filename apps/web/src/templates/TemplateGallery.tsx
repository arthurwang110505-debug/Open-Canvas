import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@opencanvas/ui';
import { TEMPLATES, categoryLabel, type TemplateCategory } from './catalog';
import { TemplateThumbnail } from './TemplateThumbnail';

const CATEGORIES: TemplateCategory[] = [
  'all',
  'social',
  'presentation',
  'print',
  'video',
  'business',
];

export interface TemplateGalleryProps {
  onUse: (templateId: string) => void;
  /**
   * `page` is the dashboard gallery (large cards, descriptions).
   * `panel` is the compact two-column browser used inside the editor sidebar.
   */
  variant?: 'page' | 'panel';
}

/** How many cards the compact sidebar browser shows before asking for more. */
const PANEL_PAGE = 18;

export function TemplateGallery({ onUse, variant = 'page' }: TemplateGalleryProps) {
  const panel = variant === 'panel';
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PANEL_PAGE);
  // Build each template once. Sixty cards must not rebuild sixty documents on every keystroke.
  const documents = useMemo(() => new Map(TEMPLATES.map((tpl) => [tpl.id, tpl.build()])), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q))
      );
    });
  }, [category, query]);

  const visible = panel ? filtered.slice(0, limit) : filtered;

  return (
    <section
      className={panel ? '' : 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-border'}
      aria-label="Templates"
    >
      <div
        className={
          panel
            ? 'flex flex-col gap-2'
            : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        {!panel ? (
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4 text-primary" />
            Templates
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {TEMPLATES.length}
            </span>
          </p>
        ) : null}
        <div className={panel ? '' : 'relative max-w-xs flex-1 sm:max-w-[260px]'}>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search templates"
            aria-label="Search templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-9 w-full rounded-full border border-input bg-white py-2 pr-4 pl-9 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>
      </div>

      <div className={panel ? 'mt-2.5 flex flex-wrap gap-1.5' : 'mt-3 flex flex-wrap gap-1.5'}>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => {
              setCategory(c);
              setLimit(PANEL_PAGE);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              category === c
                ? 'bg-foreground text-background shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      <div
        className={
          panel
            ? 'mt-3 grid grid-cols-2 gap-2'
            : 'mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }
      >
        {visible.map((tpl) => (
          <div
            key={tpl.id}
            data-testid="template-card"
            className="group flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
          >
            <button
              type="button"
              onClick={() => onUse(tpl.id)}
              className="p-1.5 text-left transition-colors hover:bg-muted/30"
              aria-label={`Use ${tpl.label} template`}
            >
              <TemplateThumbnail document={documents.get(tpl.id) ?? tpl.build()} />
            </button>
            {panel ? (
              <p className="truncate px-2 pb-2 text-[11px] font-medium">{tpl.label}</p>
            ) : (
              <div className="flex flex-1 flex-col gap-1 px-3 pt-1 pb-3">
                <p className="truncate text-sm leading-tight font-semibold">{tpl.label}</p>
                <p className="line-clamp-1 text-xs text-muted-foreground">{tpl.description}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                    {tpl.category}
                  </span>
                  <Button
                    size="sm"
                    className="h-7 rounded-full px-3 text-xs"
                    onClick={() => onUse(tpl.id)}
                  >
                    Use template
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {panel && filtered.length > visible.length ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full rounded-full"
          onClick={() => setLimit((current) => current + PANEL_PAGE)}
        >
          Show {Math.min(PANEL_PAGE, filtered.length - visible.length)} more of {filtered.length}
        </Button>
      ) : null}

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center">
          <p className="text-sm font-medium">No templates match “{query}”</p>
          <p className="text-xs text-muted-foreground">Try a different keyword or category.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 rounded-full"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : null}
    </section>
  );
}
