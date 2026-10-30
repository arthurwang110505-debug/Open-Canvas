import { CANVAS_PRESETS, LIMITS, type DesignDocument } from '@opencanvas/document';
import { adaptElementsToSize, type ResizeAdaptMode } from '@opencanvas/editor-core';
import { Button, Dialog, cn } from '@opencanvas/ui';
import { Expand, LoaderCircle, Scaling, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { useEditorActions } from './actions';
import { useCreateResizedCopy, useEditor, useNotificationStore } from './hooks';
import { PageThumbnail } from './PageThumbnail';
import { NumberField } from './panels/fields';

export interface ResizeDialogProps {
  onClose: () => void;
}

const MODE_OPTIONS: readonly {
  id: ResizeAdaptMode;
  label: string;
  description: string;
}[] = [
  {
    id: 'fit',
    label: 'Fit content',
    description: 'Keeps every proportion. Content is centred, so empty space may appear.',
  },
  {
    id: 'scale',
    label: 'Stretch to fill',
    description: 'Fills the whole page. Shapes and photos may change proportions.',
  },
];

/**
 * Resizing changes the canvas under every page, so the dialog previews the result before
 * committing: the target size, how content adapts, and a rendered preview of the current
 * page. Resizing this design is one undo step; creating a copy leaves the original alone.
 */
export function ResizeDialog({ onClose }: ResizeDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const document = useEditor((state) => state.document);
  const activePageId = useEditor((state) => state.activePageId);
  const { resizeDesign } = useEditorActions();
  const createResizedCopy = useCreateResizedCopy();
  const notifications = useNotificationStore();

  const currentPreset = CANVAS_PRESETS.find(
    (preset) => preset.width === document.size.width && preset.height === document.size.height,
  );
  const [presetId, setPresetId] = useState<string>(currentPreset?.id ?? 'custom');
  const [customWidth, setCustomWidth] = useState(document.size.width);
  const [customHeight, setCustomHeight] = useState(document.size.height);
  const [mode, setMode] = useState<ResizeAdaptMode>('fit');
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preset = CANVAS_PRESETS.find((candidate) => candidate.id === presetId);
  const width = preset ? preset.width : customWidth;
  const height = preset ? preset.height : customHeight;
  const unchanged = width === document.size.width && height === document.size.height;
  const pageCount = document.pages.length;

  const previewDocument = useMemo<DesignDocument>(
    () => ({
      ...document,
      size: { width, height },
      pages: document.pages.map((page) => ({
        ...page,
        elements: adaptElementsToSize(page.elements, document.size, { width, height }, mode),
      })),
    }),
    [document, width, height, mode],
  );

  const activePageIndex = Math.max(
    0,
    document.pages.findIndex((page) => page.id === activePageId),
  );

  const handleResizeThisDesign = () => {
    resizeDesign(width, height, mode);
    notifications.getState().show({
      kind: 'info',
      title: 'Design resized',
      message: `Now ${width} × ${height}px on every page. One undo restores the previous size and layout.`,
    });
    onClose();
  };

  const handleCreateCopy = async () => {
    if (!createResizedCopy) return;
    setCopying(true);
    setError(null);
    const label = preset ? preset.label : `${width}×${height}`;
    const created = await createResizedCopy({
      name: `${document.name} · ${label}`,
      size: { width, height },
      pages: previewDocument.pages,
    });
    setCopying(false);
    if (created) onClose();
    else
      setError(
        'The resized copy could not be saved in this browser. Try resizing this design instead.',
      );
  };

  return (
    <Dialog labelledBy={titleId} describedBy={descriptionId} onClose={onClose} className="max-w-xl">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="flex items-center gap-2 text-lg font-semibold">
              <Expand className="size-5 text-primary" /> Resize design
            </h2>
            <p id={descriptionId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              From {document.size.width} × {document.size.height}px to {width} × {height}px on every
              page. Preview first — nothing changes until you confirm.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={onClose}
            disabled={copying}
            aria-label="Close resize dialog"
          >
            <X />
          </Button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[172px_minmax(0,1fr)]">
          <figure className="flex flex-col items-center gap-2">
            <div className="flex min-h-32 items-center overflow-hidden rounded-lg border border-border shadow-sm">
              <PageThumbnail document={previewDocument} pageId={activePageId} targetWidth={172} />
            </div>
            <figcaption className="text-center text-[11px] text-muted-foreground">
              Preview · page {activePageIndex + 1} of {pageCount}
            </figcaption>
          </figure>

          <div className="flex min-w-0 flex-col gap-4">
            <div>
              <p id="resize-preset-label" className="text-xs font-medium">
                New size
              </p>
              <div
                role="group"
                aria-labelledby="resize-preset-label"
                className="mt-1.5 grid grid-cols-2 gap-1.5"
              >
                {CANVAS_PRESETS.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    aria-pressed={presetId === candidate.id}
                    onClick={() => setPresetId(candidate.id)}
                    className={cn(
                      'rounded-lg border px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      presetId === candidate.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/40',
                    )}
                  >
                    <span className="block truncate text-xs font-medium">{candidate.label}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {candidate.width}×{candidate.height}
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={presetId === 'custom'}
                  onClick={() => setPresetId('custom')}
                  className={cn(
                    'rounded-lg border px-2 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    presetId === 'custom'
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40',
                  )}
                >
                  <span className="block text-xs font-medium">Custom size</span>
                  <span className="block text-[11px] text-muted-foreground">Any dimensions</span>
                </button>
              </div>
              {presetId === 'custom' ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <NumberField
                    label="Width"
                    value={customWidth}
                    min={LIMITS.minCanvasDimension}
                    max={LIMITS.maxCanvasDimension}
                    precision={0}
                    unit="px"
                    onCommit={setCustomWidth}
                  />
                  <NumberField
                    label="Height"
                    value={customHeight}
                    min={LIMITS.minCanvasDimension}
                    max={LIMITS.maxCanvasDimension}
                    precision={0}
                    unit="px"
                    onCommit={setCustomHeight}
                  />
                </div>
              ) : null}
            </div>

            <div>
              <p id="resize-mode-label" className="text-xs font-medium">
                How should content adapt?
              </p>
              <div
                role="radiogroup"
                aria-labelledby="resize-mode-label"
                className="mt-1.5 flex flex-col gap-1.5"
              >
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={mode === option.id}
                    aria-label={option.label}
                    onClick={() => setMode(option.id)}
                    className={cn(
                      'flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',
                      mode === option.id
                        ? 'border-primary bg-primary/5 [&_svg]:text-primary'
                        : 'border-border hover:border-primary/40 [&_svg]:text-muted-foreground',
                    )}
                  >
                    <Scaling aria-hidden="true" />
                    <span>
                      <span className="block text-xs font-semibold">{option.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                        {option.description}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <p aria-live="polite" className="text-xs font-medium">
              {unchanged
                ? 'That is the current size — pick a different one to resize.'
                : `${pageCount} ${pageCount === 1 ? 'page' : 'pages'} · ${width} × ${height}px · content ${mode === 'fit' ? 'fitted' : 'stretched'}`}
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

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="rounded-full" onClick={onClose} disabled={copying}>
            Cancel
          </Button>
          <Button
            variant={createResizedCopy ? 'outline' : 'default'}
            className="rounded-full"
            onClick={handleResizeThisDesign}
            disabled={unchanged || copying}
            data-autofocus={!createResizedCopy}
          >
            Resize this design
          </Button>
          {createResizedCopy ? (
            <Button
              className="rounded-full"
              onClick={() => void handleCreateCopy()}
              disabled={unchanged || copying}
              data-autofocus
            >
              {copying ? <LoaderCircle className="animate-spin" /> : <Expand aria-hidden="true" />}
              {copying ? 'Creating copy…' : 'Create resized copy'}
            </Button>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}
