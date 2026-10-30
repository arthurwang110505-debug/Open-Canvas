import { LIMITS, type DesignDocument } from '@opencanvas/document';
import { Button, Dialog, Tooltip } from '@opencanvas/ui';
import { Copy, Plus, Trash2, X } from 'lucide-react';

import { PageThumbnail } from './PageThumbnail';

interface PageGridViewProps {
  document: DesignDocument;
  activePageId: string;
  onClose: () => void;
  onSelectPage: (pageId: string) => void;
  onAddPage: () => void;
  onDuplicatePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
}

/** Spacious overview for scanning, selecting, duplicating, and adding pages. */
export function PageGridView({
  document,
  activePageId,
  onClose,
  onSelectPage,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
}: PageGridViewProps) {
  const canAdd = document.pages.length < LIMITS.maxPages;
  const canDelete = document.pages.length > 1;

  return (
    <Dialog
      labelledBy="page-grid-title"
      onClose={onClose}
      className="flex h-[85dvh] max-w-6xl flex-col overflow-hidden bg-[#f8f8fa]"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-border bg-white px-5 py-3">
        <div className="min-w-0 flex-1">
          <h2 id="page-grid-title" className="text-sm font-semibold text-foreground">
            All pages
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {document.pages.length} page{document.pages.length === 1 ? '' : 's'} in this design
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!canAdd}
          onClick={onAddPage}
          className="rounded-full"
        >
          <Plus /> Add page
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close page grid"
          onClick={onClose}
          className="rounded-full"
        >
          <X />
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {document.pages.map((page, index) => {
            const active = page.id === activePageId;
            return (
              <article
                key={page.id}
                className={`group overflow-hidden rounded-xl border bg-white transition-shadow ${active ? 'border-primary shadow-[0_0_0_2px_rgba(122,92,249,0.16)]' : 'border-border hover:shadow-card'}`}
              >
                <button
                  type="button"
                  aria-label={`Go to page ${index + 1}${active ? ' (current)' : ''}`}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onSelectPage(page.id)}
                  className="flex min-h-40 w-full items-center justify-center overflow-hidden bg-[#f0f0f3] p-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="overflow-hidden rounded-sm shadow-[0_3px_10px_rgba(15,23,42,0.14)]">
                    <PageThumbnail document={document} pageId={page.id} targetWidth={160} />
                  </span>
                </button>
                <div className="flex items-center gap-2 border-t border-border px-3 py-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium outline-none focus-visible:text-primary"
                  >
                    Page {index + 1}
                    {active ? <span className="sr-only"> (current)</span> : null}
                  </button>
                  <Tooltip content="Duplicate page">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Duplicate page ${index + 1}`}
                      disabled={!canAdd}
                      onClick={() => onDuplicatePage(page.id)}
                      className="size-7 rounded-lg text-muted-foreground"
                    >
                      <Copy />
                    </Button>
                  </Tooltip>
                  <Tooltip content={canDelete ? 'Delete page' : 'At least one page is required'}>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete page ${index + 1}`}
                      disabled={!canDelete}
                      onClick={() => onDeletePage(page.id)}
                      className="size-7 rounded-lg text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </Tooltip>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
