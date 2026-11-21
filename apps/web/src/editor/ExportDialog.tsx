import {
  planVideoTimeline,
  videoFrameSize,
  VIDEO_FPS_OPTIONS,
  type VideoQuality,
} from '@opencanvas/export';
import { Button, Dialog, cn } from '@opencanvas/ui';
import { Download, FileImage, FileText, Film, LoaderCircle, PenTool, X } from 'lucide-react';
import { useId, useMemo, useState, type ReactNode } from 'react';

import { exportFileName } from '../fileNames';
import { useEditor } from './hooks';
import { PageThumbnail } from './PageThumbnail';
import {
  RASTER_SCALE,
  type ExportKind,
  type ExportOutcome,
  type ExportPageScope,
  type ExportProgress,
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
    description: 'For sharing, slides, and social posts. Can keep a transparent background.',
    icon: <FileImage />,
  },
  {
    kind: 'jpg',
    name: 'JPG',
    tag: 'Image',
    description: 'A smaller photo-style file. Transparent areas become white.',
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
  {
    kind: 'video',
    name: 'Video',
    tag: 'Animation',
    description: 'Records the entrance animations as a movie file, in this browser.',
    icon: <Film />,
  },
];

const SCALE_OPTIONS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'Standard' },
  { value: 2, label: 'Crisp' },
  { value: 3, label: 'Large' },
];

const QUALITY_OPTIONS: readonly { value: VideoQuality; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'hd', label: 'HD' },
];

/** Seconds, to one decimal, without a trailing `.0`. */
function formatSeconds(value: number): string {
  return `${(Math.round(value * 10) / 10).toString()} s`;
}

export interface ExportDialogProps {
  /** Format currently being produced by the shared export hook, if any. */
  busy: ExportKind | null;
  /** Frame progress while a video is rendering. */
  progress?: ExportProgress | null;
  /** False in a browser without `MediaRecorder`: the video option says so instead of failing. */
  videoSupported?: boolean;
  onExport: (
    kind: ExportKind,
    options?: {
      scale?: number;
      pageScope?: ExportPageScope;
      transparent?: boolean;
      fps?: number;
      quality?: VideoQuality;
    },
  ) => Promise<ExportOutcome>;
  onClose: () => void;
}

/**
 * Downloading is where a design leaves the app, so the dialog states exactly what will be
 * produced — format, pages, and pixel dimensions — before anything is rendered. Every option
 * shown here maps to a real capability of the export pipeline; nothing is decorative.
 */
