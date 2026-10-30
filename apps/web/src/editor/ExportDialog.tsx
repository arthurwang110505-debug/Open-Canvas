import { Button, Dialog, cn } from '@opencanvas/ui';
import { Download, FileImage, FileText, LoaderCircle, PenTool, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { exportFileName } from '../fileNames';
import { useEditor } from './hooks';
import { PageThumbnail } from './PageThumbnail';
import {
  RASTER_SCALE,
  type ExportKind,
  type ExportOutcome,
  type ExportPageScope,
} from './export/useDesignExport';

interface FormatOption {
  kind: ExportKind;
  name: string;
  tag: string;
  description: string;
  icon: ReactNode;
}

const FORMATS: readonly FormatOption[] = [
  {
    kind: 'png',
    name: 'PNG',
    tag: 'Image',
    description: 'For sharing, slides, and social posts.',
    icon: <FileImage />,
  },
  {
    kind: 'svg',
    name: 'SVG',
    tag: 'Vector',
    description: 'Scales to any size without losing quality.',
    icon: <PenTool />,
  },
  {
    kind: 'pdf',
    name: 'PDF',
    tag: 'Document',
    description: 'One file with a page for each design page.',
    icon: <FileText />,
  },
];

const SCALE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Standard' },
  { value: 2, label: 'Crisp' },
  { value: 3, label: 'Large' },
];

export interface ExportDialogProps {
  /** Format currently being produced by the shared export hook, if any. */
  busy: ExportKind | null;
  onExport: (
    kind: ExportKind,
    options?: { scale?: number; pageScope?: ExportPageScope },
  ) => Promise<ExportOutcome>;
  onClose: () => void;
}

/**
 * Downloading is where a design leaves the app, so the dialog states exactly what will be
 * produced — format, pages, and pixel dimensions — before anything is rendered. Every option
 * shown here maps to a real capability of the export pipeline; nothing is decorative.
 */
export function ExportDialog({ busy, onExport, onClose }: ExportDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const document = useEditor((state) => state.document);
  const activePageId = useEditor((state) => state.activePageId);
  const [format, setFormat] = useState<ExportKind>('png');
  const [scale, setScale] = useState<number>(RASTER_SCALE);
  const [pageScope, setPageScope] = useState<ExportPageScope>('all');
  const [error, setError] = useState<string | null>(null);

  const exporting = busy !== null;
  const pageCount = document.pages.length;
  const activePageIndex = Math.max(
    0,
    document.pages.findIndex((page) => page.id === activePageId),
  );
  const pageLabel = `Page ${activePageIndex + 1} of ${pageCount}`;
  const outputWidth = Math.round(document.size.width * scale);
  const outputHeight = Math.round(document.size.height * scale);
  const filename = exportFileName(document.name, format);

  const summary =
    format === 'png'
      ? `${outputWidth} × ${outputHeight} px · ${pageLabel.toLowerCase()} (current page only)`
      : format === 'svg'
        ? `${document.size.width} × ${document.size.height} · vector · current page only`
        : pageScope === 'all'
          ? `All ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} · rendered as images at ${RASTER_SCALE}×`
          : `${pageLabel} only · rendered as an image at ${RASTER_SCALE}×`;

  const chooseFormat = (kind: ExportKind) => {
    setFormat(kind);
    setError(null);
  };

  const handleDownload = async () => {
    setError(null);
    const outcome = await onExport(format, {
      scale: format === 'png' ? scale : RASTER_SCALE,
      pageScope: format === 'pdf' ? pageScope : 'current',
    });
    if (outcome.ok) onClose();
    else setError(outcome.error);
  };

  return (
    <Dialog labelledBy={titleId} describedBy={descriptionId} onClose={onClose} className="max-w-xl">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
              <Download className="size-5 text-primary" /> Download design
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              You will get <span className="font-mono text-[13px] text-foreground">{filename}</span>{' '}
              — check the format and size before downloading.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onClose}
            disabled={exporting}
            aria-label="Close download dialog"
          >
            <X />
          </Button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[172px_minmax(0,1fr)]">
          <figure className="flex flex-col items-center gap-2">
            <div className="overflow-hidden rounded-lg border border-border shadow-sm">
              <PageThumbnail document={document} pageId={activePageId} targetWidth={172} />
            </div>
            <figcaption className="text-center text-[11px] text-muted-foreground">
              Preview · {pageLabel.toLowerCase()}
            </figcaption>
          </figure>

          <div className="flex min-w-0 flex-col gap-4">
            <div role="radiogroup" aria-label="File format" className="flex flex-col gap-2">
              {FORMATS.map((option) => {
                const selected = format === option.kind;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${option.name} — ${option.tag.toLowerCase()}`}
                    onClick={() => chooseFormat(option.kind)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0',
                      selected
                        ? 'border-primary bg-primary/5 [&_svg]:text-primary'
                        : 'border-border bg-panel hover:border-primary/40 [&_svg]:text-muted-foreground',
                    )}
                  >
                    {option.icon}
                    <span className="min-w-0">
                      <span className="flex items-baseline gap-2">
                        <span className="text-sm font-semibold">{option.name}</span>
                        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {option.tag}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {format === 'png' ? (
              <div>
                <p id="export-scale-label" className="text-xs font-medium">
                  Size
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="export-scale-label"
                  className="mt-1.5 flex gap-1.5"
                >
                  {SCALE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={scale === option.value}
                      aria-label={`${option.value}× — ${option.label.toLowerCase()}`}
                      onClick={() => setScale(option.value)}
                      className={cn(
                        'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        scale === option.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {option.value}× {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {format === 'pdf' ? (
              <div>
                <p id="export-pages-label" className="text-xs font-medium">
                  Pages
                </p>
                <div
                  role="radiogroup"
                  aria-labelledby="export-pages-label"
                  className="mt-1.5 flex gap-1.5"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={pageScope === 'all'}
                    aria-label={`All pages (${pageCount})`}
                    onClick={() => setPageScope('all')}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      pageScope === 'all'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    All pages ({pageCount})
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={pageScope === 'current'}
                    aria-label="Current page only"
                    onClick={() => setPageScope('current')}
                    className={cn(
                      'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      pageScope === 'current'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Current page only
                  </button>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                  PDF pages are rendered as images, so text stays sharp but can’t be selected or
                  copied.
                </p>
              </div>
            ) : null}

            {format === 'svg' ? (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Fonts are embedded when possible, so the file keeps its typefaces on other machines.
              </p>
            ) : null}

            <p aria-live="polite" className="text-xs font-medium text-foreground">
              {summary}
            </p>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            className="rounded-full"
            onClick={() => void handleDownload()}
            disabled={exporting}
            data-autofocus
          >
            {exporting ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {exporting ? 'Preparing…' : `Download ${format.toUpperCase()}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
