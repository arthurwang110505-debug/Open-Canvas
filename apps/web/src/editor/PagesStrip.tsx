import { LIMITS } from '@opencanvas/document';
import { Button, Tooltip } from '@opencanvas/ui';
import { ChevronLeft, ChevronRight, Copy, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from 'react';

import { PageGridView } from './PageGridView';
import { PageThumbnail } from './PageThumbnail';
import { useEditor } from './hooks';
import { useMediaQuery } from '../useMediaQuery';

interface PageContextMenuState {
  pageId: string;
  x: number;
  y: number;
}

/** Bottom filmstrip with live thumbnails, drag reorder, and the all-pages grid. */
export function PagesStrip() {
  const document = useEditor((state) => state.document);
  const activePageId = useEditor((state) => state.activePageId);
  const dispatch = useEditor((state) => state.dispatch);
  const setActivePage = useEditor((state) => state.setActivePage);
  const pages = document.pages;
  const canDelete = pages.length > 1;
  const canAdd = pages.length < LIMITS.maxPages;
  const stripRef = useRef<HTMLDivElement | null>(null);
  const draggedPageId = useRef<string | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<string | null>(null);
  const [pageContextMenu, setPageContextMenu] = useState<PageContextMenuState | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const compact = useMediaQuery('(max-width: 639px)');

  const onAddPage = useCallback(() => {
    if (!canAdd) return;
    dispatch({ type: 'page.add', afterPageId: activePageId });
  }, [dispatch, activePageId, canAdd]);

  const onDuplicate = useCallback(
    (pageId: string) => {
      if (canAdd) dispatch({ type: 'page.duplicate', pageId });
    },
    [dispatch, canAdd],
  );

  const onDelete = useCallback(
    (pageId: string) => {
      if (canDelete) dispatch({ type: 'page.delete', pageId });
    },
    [dispatch, canDelete],
  );

  const onMove = useCallback(
    (pageId: string, direction: -1 | 1) => {
      const from = pages.findIndex((page) => page.id === pageId);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= pages.length) return;
      dispatch({ type: 'page.reorder', pageId, toIndex: to });
    },
    [dispatch, pages],
  );

  const onDragStart = (event: DragEvent<HTMLDivElement>, pageId: string) => {
    draggedPageId.current = pageId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', pageId);
  };

  const onDragOver = (event: DragEvent<HTMLDivElement>, pageId: string) => {
    if (!draggedPageId.current || draggedPageId.current === pageId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverPageId(pageId);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>, targetPageId: string) => {
    event.preventDefault();
    const draggedId = draggedPageId.current ?? event.dataTransfer.getData('text/plain');
    const from = pages.findIndex((page) => page.id === draggedId);
    const to = pages.findIndex((page) => page.id === targetPageId);
    if (from !== -1 && to !== -1 && from !== to) {
      dispatch({ type: 'page.reorder', pageId: draggedId, toIndex: to });
    }
    draggedPageId.current = null;
    setDragOverPageId(null);
  };

  const clearDrag = () => {
    draggedPageId.current = null;
    setDragOverPageId(null);
  };

  const openPageMenu = (event: MouseEvent<HTMLDivElement>, pageId: string) => {
    event.preventDefault();
    const rect = stripRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPageContextMenu({
      pageId,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top - 150,
    });
  };

  useEffect(() => {
    if (!pageContextMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!stripRef.current?.contains(event.target as Node)) setPageContextMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPageContextMenu(null);
    };
    window.document.addEventListener('pointerdown', onPointerDown);
    window.document.addEventListener('keydown', onKeyDown);
    return () => {
      window.document.removeEventListener('pointerdown', onPointerDown);
      window.document.removeEventListener('keydown', onKeyDown);
    };
  }, [pageContextMenu]);

  const contextPageIndex = pageContextMenu
    ? pages.findIndex((page) => page.id === pageContextMenu.pageId)
    : -1;
  const activePageIndex = Math.max(
    0,
    pages.findIndex((page) => page.id === activePageId),
  );

  return (
    <>
      <div
        ref={stripRef}
        role="group"
        aria-label="Pages"
        className="pointer-events-auto absolute bottom-2 left-2 z-20 flex max-w-none items-center gap-1.5 rounded-2xl border border-border bg-white px-1.5 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12)] sm:bottom-3 sm:left-3 sm:right-40 sm:gap-2 sm:px-2 sm:py-2 lg:left-1/2 lg:right-auto lg:max-w-[calc(100%_-_22rem)] lg:-translate-x-1/2"
      >
        <Tooltip content="Grid view">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open page grid"
            onClick={() => setShowGrid(true)}
            className="size-10 shrink-0 rounded-xl sm:size-8"
          >
            <LayoutGrid />
          </Button>
        </Tooltip>
        {compact ? (
          <button
            type="button"
            aria-label={`View all pages. Page ${activePageIndex + 1} of ${pages.length}`}
            onClick={() => setShowGrid(true)}
            className="flex h-10 shrink-0 items-center rounded-xl px-2 text-xs font-semibold whitespace-nowrap outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
          >
            {activePageIndex + 1} / {pages.length}
          </button>
        ) : (
          <div className="flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-thin">
            {pages.map((page, index) => {
              const isActive = page.id === activePageId;
              const isDropTarget = dragOverPageId === page.id;
              return (
                <div
                  key={page.id}
                  draggable
                  onDragStart={(event) => onDragStart(event, page.id)}
                  onDragOver={(event) => onDragOver(event, page.id)}
                  onDrop={(event) => onDrop(event, page.id)}
                  onDragEnd={clearDrag}
                  onContextMenu={(event) => openPageMenu(event, page.id)}
                  className={`group relative flex shrink-0 flex-col items-center gap-1 rounded-xl px-0.5 pt-0.5 ${isDropTarget ? 'ring-2 ring-primary ring-offset-2' : ''}`}
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
                    <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/10 to-transparent px-1 py-0.5 text-center text-[10px] font-medium text-foreground/70">
                      {index + 1}
                    </span>
                  </button>
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
                        disabled={!canAdd}
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
        )}
        <div className="ml-0.5 flex shrink-0 items-center border-l border-border pl-1.5 sm:ml-1 sm:pl-2">
          <Tooltip content={canAdd ? 'Add page' : `Maximum ${LIMITS.maxPages} pages`}>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Add page"
              disabled={!canAdd}
              onClick={onAddPage}
              className="size-10 rounded-full px-0 sm:h-8 sm:w-auto sm:px-3"
            >
              <Plus className="size-4" /> <span className="hidden md:inline">Add page</span>
            </Button>
          </Tooltip>
        </div>
        {pageContextMenu && contextPageIndex >= 0 ? (
          <div
            role="menu"
            aria-label={`Page ${contextPageIndex + 1} actions`}
            style={{ left: pageContextMenu.x, top: pageContextMenu.y }}
            className="absolute z-50 min-w-44 rounded-xl border border-border bg-white p-1.5 shadow-[0_12px_32px_rgba(16,24,40,0.18)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setActivePage(pageContextMenu.pageId);
                setPageContextMenu(null);
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted"
            >
              Open page {contextPageIndex + 1}
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canAdd}
              onClick={() => {
                onDuplicate(pageContextMenu.pageId);
                setPageContextMenu(null);
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-muted disabled:opacity-50"
            >
              Duplicate page
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canDelete}
              onClick={() => {
                onDelete(pageContextMenu.pageId);
                setPageContextMenu(null);
              }}
              className="w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-destructive hover:bg-muted disabled:opacity-50"
            >
              Delete page
            </button>
          </div>
        ) : null}
      </div>
      {showGrid ? (
        <PageGridView
          document={document}
          activePageId={activePageId}
          onClose={() => setShowGrid(false)}
          onSelectPage={(pageId) => {
            setActivePage(pageId);
            setShowGrid(false);
          }}
          onAddPage={onAddPage}
          onDuplicatePage={onDuplicate}
          onDeletePage={onDelete}
        />
      ) : null}
    </>
  );
}
