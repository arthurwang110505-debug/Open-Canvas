import { collectFontUsages, renderPageToSvg } from '@opencanvas/export';
import type { DesignDocument } from '@opencanvas/document';
import { ImageOff } from 'lucide-react';
import { useEffect, useState } from 'react';

import { createCanvasTextMeasurer } from '../editor/export/browserExportServices';
import { ensureFontsLoaded } from '../fonts/embed';

interface Props {
  document: DesignDocument;
  className?: string;
}

// Documents are built once by the gallery. Reuse their previews when filters or parents rerender.
const previewCache = new WeakMap<DesignDocument, string>();

/** A font-measured preview of the actual document, not a differently laid-out approximation. */
export function TemplateThumbnail({ document, className }: Props) {
  const [preview, setPreview] = useState<{
    document: DesignDocument;
    svg: string | null;
    failed: boolean;
  }>({ document, svg: previewCache.get(document) ?? null, failed: false });
  const current =
    preview.document === document
      ? preview
      : { svg: previewCache.get(document) ?? null, failed: false };
  const svg = current.svg;
  const failed = current.failed;

  useEffect(() => {
    let cancelled = false;
    const cached = previewCache.get(document);
    if (cached) return;

    void (async () => {
      try {
        const page = document.pages[0];
        if (!page) throw new Error('This template has no pages.');
        await ensureFontsLoaded(collectFontUsages(page.elements));
        const measureText = createCanvasTextMeasurer();
        const result = await renderPageToSvg(document, {
          pageId: page.id,
          ...(measureText ? { measureText } : {}),
        });
        if (!result.ok) throw new Error(result.error.message);
        previewCache.set(document, result.value);
        if (!cancelled) setPreview({ document, svg: result.value, failed: false });
      } catch {
        if (!cancelled) setPreview({ document, svg: null, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [document]);

  const aspect = document.size.width / document.size.height;

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-2 rounded-lg bg-muted p-3 text-center ${className ?? ''}`}
        style={{ aspectRatio: String(aspect) }}
      >
        <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
        <span className="text-xs text-muted-foreground">Preview unavailable</span>
        <span className="text-xs text-muted-foreground">Open the template to try again</span>
      </div>
    );
  }

  if (!svg) {
    return (
      <div
        aria-label="Loading template preview"
        className={`animate-pulse rounded-lg bg-muted ${className ?? ''}`}
        style={{ aspectRatio: String(aspect) }}
      />
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg bg-white ${className ?? ''}`}
      style={{ aspectRatio: String(aspect) }}
    >
      <div
        aria-hidden="true"
        className="h-full w-full [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
