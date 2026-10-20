import { useMemo, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Button } from '@opencanvas/ui';
import { TEMPLATES, categoryLabel, type TemplateCategory } from './catalog';
import { TemplateThumbnail } from './TemplateThumbnail';

const CATEGORIES: TemplateCategory[] = ['all', 'social', 'presentation', 'print', 'video', 'business'];

export function TemplateGallery({ onUse }: { onUse: (templateId: string) => void }) {
  const [category, setCategory] = useState<TemplateCategory>('all');
  const [query, setQuery] = useState('');

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

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-border" aria-label="Templates">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <Sparkles className="size-4 text-primary" />
          Templates
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">{TEMPLATES.length}</span>
        </p>
        <div className="relative max-w-xs flex-1 sm:max-w-[260px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search templates"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-full border border-input bg-white py-2 pl-9 pr-4 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/20"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
              category === c ? 'bg-foreground text-background shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            }`}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((tpl) => (
          <div
            key={tpl.id}
            data-testid="template-card"
            className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition-all hover:shadow-md hover:border-primary/20"
          >
            <button
              type="button"
              onClick={() => onUse(tpl.id)}
              className="p-2 text-left transition-colors hover:bg-muted/30"
              aria-label={`Use ${tpl.label} template`}
            >
              <TemplateThumbnail document={tpl.build()} />
            </button>
            <div className="flex flex-1 flex-col gap-1 px-3 pb-3 pt-1">
              <p className="truncate text-sm font-semibold leading-tight">{tpl.label}</p>
              <p className="line-clamp-1 text-xs text-muted-foreground">{tpl.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">{tpl.category}</span>
                <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => onUse(tpl.id)}>
                  Use template
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed bg-muted/30 px-6 py-8 text-center">
          <p className="text-sm font-medium">No templates match “{query}”</p>
          <p className="text-xs text-muted-foreground">Try a different keyword or category.</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => { setQuery(''); setCategory('all'); }}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </section>
  );
}
