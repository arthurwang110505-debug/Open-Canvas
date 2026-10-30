import { CANVAS_PRESETS, type CanvasPreset } from '@opencanvas/document';
import { Button, SearchField } from '@opencanvas/ui';
import { Camera, MonitorPlay, Presentation, Search, Sparkles } from 'lucide-react';
import { useState, type FormEvent } from 'react';

interface HomeHeroProps {
  onCreateDesign: () => void;
  onCreatePreset: (preset: CanvasPreset) => void;
  onBrowseTemplates: () => void;
  onSearch: (query: string) => void;
}

const QUICK_STARTS = [
  { presetId: 'instagram-post', label: 'Social post', icon: Camera },
  { presetId: 'instagram-story', label: 'Story', icon: Sparkles },
  { presetId: 'presentation-16-9', label: 'Presentation', icon: Presentation },
  { presetId: 'poster-a4', label: 'Poster', icon: MonitorPlay },
] as const;

/** A compact, template-first entry point. Project search lives in Projects. */
export function HomeHero({
  onCreateDesign,
  onCreatePreset,
  onBrowseTemplates,
  onSearch,
}: HomeHeroProps) {
  const [query, setQuery] = useState('');
  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch(query.trim());
  };

  return (
    <section aria-labelledby="home-hero-title" className="animate-rise-in space-y-6">
      <div className="rounded-2xl border border-primary/10 bg-accent/70 px-5 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 id="home-hero-title" className="text-2xl font-bold tracking-tight sm:text-[30px]">
              What will you design today?
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start with a template. Make it yours.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onBrowseTemplates} className="text-primary">
            Browse templates
          </Button>
        </div>
        <form
          role="search"
          aria-label="Find a template"
          onSubmit={submitSearch}
          className="mt-5 flex max-w-2xl items-center gap-2 rounded-xl border border-border bg-white p-1.5 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
        >
          <SearchField
            aria-label="Search templates"
            placeholder="Search templates — posts, presentations, posters…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery('')}
            clearLabel="Clear template search"
            wrapperClassName="min-w-0 flex-1"
            className="h-10 border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="submit" aria-label="Search templates" className="h-10 rounded-lg px-3.5">
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>Popular:</span>
          {['Social post', 'Presentation', 'Poster'].map((term) => (
            <button
              key={term}
              type="button"
              onClick={() => onSearch(term)}
              className="rounded py-1 text-foreground/75 underline-offset-4 hover:text-primary hover:underline"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">Start with a blank canvas</h2>
          <button
            type="button"
            onClick={onCreateDesign}
            className="rounded px-1 py-2 text-xs font-semibold text-primary hover:underline"
          >
            Custom size
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {QUICK_STARTS.map(({ presetId, label, icon: Icon }) => {
            const preset = CANVAS_PRESETS.find((candidate) => candidate.id === presetId);
            if (!preset) return null;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onCreatePreset(preset)}
                className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-white p-3 text-left transition-colors hover:border-primary/35 hover:bg-accent/40"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-foreground/70 transition-colors group-hover:bg-secondary group-hover:text-primary">
                  <Icon className="size-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">{label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {preset.width} × {preset.height} px
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