export function ExportDialog({
  busy,
  progress = null,
  videoSupported = true,
  onExport,
  onClose,
}: ExportDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const document = useEditor((state) => state.document);
  const activePageId = useEditor((state) => state.activePageId);
  const [format, setFormat] = useState<ExportKind>('png');
  const [scale, setScale] = useState<number>(RASTER_SCALE);
  const [pageScope, setPageScope] = useState<ExportPageScope>('all');
  const [transparent, setTransparent] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(30);
  const [quality, setQuality] = useState<VideoQuality>('standard');
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
  // The recorder decides the container, so the dialog names the common case and the note
  // under the video options explains the other one.
  const filename = exportFileName(document.name, format === 'video' ? 'webm' : format);

  const isRaster = format === 'png' || format === 'jpg';
  const isVideo = format === 'video';

  // The timeline is planned here so the dialog can state the real length and frame count
  // before anything is rendered — the same plan the recorder will follow.
  const video = useMemo(() => {
    const pageIds = pageScope === 'all' ? document.pages.map((page) => page.id) : [activePageId];
    const planned = planVideoTimeline(document, { pageIds, fps });
    const size = videoFrameSize(document.size, quality);
    return { plan: planned.ok ? planned.value : null, size };
  }, [activePageId, document, fps, pageScope, quality]);

  const videoPageLabel =
    pageScope === 'all'
      ? `${pageCount.toString()} ${pageCount === 1 ? 'page' : 'pages'}`
      : pageLabel.toLowerCase();

  const summary =
    format === 'png'
      ? `${outputWidth} × ${outputHeight} px · ${pageLabel.toLowerCase()} (current page only)${
          transparent ? ' · transparent background' : ''
        }`
      : format === 'jpg'
        ? `${outputWidth} × ${outputHeight} px · ${pageLabel.toLowerCase()} (current page only)`
        : format === 'svg'
          ? `${document.size.width} × ${document.size.height} · vector · current page only`
          : format === 'video'
            ? video.plan
              ? `${video.size.width.toString()} × ${video.size.height.toString()} px · ${fps.toString()} fps · ${formatSeconds(
                  video.plan.duration,
                )} · ${videoPageLabel}`
              : 'This design has no pages to record.'
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
      scale: isRaster ? scale : RASTER_SCALE,
      pageScope: format === 'pdf' || isVideo ? pageScope : 'current',
      ...(format === 'png' ? { transparent } : {}),
      ...(isVideo ? { fps, quality } : {}),
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
                const unavailable = option.kind === 'video' && !videoSupported;
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-disabled={unavailable}
                    aria-label={`${option.name} — ${option.tag.toLowerCase()}`}
                    onClick={() => {
                      if (!unavailable) chooseFormat(option.kind);
                    }}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:mt-0.5 [&_svg]:size-5 [&_svg]:shrink-0',
                      selected
                        ? 'border-primary bg-primary/5 [&_svg]:text-primary'
                        : 'border-border bg-panel hover:border-primary/40 [&_svg]:text-muted-foreground',
                      unavailable && 'cursor-not-allowed opacity-60 hover:border-border',
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
                        {unavailable
                          ? 'This browser cannot record video. Try Chrome, Edge, or Firefox.'
                          : option.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>

            {isRaster ? (
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

            {format === 'png' ? (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-panel px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(event) => setTransparent(event.target.checked)}
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-sm font-medium">Transparent background</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                    Leaves the page background out, so the PNG has no background color.
                  </span>
                </span>
              </label>
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

            {isVideo ? (
              <>
                <div>
                  <p id="export-fps-label" className="text-xs font-medium">
                    Frame rate
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="export-fps-label"
                    className="mt-1.5 flex gap-1.5"
                  >
                    {VIDEO_FPS_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={fps === option}
                        aria-label={`${option.toString()} frames per second`}
                        onClick={() => setFps(option)}
                        className={cn(
                          'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          fps === option
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {option} fps
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p id="export-quality-label" className="text-xs font-medium">
                    Quality
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="export-quality-label"
                    className="mt-1.5 flex gap-1.5"
                  >
                    {QUALITY_OPTIONS.map((option) => {
                      const size = videoFrameSize(document.size, option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="radio"
                          aria-checked={quality === option.value}
                          aria-label={`${option.label} — ${size.width.toString()} by ${size.height.toString()} pixels`}
                          onClick={() => setQuality(option.value)}
                          className={cn(
                            'flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            quality === option.value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {option.label} · {size.width}p
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p id="export-video-pages-label" className="text-xs font-medium">
                    Pages
                  </p>
                  <div
                    role="radiogroup"
                    aria-labelledby="export-video-pages-label"
                    className="mt-1.5 flex gap-1.5"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={pageScope === 'all'}
                      aria-label={`All pages (${pageCount.toString()})`}
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
                </div>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {video.plan && !video.plan.animated
                    ? 'Nothing here is animated yet, so the video holds the design still. Add an entrance under Animate in the Properties panel.'
                    : 'Each page plays its entrance animations, then holds. Recorded in this browser, so the design never leaves your device.'}
                  {video.plan?.truncated
                    ? ' The design is longer than this format allows, so the recording stops partway.'
                    : ''}{' '}
                  Saved as WebM, or MP4 where that is what the browser records.
                </p>
              </>
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
            {exporting
              ? progress
                ? `Rendering frame ${progress.completed.toString()} of ${progress.total.toString()}…`
                : 'Preparing…'
              : `Download ${format === 'video' ? 'video' : format.toUpperCase()}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
