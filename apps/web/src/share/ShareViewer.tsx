import { useEffect, useState } from 'react';
import { renderPageToSvg } from '@opencanvas/export';
import type { DesignDocument } from '@opencanvas/document';
import { Button } from '@opencanvas/ui';
import { ChevronLeft, ChevronRight, MonitorPlay } from 'lucide-react';
import { navigate } from '../router';
import { loadSharedDocument } from './cloud';
import { PresentMode } from './PresentMode';

export function ShareViewer({ shareId }: { shareId: string }) {
  // Reading localStorage is synchronous, so the document is derived from the id during render.
  const [loaded, setLoaded] = useState<{ shareId: string; doc: DesignDocument | null }>(() => ({
    shareId,
    doc: loadSharedDocument(shareId),
  }));
  if (loaded.shareId !== shareId) {
    setLoaded({ shareId, doc: loadSharedDocument(shareId) });
  }
  const doc = loaded.shareId === shareId ? loaded.doc : null;
  const [pageIdx, setPageIdx] = useState(0);
  const [rendered, setRendered] = useState<{ pageId: string; svg: string } | null>(null);
  const [present, setPresent] = useState(false);

  const page = doc?.pages[pageIdx];
  const svg = page && rendered?.pageId === page.id ? rendered.svg : null;

  useEffect(() => {
    if (!doc || !page) return;
    let cancelled = false;
    void (async () => {
      const res = await renderPageToSvg(doc, { pageId: page.id });
      if (!cancelled && res.ok) setRendered({ pageId: page.id, svg: res.value });
    })();
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  if (!doc) {
    return (
      <div className="grid h-full place-items-center bg-[#f8f9fb] p-6">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-border">
          <h1 className="text-lg font-semibold">Share not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may have been created in another browser. Ask the owner to create a new share
            link or export a .opencanvas file.
          </p>
          <Button className="mt-4 rounded-full" onClick={() => navigate({ name: 'dashboard' })}>
            Go to your designs
          </Button>
        </div>
      </div>
    );
  }

  if (present)
    return (
      <PresentMode document={doc} initialPageIndex={pageIdx} onClose={() => setPresent(false)} />
    );

  const total = doc.pages.length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#f8f9fb]">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3 shadow-sm">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{doc.name}</p>
          <p className="text-xs text-muted-foreground">
            Shared view · {total} page{total === 1 ? '' : 's'} · {doc.size.width}×{doc.size.height}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => navigate({ name: 'dashboard' })}
          >
            Open OpenCanvas
          </Button>
          <Button size="sm" className="rounded-full" onClick={() => setPresent(true)}>
            <MonitorPlay className="size-4" /> Present
          </Button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden">
        {total > 1 ? (
          <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-white px-4 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={pageIdx === 0}
              onClick={() => setPageIdx((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="min-w-[80px] text-center text-xs font-medium tabular-nums">
              {pageIdx + 1} / {total}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={pageIdx === total - 1}
              onClick={() => setPageIdx((i) => Math.min(total - 1, i + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}

        <div className="flex flex-1 items-center justify-center overflow-auto p-6 sm:p-10">
          {svg ? (
            <div
              className="max-h-full max-w-full overflow-hidden rounded-xl bg-white p-2 shadow-lg ring-1 ring-border [&_svg]:h-auto [&_svg]:w-auto [&_svg]:max-w-[min(90vw,1200px)] [&_svg]:object-contain"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Rendering…</p>
          )}
        </div>
      </div>
    </div>
  );
}
