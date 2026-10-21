import { renderPageToSvg } from '@opencanvas/export';
import { blobToDataUrl } from '@opencanvas/storage';
import { Button, Tooltip } from '@opencanvas/ui';
import { ChevronLeft, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAssetServices } from './assets/useAssetServices';
import { useEditor } from './hooks';

const TRANSPARENT_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';

/**
 * Bottom filmstrip showing all pages as SVG thumbnails — Canva-style Page navigator.
 * Uses `renderPageToSvg` at ~0.12 scale so each thumbnail is a live preview of the page.
 */
export function PagesStrip() {
  const document = useEditor((s) => s.document);
  const activePageId = useEditor((s) => s.activePageId);
  const dispatch = useEditor((s) => s.dispatch);
  const setActivePage = useEditor((s) => s.setActivePage);
  const pages = document.pages;
  const canDelete = pages.length > 1;

  const onAddPage = useCallback(() => {
    dispatch({ type: 'page.add', afterPageId: activePageId });
  }, [dispatch, activePageId]);

  const onDuplicate = useCallback(
    (pageId: string) => {
      dispatch({ type: 'page.duplicate', pageId });
    },
    [dispatch],
  );

  const onDelete = useCallback(
    (pageId: string) => {
      if (!canDelete) return;
      dispatch({ type: 'page.delete', pageId });
    },
    [dispatch, canDelete],
  );

  const onMove = useCallback(
    (pageId: string, direction: -1 | 1) => {
      const from = pages.findIndex((p) => p.id === pageId);
      if (from === -1) return;
      const to = from + direction;
      if (to < 0 || to >= pages.length) return;
      dispatch({ type: 'page.reorder', pageId, toIndex: to });
    },
    [dispatch, pages],
  );

  return (
    <div
      aria-label="Pages"
      className="pointer-events-auto absolute bottom-3 left-1/2 z-20 flex max-w-[min(92%,960px)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-border bg-white px-2 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin">
        {pages.map((page, index) => {
          const isActive = page.id === activePageId;
          return (
            <div
              key={page.id}
              className="group relative flex shrink-0 flex-col items-center gap-1"
            >
              <button
                type="button"
                aria-label={`Go to page ${index + 1}${isActive ? ' (current)' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => setActivePage(page.id)}
                className={[
                  'relative overflow-hidden rounded-lg border-2 bg-white transition-all',
                  isActive
                    ? 'border-primary shadow-sm ring-2 ring-primary/20'
                    : 'border-border hover:border-foreground/20 hover:shadow-sm',
                ].join(' ')}
              >
                <PageThumbnail document={document} pageId={page.id} />
                <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/10 to-transparent px-1 py-0.5 text-center text-[10px] font-medium text-foreground/60">
                  {index + 1}
                </span>
              </button>

              {/* hover actions */}
              <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Tooltip content="Move left">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move page ${index + 1} left`}
                    disabled={index === 0}
                    onClick={() => onMove(page.id, -1)}
                    className="size-6 rounded-full"
                  >
                    <ChevronLeft className="size-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Move right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Move page ${index + 1} right`}
                    disabled={index === pages.length - 1}
                    onClick={() => onMove(page.id, 1)}
                    className="size-6 rounded-full"
                  >
                    <ChevronRight className="size-3.5" />
                  </Button>
                </Tooltip>
                <Tooltip content="Duplicate page">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Duplicate page ${index + 1}`}
                    onClick={() => onDuplicate(page.id)}
                    className="size-6 rounded-full"
                  >
                    <Copy className="size-3" />
                  </Button>
                </Tooltip>
                <Tooltip content={canDelete ? 'Delete page' : 'At least one page required'}>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete page ${index + 1}`}
                    disabled={!canDelete}
                    onClick={() => onDelete(page.id)}
                    className="size-6 rounded-full hover:text-destructive"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ml-1 flex shrink-0 items-center gap-1 border-l border-border pl-2">
        <Tooltip content="Add page">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Add page"
            onClick={onAddPage}
            className="rounded-full px-3"
          >
            <Plus className="size-4" />
            Add page
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}

function PageThumbnail({
  document,
  pageId,
}: {
  document: Parameters<typeof renderPageToSvg>[0];
  pageId: string;
}) {
  const assetServices = useAssetServices();
  const [svg, setSvg] = useState<string | null>(null);
  const thumbScale = useMemo(() => {
    // Target thumbnail width ~110px regardless of document size
    const targetW = 110;
    const scale = targetW / document.size.width;
    return Math.max(0.06, Math.min(scale, 0.22));
  }, [document.size.width]);

  useEffect(() => {
    let cancelled = false;
    const resolveImageHref = async (asset: { id: string }) => {
      try {
        const blob = await assetServices.blobStore.get(asset.id);
        if (blob) return await blobToDataUrl(blob);
      } catch {
        // fall through to transparent
      }
      return TRANSPARENT_PNG;
    };

    void (async () => {
      const result = await renderPageToSvg(document, {
        pageId,
        scale: thumbScale,
        resolveImageHref,
      });
      if (cancelled) return;
      if (result.ok) setSvg(result.value);
      else {
        // If resolver failed (e.g. missing asset), retry without images as fallback
        const fallback = await renderPageToSvg(document, { pageId, scale: thumbScale });
        if (!cancelled && fallback.ok) setSvg(fallback.value);
        else if (!cancelled) setSvg(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [document, pageId, thumbScale, assetServices.blobStore]);

  const width = Math.round(document.size.width * thumbScale);
  const height = Math.round(document.size.height * thumbScale);

  if (!svg) {
    // Skeleton while SVG renders
    return (
      <div
        aria-hidden="true"
        className="animate-pulse bg-muted"
        style={{ width, height }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className="bg-white"
      style={{ width, height }}
      // SVG already contains xmlns and viewBox — inject as-is
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
