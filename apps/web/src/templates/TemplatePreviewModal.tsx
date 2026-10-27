import { Button } from '@opencanvas/ui';
import { ArrowRight, Check, X } from 'lucide-react';
import { useMemo } from 'react';

import { getTemplate } from './catalog';
import { TemplateThumbnail } from './TemplateThumbnail';
import { templatePalette } from './templateMetadata';
import { Modal } from '../projects/Modal';

interface TemplatePreviewModalProps {
  templateId: string;
  busy?: boolean;
  onClose: () => void;
  onUse: (templateId: string) => void;
}

export function TemplatePreviewModal({
  templateId,
  busy = false,
  onClose,
  onUse,
}: TemplatePreviewModalProps) {
  const template = getTemplate(templateId);
  const document = useMemo(() => template?.build() ?? null, [template]);

  if (!template || !document) return null;
  const size = `${document.size.width} × ${document.size.height} px`;
  const colors = templatePalette(document);

  return (
    <Modal labelledBy="template-preview-title" onClose={onClose} className="max-w-[920px]">
      <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5 sm:px-7">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            {template.category} template
          </p>
          <h2
            id="template-preview-title"
            className="mt-1 truncate text-xl font-bold tracking-tight sm:text-2xl"
          >
            {template.label}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{template.description}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close template preview"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] sm:p-7">
        <div className="flex min-h-56 items-center justify-center rounded-2xl bg-[#f4f3f8] p-5 sm:min-h-[390px]">
          <TemplateThumbnail
            document={document}
            className="max-h-[360px] w-full max-w-[560px] shadow-sm"
          />
        </div>
        <div className="flex flex-col">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium capitalize">
              {template.category}
            </span>
            <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium">{size}</span>
          </div>
          <h3 className="mt-6 text-sm font-semibold">Designed with</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {template.tags.slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <h3 className="mt-6 text-sm font-semibold">Color palette</h3>
          <div className="mt-2 flex items-center gap-2">
            {colors.map((color) => (
              <span
                key={color}
                title={color.toUpperCase()}
                aria-label={color.toUpperCase()}
                className="size-8 rounded-full border border-black/10 shadow-sm"
                style={{ backgroundColor: color }}
              />
            ))}
            {colors.length === 0 ? (
              <span className="text-xs text-muted-foreground">No colors</span>
            ) : null}
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Make it yours: every text, shape, and color can be changed in the editor.
          </p>
          <div className="mt-auto pt-7">
            <Button
              onClick={() => onUse(template.id)}
              disabled={busy}
              className="h-11 w-full rounded-full px-5 shadow-sm"
            >
              <Check className="size-4" />
              {busy ? 'Opening…' : 'Use this template'}
              {!busy ? <ArrowRight className="ml-auto size-4" /> : null}
            </Button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Back to templates
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
