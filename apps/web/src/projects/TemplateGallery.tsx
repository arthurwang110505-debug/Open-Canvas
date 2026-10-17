import type { DesignDocument } from '@opencanvas/document';
import { renderPageToSvg, svgDataUrl } from '@opencanvas/export';
import {
  CATEGORY_LABELS,
  instantiateTemplate,
  TEMPLATES,
  type TemplateDefinition,
} from '@opencanvas/templates';
import { useEffect, useMemo, useState } from 'react';

/**
 * Preview documents are instantiated once per template: a definition is static data, so the
 * preview geometry never changes during a session.
 */
const previewDocuments = new Map<string, DesignDocument>();

function previewDocument(template: TemplateDefinition): DesignDocument | undefined {
  const cached = previewDocuments.get(template.id);
  if (cached) return cached;
  const created = instantiateTemplate(template);
  if (!created.ok) return undefined;
  previewDocuments.set(template.id, created.value);
  return created.value;
}

type PreviewState =
  { status: 'pending' } | { status: 'ready'; src: string } | { status: 'failed'; message: string };

/**
 * The thumbnail is the real thing: the template is instantiated and rendered with the same SVG
 * renderer that powers export, so the gallery shows what the design will look like.
 */
function TemplatePreview({ template }: { template: TemplateDefinition }) {
  const document = useMemo(() => previewDocument(template), [template]);
  const [preview, setPreview] = useState<PreviewState>(() =>
    document
      ? { status: 'pending' }
      : { status: 'failed', message: 'This template could not be instantiated.' },
  );

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    void renderPageToSvg(document, { scale: 1 }).then((rendered) => {
      if (cancelled) return;
      setPreview(
        rendered.ok
          ? { status: 'ready', src: svgDataUrl(rendered.value) }
          : { status: 'failed', message: rendered.error.message },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [document]);

  return (
    <span className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border border-border bg-muted">
      {preview.status === 'ready' ? (
        <img src={preview.src} alt="" className="max-h-full max-w-full object-contain" />
      ) : (
        <span className="px-2 text-center text-xs text-muted-foreground">
          {preview.status === 'pending' ? 'Preparing preview…' : preview.message}
        </span>
      )}
    </span>
  );
}

export interface TemplateGalleryProps {
  /** Disables every card while another dashboard action is running. */
  busy: boolean;
  onUse: (template: TemplateDefinition) => void;
}

export function TemplateGallery({ busy, onUse }: TemplateGalleryProps) {
  return (
    <section aria-labelledby="templates-heading" className="space-y-3">
      <div>
        <h2 id="templates-heading" className="text-lg font-semibold tracking-tight">
          Start from a template
        </h2>
        <p className="text-sm text-muted-foreground">
          {TEMPLATES.length} original templates ship with OpenCanvas — shapes and text only, no
          stock assets. Everything stays editable once the design is created.
        </p>
      </div>

      <ul aria-label="Templates" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => (
          <li key={template.id}>
            <button
              type="button"
              disabled={busy}
              aria-label={`Create a design from the ${template.name} template`}
              onClick={() => onUse(template)}
              className="flex w-full flex-col gap-2 rounded-lg border border-border bg-panel p-3 text-left transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TemplatePreview template={template} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{template.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {CATEGORY_LABELS[template.category]} · {template.width} × {template.height} px
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {template.description}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
