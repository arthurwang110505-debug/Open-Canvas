import { renderPageToSvg } from '@opencanvas/export';
import { useEffect, useState } from 'react';

import { resolveAssetHref } from '../editor/assets/assetHref';
import { useProjects } from './useProjects';
import type { ProjectSummary } from '@opencanvas/storage';

// Simple in-memory cache so navigating back to dashboard doesn't re-render all thumbnails
const svgCache = new Map<string, string>();

interface ProjectThumbnailProps {
  project: ProjectSummary;
}

/**
 * Live preview of a project's first page. Uses the same SVG renderer that export does,
 * so the dashboard shows exactly what will be saved — including groups and multi-page.
 * Falls back to the gradient mock while loading or if the document can't be read.
 */
export function ProjectThumbnail({ project }: ProjectThumbnailProps) {
  const { store } = useProjects();
  const cacheKey = `${project.id}::${project.updatedAt}`;
  // The cache is keyed by project + updatedAt, so a changed key derives a new value in render
  // (React's recommended pattern) instead of setting state synchronously inside the effect.
  const [rendered, setRendered] = useState<{ key: string; svg: string | null }>(() => ({
    key: cacheKey,
    svg: svgCache.get(cacheKey) ?? null,
  }));
  if (rendered.key !== cacheKey) {
    setRendered({ key: cacheKey, svg: svgCache.get(cacheKey) ?? null });
  }
  const svg = rendered.key === cacheKey ? rendered.svg : null;

  useEffect(() => {
    if (svgCache.has(cacheKey)) return;
    let cancelled = false;
    void (async () => {
      const loaded = await store.load(project.id);
      if (cancelled) return;
      if (!loaded.ok) {
        return;
      }
      const doc = loaded.value;
      const firstPage = doc.pages[0];
      if (!firstPage) return;

      const blobStore = store.assetBlobStore(project.id);
      const resolveImageHref = (asset: Parameters<typeof resolveAssetHref>[0]) =>
        resolveAssetHref(asset, blobStore);

      // Render at full size — CSS scales the SVG to the card; this keeps vectors crisp
      let result = await renderPageToSvg(doc, {
        pageId: firstPage.id,
        resolveImageHref,
      });
      if (!result.ok) {
        // Fallback for docs without images where resolver not needed
        const fallback = await renderPageToSvg(doc, { pageId: firstPage.id });
        if (fallback.ok) result = fallback;
      }
      if (cancelled) return;
      if (result.ok) {
        svgCache.set(cacheKey, result.value);
        setRendered({ key: cacheKey, svg: result.value });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, project.id, store]);

  // Fallback: if svg not ready, show Canva-like gradient mock
  if (!svg) {
    return <FallbackThumbnail project={project} />;
  }

  const aspect = project.size.width / project.size.height;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border bg-white p-2"
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

function FallbackThumbnail({ project }: { project: ProjectSummary }) {
  const aspect = project.size.width / project.size.height;
  const isPortrait = aspect < 0.9;
  const isSquare = aspect >= 0.9 && aspect <= 1.1;
  const isWide = aspect > 1.8;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-gradient-to-br from-[#f8f7ff] via-white to-[#eef2ff]">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #7a5cf9 1px, transparent 0)',
          backgroundSize: '16px 16px',
        }}
      />
      <div
        className="relative flex flex-col items-center justify-center p-3"
        style={{ aspectRatio: String(aspect) }}
      >
        <div
          className="w-full max-w-[78%] rounded-md bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)] ring-1 ring-black/[0.06] flex flex-col overflow-hidden"
          style={{ aspectRatio: String(aspect) }}
        >
          <div className="h-2 shrink-0 bg-gradient-to-r from-violet-500 via-indigo-500 to-sky-400" />
          <div className="flex flex-1 flex-col gap-1.5 p-2.5">
            <div className="h-2 w-3/4 rounded-full bg-foreground/10" />
            <div className="h-1.5 w-1/2 rounded-full bg-foreground/10" />
            <div className="mt-auto flex gap-1">
              <div className="h-5 flex-1 rounded bg-primary/15" />
              <div className="h-5 flex-1 rounded bg-muted" />
            </div>
          </div>
        </div>
        <span className="mt-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground shadow-sm ring-1 ring-border">
          {project.size.width} × {project.size.height}
          {isSquare ? ' · Square' : isPortrait ? ' · Portrait' : isWide ? ' · Wide' : ''}
        </span>
      </div>
    </div>
  );
}
