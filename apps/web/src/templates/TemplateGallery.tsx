import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button, EmptyState, SearchField, Select } from '@opencanvas/ui';
import { TEMPLATES, categoryLabel, type TemplateCategory } from './catalog';
import { TemplateThumbnail } from './TemplateThumbnail';
import {
  templateColorMoods,
  templateOrientation,
  type TemplateColorMood,
  type TemplateOrientation,
} from './templateMetadata';

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
  onPreview?: (templateId: string) => void;
  maxItems?: number;
  /**
   * `page` is the full discovery view, `home` is a short featured row, and `panel` is the
   * compact two-column browser used inside the editor sidebar.
   */
  variant?: 'page' | 'home' | 'panel';
}

/** How many cards the compact sidebar browser shows before asking for more. */
const PANEL_PAGE = 18;
const COLOR_FILTERS: { id: TemplateColorMood | 'all'; label: string }[] = [
  { id: 'all', label: 'Any color' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'neutral', label: 'Neutral' },
  { id: 'vibrant', label: 'Vibrant' },
];
const ORIENTATION_FILTERS: { id: TemplateOrientation | 'all'; label: string }[] = [
  { id: 'all', label: 'Any orientation' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'square', label: 'Square' },
  { id: 'landscape', label: 'Landscape' },
];

export function TemplateGallery({
  onUse,
  onPreview,
  maxItems,
  variant = 'page',
}: TemplateGalleryProps) {
  const panel = variant === 'panel';
  const home = variant === 'home';
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PANEL_PAGE);
  const [orientation, setOrientation] = useState<TemplateOrientation | 'all'>('all');
  const [color, setColor] = useState<TemplateColorMood | 'all'>('all');
  // Build each template once. Sixty cards must not rebuild sixty documents on every keystroke.
  const documents = useMemo(() => new Map(TEMPLATES.map((tpl) => [tpl.id, tpl.build()])), []);
  const metadata = useMemo(
    () =>
      new Map(
        TEMPLATES.map((tpl) => {
          const document = documents.get(tpl.id) ?? tpl.build();
          return [
            tpl.id,
            { orientation: templateOrientation(document), colors: templateColorMoods(document) },
          ] as const;
        }),
      ),
    [documents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TEMPLATES.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      const details = metadata.get(t.id);
      if (orientation !== 'all' && details?.orientation !== orientation) return false;
      if (color !== 'all' && !details?.colors.includes(color)) return false;
      if (!q) return true;
      return (
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.includes(q))
      );
    });
  }, [category, color, metadata, orientation, query]);

  const visibleCount = panel ? limit : maxItems;
  const visible = visibleCount ? filtered.slice(0, visibleCount) : filtered;

  return (
    <section
      className={panel || home ? '' : 'rounded-2xl bg-white p-5 shadow-sm ring-1 ring-border'}
      aria-label="Templates"
    >
      <div
        className={
          panel
            ? 'flex flex-col gap-2'
            : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'
        }
      >
        {!panel && !home ? (
          <p className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4 text-primary" />
            Templates
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {TEMPLATES.length}
            </span>
          </p>
        ) : null}
        {!home ? (
          <SearchField
            placeholder="Search templates"
            aria-label="Search templates"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            clearLabel="Clear template search"
            wrapperClassName={panel ? '' : 'max-w-xs flex-1 sm:max-w-[260px]'}
            className="h-9 rounded-full bg-white text-[13px]"
          />
        ) : null}
      </div>

      {!home ? (
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
      ) : null}

      {!panel && !home ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">Refine by</span>
          <Select
            aria-label="Template orientation"
            value={orientation}
            onChange={(event) => setOrientation(event.target.value as TemplateOrientation | 'all')}
            className="h-8 w-auto min-w-36 rounded-full bg-white text-xs"
          >
            {ORIENTATION_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Template color"
            value={color}
            onChange={(event) => setColor(event.target.value as TemplateColorMood | 'all')}
            className="h-8 w-auto min-w-32 rounded-full bg-white text-xs"
          >
            {COLOR_FILTERS.map((filter) => (
              <option key={filter.id} value={filter.id}>
                {filter.label}
              </option>
            ))}
          </Select>
          {orientation !== 'all' || color !== 'all' ? (
            <button
              type="button"
              onClick={() => {
                setOrientation('all');
                setColor('all');
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear refinements
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={
          panel
            ? 'mt-3 grid grid-cols-2 gap-2'
            : home
              ? 'mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3'
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
              onClick={() => (onPreview ? onPreview(tpl.id) : onUse(tpl.id))}
              className="p-1.5 text-left transition-colors hover:bg-muted/30"
              aria-label={`${onPreview ? 'Preview' : 'Use'} ${tpl.label} template`}
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
        <EmptyState
          icon={<Search />}
          titleAs="p"
          title={query ? `No templates match “${query}”` : 'No templates match these filters'}
          description="Try another keyword or clear the category and refinement filters."
          className="mt-6 rounded-xl bg-muted/30"
          action={
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                setQuery('');
                setCategory('all');
                setOrientation('all');
                setColor('all');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : null}
    </section>
  );
}
