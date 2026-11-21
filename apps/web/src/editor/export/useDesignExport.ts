import type { DesignDocument, ImageAsset, Result } from '@opencanvas/document';
import { err, ok } from '@opencanvas/document';
import {
  collectFontUsages,
  DEFAULT_VIDEO_FPS,
  renderDocumentToPdf,
  renderDocumentToVideo,
  renderPageToSvg,
  type SvgPageOptions,
  type VideoQuality,
} from '@opencanvas/export';
import { blobToDataUrl, dataUrlToBlob } from '@opencanvas/storage';
import { useCallback, useRef, useState } from 'react';

import { useAssetServices } from '../assets/useAssetServices';
import { useEditorStore, useNotificationStore } from '../hooks';
import { bundledPhotoUrl } from '../../assets/photos/catalog';
import { ensureFontsLoaded } from '../../fonts/embed';
import { useExportServices } from './useExportServices';
import { exportFileName, type ExportExtension } from '../../fileNames';

/**
 * What the user picks in the download dialog. `video` is not a file extension: the recorder
 * decides whether the browser gave us WebM or MP4, and the filename follows what it produced.
 */
export type ExportKind = Exclude<ExportExtension, 'webm' | 'mp4'> | 'video';

/** Raster resolution multiplier: 2× keeps text and edges crisp without huge files. */
export const RASTER_SCALE = 2;

/** Which pages an export includes. PNG/SVG are always the current page; PDF can be either. */
export type ExportPageScope = 'current' | 'all';

export interface ExportRequestOptions {
  /** Raster multiplier for PNG/JPG (and the pages inside a PDF). Defaults to `RASTER_SCALE`. */
  scale?: number;
  /** PDF only: every page, or just the page currently on screen. */
  pageScope?: ExportPageScope;
  /** PNG only: leave the page background out so the file has a transparent background. */
  transparent?: boolean;
  /** Video only: frames per second. Defaults to `DEFAULT_VIDEO_FPS`. */
  fps?: number;
  /** Video only: frame size cap. Defaults to `standard`. */
  quality?: VideoQuality;
}

/** Lets callers (the download dialog) close on success and show the error inline on failure. */
export type ExportOutcome = { ok: true; filename: string } | { ok: false; error: string };

interface ExportedFile {
  blob: Blob;
  filename: string;
}

/** How far a multi-frame export has got, for a progress indicator. */
export interface ExportProgress {
  completed: number;
  total: number;
}

export interface DesignExportApi {
  /** Which format is currently being produced, if any. */
  busy: ExportKind | null;
  /** Frame progress while a video renders; null for single-file exports. */
  progress: ExportProgress | null;
  /** Whether this browser can record video at all. */
  videoSupported: boolean;
  exportDesign: (kind: ExportKind, options?: ExportRequestOptions) => Promise<ExportOutcome>;
  exportPng: () => Promise<ExportOutcome>;
  exportJpg: () => Promise<ExportOutcome>;
  exportSvg: () => Promise<ExportOutcome>;
  exportPdf: () => Promise<ExportOutcome>;
  exportVideo: () => Promise<ExportOutcome>;
}

/**
 * Produces download files from the document model. Every step is the same one the canvas uses
 * (same geometry, same colors, same text), and every failure is reported to the user instead of
 * producing a broken or empty file.
 */
