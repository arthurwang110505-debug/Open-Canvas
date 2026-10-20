import { renderPageToSvg } from '@opencanvas/export';
import type { DesignDocument } from '@opencanvas/document';
import { useEffect, useState } from 'react';

interface Props {
  document: DesignDocument;
  className?: string;
}

export function TemplateThumbnail({ document, className }: Props) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const page = document.pages[0];
      if (!page) return;
      const res = await renderPageToSvg(document, { pageId: page.id });
      if (!cancelled && res.ok) setSvg(res.value);
    })();
    return () => {
      cancelled = true;
    };
  }, [document]);

  const aspect = document.size.width / document.size.height;

  if (!svg) {
    return (
      <div
        className={`rounded-xl bg-muted animate-pulse ${className ?? ''}`}
        style={{ aspectRatio: String(aspect) }}
      />
    );
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-white ${className ?? ''}`}
      style={{ aspectRatio: String(aspect) }}
    >
      <div
        aria-hidden="true"
        className="flex h-full w-full items-center justify-center overflow-hidden bg-white [&_svg]:h-full [&_svg]:w-full [&_svg]:object-contain"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
