import { renderPageToSvg } from '@opencanvas/export';
import { useEffect, useMemo, useState } from 'react';

import { resolveAssetHref } from './assets/assetHref';
import { useAssetServices } from './assets/useAssetServices';

interface PageThumbnailProps {
  document: Parameters<typeof renderPageToSvg>[0];
  pageId: string;
  targetWidth?: number;
}

/** Live SVG page preview shared by the filmstrip and the all-pages grid. */
export function PageThumbnail({ document, pageId, targetWidth = 110 }: PageThumbnailProps) {
  const assetServices = useAssetServices();
  const [svg, setSvg] = useState<string | null>(null);
  const thumbScale = useMemo(() => {
    const scale = targetWidth / document.size.width;
    return Math.max(0.06, Math.min(scale, 0.32));
  }, [document.size.width, targetWidth]);

  useEffect(() => {
    let cancelled = false;
    const resolveImageHref = (asset: Parameters<typeof resolveAssetHref>[0]) =>
      resolveAssetHref(asset, assetServices.blobStore);

    void (async () => {
      const result = await renderPageToSvg(document, {
        pageId,
        scale: thumbScale,
        resolveImageHref,
      });
      if (cancelled) return;
      if (result.ok) setSvg(result.value);
      else {
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
    return <div aria-hidden="true" className="animate-pulse bg-muted" style={{ width, height }} />;
  }

  return (
    <div
      aria-hidden="true"
      className="bg-white"
      style={{ width, height }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