export function useDesignExport(): DesignExportApi {
  const editor = useEditorStore();
  const { blobStore } = useAssetServices();
  const services = useExportServices();
  const notifications = useNotificationStore();
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const running = useRef(false);

  const resolveImageHref = useCallback(
    async (asset: ImageAsset): Promise<string> => {
      if (asset.source.type === 'url') return asset.source.url;
      if (asset.source.type === 'bundled') {
        // An export must be self-contained, so the bundled file is inlined rather than linked by
        // a path that only resolves inside the app.
        const url = bundledPhotoUrl(asset.source.photoId);
        if (!url) throw new Error('the photo it uses is not part of this version of OpenCanvas');
        const response = await fetch(url);
        if (!response.ok) throw new Error('its bundled photo could not be read');
        return blobToDataUrl(await response.blob());
      }
      const blob = await blobStore.get(asset.id);
      if (!blob) {
        // The SVG renderer prefixes this with the asset name, so keep it a clause.
        throw new Error('its image data is no longer stored in this browser');
      }
      return blobToDataUrl(blob);
    },
    [blobStore],
  );

  const produce = useCallback(
    async (
      kind: ExportKind,
      options: ExportRequestOptions = {},
    ): Promise<Result<ExportedFile, string>> => {
      const state = editor.getState();
      const document: DesignDocument = state.document;
      const scale =
        options.scale !== undefined && Number.isFinite(options.scale) && options.scale > 0
          ? options.scale
          : RASTER_SCALE;
      const pageScope: ExportPageScope =
        kind === 'pdf' || kind === 'video' ? (options.pageScope ?? 'all') : 'current';
      // PNG/SVG export the active page; PDF exports every page unless told otherwise. Collect
      // the fonts each included page actually needs before rendering (hidden elements are not
      // rendered, so they are skipped).
      const pages =
        pageScope === 'all'
          ? document.pages
          : document.pages.filter((page) => page.id === state.activePageId);
      const usages = collectFontUsages(
        pages.flatMap((page) => page.elements.filter((element) => element.visible)),
      );
      // Wait for the faces first: measuring wrapped lines before they load would bake the
      // fallback metrics into the file. Refusing to continue on a failed read keeps an export
      // from silently landing in the wrong typeface.
      await ensureFontsLoaded(usages);
      const fontFaces = await services.resolveFontFaces(usages);
      const svgOptions: SvgPageOptions = {
        pageId: state.activePageId,
        resolveImageHref,
        ...(services.measureText ? { measureText: services.measureText } : {}),
        ...(fontFaces.length > 0 ? { fontFaces } : {}),
      };
      if (kind === 'video') {
        if (!services.createVideoRecorder) {
          return err('This browser cannot record video. Try Chrome, Edge, or Firefox.');
        }
        // The recorder renders a page per frame, so the fixed page id is dropped here.
        const { pageId: _pageId, ...frameOptions } = svgOptions;
        const recorded = await renderDocumentToVideo(document, {
          pageIds: pages.map((page) => page.id),
          fps: options.fps ?? DEFAULT_VIDEO_FPS,
          ...(options.quality ? { quality: options.quality } : {}),
          rasterize: services.rasterize,
          createRecorder: services.createVideoRecorder,
          svgOptions: frameOptions,
          onProgress: (completed, total) => {
            setProgress({ completed, total });
          },
        });
        if (!recorded.ok) return err(recorded.error.message);
        return ok({
          blob: recorded.value.blob,
          filename: exportFileName(document.name, recorded.value.extension),
        });
      }

      const filename = exportFileName(document.name, kind);

      // A transparent PNG omits the page background rect; every other kind keeps it.
      const transparent = kind === 'png' && options.transparent === true;
      const svg = await renderPageToSvg(document, {
        ...svgOptions,
        ...(transparent ? { background: false } : {}),
      });
      if (!svg.ok) return err(svg.error.message);
      if (kind === 'svg') {
        return ok({
          blob: new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' }),
          filename,
        });
      }

      if (kind === 'png' || kind === 'jpg') {
        const raster = await services.rasterize(
          svg.value,
          { width: document.size.width, height: document.size.height },
          scale,
          kind === 'jpg' ? 'jpeg' : 'png',
        );
        if (!raster.ok) return err(raster.error.message);
        const blob = dataUrlToBlob(raster.value);
        if (!blob) {
          return err(
            kind === 'jpg'
              ? 'The rendered image was not a JPEG data URL.'
              : 'The rendered image was not a PNG data URL.',
          );
        }
        return ok({ blob, filename });
      }

      const pdf = await renderDocumentToPdf(document, {
        rasterize: services.rasterize,
        scale,
        svgOptions,
        ...(pageScope === 'current' ? { pageIds: [state.activePageId] } : {}),
      });
      if (!pdf.ok) return err(pdf.error.message);
      return ok({ blob: new Blob([pdf.value], { type: 'application/pdf' }), filename });
    },
    [editor, resolveImageHref, services],
  );

  const run = useCallback(
    async (kind: ExportKind, options?: ExportRequestOptions): Promise<ExportOutcome> => {
      if (running.current) return { ok: false, error: 'Another export is already in progress.' };
      running.current = true;
      setBusy(kind);
      setProgress(null);
      try {
        const produced = await produce(kind, options);
        if (!produced.ok) {
          notifications
            .getState()
            .show({ kind: 'error', title: 'Export failed', message: produced.error });
          return { ok: false, error: produced.error };
        }
        services.download(produced.value.blob, produced.value.filename);
        notifications.getState().show({
          kind: 'info',
          title: 'Export ready',
          message: `${produced.value.filename} was downloaded.`,
        });
        return { ok: true, filename: produced.value.filename };
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        notifications.getState().show({ kind: 'error', title: 'Export failed', message });
        return { ok: false, error: message };
      } finally {
        running.current = false;
        setBusy(null);
        setProgress(null);
      }
    },
    [notifications, produce, services],
  );

  return {
    busy,
    progress,
    videoSupported: services.createVideoRecorder !== undefined,
    exportDesign: run,
    exportPng: useCallback(() => run('png'), [run]),
    exportJpg: useCallback(() => run('jpg'), [run]),
    exportSvg: useCallback(() => run('svg'), [run]),
    exportPdf: useCallback(() => run('pdf'), [run]),
    exportVideo: useCallback(() => run('video'), [run]),
  };
}
