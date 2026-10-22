import { useCallback, useEffect, useMemo, useState } from 'react';
import { renderPageToSvg } from '@opencanvas/export';
import type { DesignDocument } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

interface Props {
  document: DesignDocument;
  initialPageIndex?: number;
  onClose: () => void;
}

const ignoreError = () => undefined;

export function PresentMode({ document: doc, initialPageIndex = 0, onClose }: Props) {
  const [idx, setIdx] = useState(initialPageIndex);
  // Rendered SVG is tagged with the page it belongs to, so switching pages shows a blank frame
  // until the next render resolves instead of clearing state inside the effect.
  const [rendered, setRendered] = useState<{ pageId: string; svg: string } | null>(null);

  const page = doc.pages[idx];
  const total = doc.pages.length;
  const svg = page && rendered?.pageId === page.id ? rendered.svg : null;

  useEffect(() => {
    let cancelled = false;
    if (!page) return;
    void (async () => {
      const res = await renderPageToSvg(doc, { pageId: page.id });
      if (!cancelled && res.ok) setRendered({ pageId: page.id, svg: res.value });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  const goPrev = useCallback(() => setIdx((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setIdx((i) => Math.min(total - 1, i + 1)), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goPrev, goNext, onClose]);

  // Enter fullscreen on mount
  useEffect(() => {
    const el = globalThis.document.documentElement;
    if (el.requestFullscreen) void el.requestFullscreen().catch(ignoreError);
    return () => {
      if (globalThis.document.fullscreenElement)
        void globalThis.document.exitFullscreen().catch(ignoreError);
    };
  }, []);

  const progress = useMemo(() => ((idx + 1) / total) * 100, [idx, total]);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0a0a0a] text-white">
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-medium">
          {doc.name} — {idx + 1} / {total}
        </p>
        <div className="flex items-center gap-2">
          <span className="hidden text-xs text-white/60 sm:block">
            ← → to navigate · Esc to exit
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full bg-white text-black hover:bg-white/90"
            onClick={onClose}
          >
            <X className="size-4" /> Exit
          </Button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-8">
        <button
          type="button"
          aria-label="Previous page"
          onClick={goPrev}
          disabled={idx === 0}
          className="absolute left-2 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-30 sm:left-6"
        >
          <ChevronLeft />
        </button>

        <div className="flex max-h-full max-w-full items-center justify-center">
          {svg ? (
            <div
              className="max-h-[calc(100vh-120px)] max-w-[90vw] overflow-hidden rounded-xl bg-white shadow-2xl [&_svg]:h-auto [&_svg]:max-h-[calc(100vh-120px)] [&_svg]:w-auto [&_svg]:max-w-[90vw] [&_svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="grid place-items-center rounded-xl bg-white px-12 py-16 text-zinc-900">
              <p className="text-sm text-muted-foreground">Rendering…</p>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label="Next page"
          onClick={goNext}
          disabled={idx === total - 1}
          className="absolute right-2 top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-30 sm:right-6"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="h-1 w-full bg-white/10">
        <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
