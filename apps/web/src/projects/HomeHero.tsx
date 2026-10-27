import { CANVAS_PRESETS, type CanvasPreset } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { ArrowRight, Camera, MonitorPlay, Plus, Presentation, Sparkles } from 'lucide-react';

interface HomeHeroProps {
  onCreateDesign: () => void;
  onCreatePreset: (preset: CanvasPreset) => void;
  onBrowseTemplates: () => void;
}

const QUICK_STARTS = [
  { presetId: 'instagram-post', label: 'Social post', icon: Camera, color: 'bg-fuchsia-500' },
  { presetId: 'instagram-story', label: 'Story', icon: Sparkles, color: 'bg-violet-500' },
  { presetId: 'presentation-16-9', label: 'Presentation', icon: Presentation, color: 'bg-sky-500' },
  { presetId: 'poster-a4', label: 'Poster', icon: MonitorPlay, color: 'bg-emerald-500' },
] as const;

export function HomeHero({ onCreateDesign, onCreatePreset, onBrowseTemplates }: HomeHeroProps) {
  return (
    <section aria-labelledby="home-hero-title" className="space-y-5">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-700 via-[#6855ef] to-indigo-500 px-6 py-8 text-white shadow-[0_18px_50px_rgba(91,72,210,0.22)] sm:px-9 sm:py-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-32 -z-10 size-[360px] rounded-full border-[54px] border-white/[0.07]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 right-[18%] -z-10 size-64 rounded-full bg-cyan-300/15 blur-3xl"
        />
        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-wide text-white/90">
            <Sparkles className="size-3.5" /> Make something wonderful
          </p>
          <h1 id="home-hero-title" className="text-3xl font-bold tracking-tight sm:text-[40px]">
            What will you design today?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 sm:text-[15px]">
            Start with a blank canvas, pick a format, or find a template that gets you moving.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              onClick={onCreateDesign}
              className="h-10 rounded-full bg-white px-5 font-semibold text-violet-800 shadow-sm hover:bg-white/90"
            >
              <Plus className="size-4" /> Create a design
            </Button>
            <Button
              variant="ghost"
              onClick={onBrowseTemplates}
              className="h-10 rounded-full border border-white/25 bg-white/10 px-4 text-white hover:bg-white/20 hover:text-white"
            >
              Explore templates <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Start with a popular format</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Choose a size and jump right in.</p>
          </div>
          <button
            type="button"
            onClick={onCreateDesign}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Custom size
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {QUICK_STARTS.map((quickStart) => {
            const preset = CANVAS_PRESETS.find((candidate) => candidate.id === quickStart.presetId);
            if (!preset) return null;
            const Icon = quickStart.icon;
            const ratio = preset.width / preset.height;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onCreatePreset(preset)}
                className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-muted/60">
                  <span
                    className={`grid max-h-9 max-w-9 place-items-center rounded-md ${quickStart.color} text-white shadow-sm`}
                    style={{
                      width: ratio > 1 ? 36 : Math.max(23, 36 * ratio),
                      height: ratio < 1 ? 36 : Math.max(23, 36 / ratio),
                    }}
                  >
                    <Icon className="size-4" />
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold">
                    {quickStart.label}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
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
