import type { DesignDocument, ImageAsset, Result } from '@opencanvas/document';
import { err, ok } from '@opencanvas/document';
import {
  collectFontUsages,
  renderDocumentToPdf,
  renderPageToSvg,
  type SvgPageOptions,
} from '@opencanvas/export';
import { blobToDataUrl, dataUrlToBlob } from '@opencanvas/storage';
import { useCallback, useRef, useState } from 'react';

import { useAssetServices } from '../assets/useAssetServices';
import { useEditorStore, useNotificationStore } from '../hooks';
import { bundledPhotoUrl } from '../../assets/photos/catalog';
import { ensureFontsLoaded } from '../../fonts/embed';
import { useExportServices } from './useExportServices';
import { exportFileName, type ExportExtension } from '../../fileNames';

export type ExportKind = ExportExtension;

/** Raster resolution multiplier: 2× keeps text and edges crisp without huge files. */
export const RASTER_SCALE = 2;

interface ExportedFile {
  blob: Blob;
  filename: string;
}

export interface DesignExportApi {
  /** Which format is currently being produced, if any. */
  busy: ExportKind | null;
  exportPng: () => Promise<void>;
  exportSvg: () => Promise<void>;
  exportPdf: () => Promise<void>;
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
    async (kind: ExportKind): Promise<Result<ExportedFile, string>> => {
      const state = editor.getState();
      const document: DesignDocument = state.document;
      // PNG/SVG export the active page, PDF exports every page, so collect the fonts each one
      // actually needs before rendering (hidden elements are not rendered, so they are skipped).
      const pages =
        kind === 'pdf'
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
      const filename = exportFileName(document.name, kind);

      const svg = await renderPageToSvg(document, svgOptions);
      if (!svg.ok) return err(svg.error.message);
      if (kind === 'svg') {
        return ok({
          blob: new Blob([svg.value], { type: 'image/svg+xml;charset=utf-8' }),
          filename,
        });
      }

      if (kind === 'png') {
        const raster = await services.rasterize(
          svg.value,
          { width: document.size.width, height: document.size.height },
          RASTER_SCALE,
        );
        if (!raster.ok) return err(raster.error.message);
        const blob = dataUrlToBlob(raster.value);
        if (!blob) return err('The rendered image was not a PNG data URL.');
        return ok({ blob, filename });
      }

      const pdf = await renderDocumentToPdf(document, {
        rasterize: services.rasterize,
        scale: RASTER_SCALE,
        svgOptions,
      });
      if (!pdf.ok) return err(pdf.error.message);
      return ok({ blob: new Blob([pdf.value], { type: 'application/pdf' }), filename });
    },
    [editor, resolveImageHref, services],
  );

  const run = useCallback(
    async (kind: ExportKind) => {
      if (running.current) return;
      running.current = true;
      setBusy(kind);
      try {
        const produced = await produce(kind);
        if (!produced.ok) {
          notifications
            .getState()
            .show({ kind: 'error', title: 'Export failed', message: produced.error });
          return;
        }
        services.download(produced.value.blob, produced.value.filename);
        notifications.getState().show({
          kind: 'info',
          title: 'Export ready',
          message: `${produced.value.filename} was downloaded.`,
        });
      } catch (cause) {
        notifications.getState().show({
          kind: 'error',
          title: 'Export failed',
          message: cause instanceof Error ? cause.message : String(cause),
        });
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [notifications, produce, services],
  );

  return {
    busy,
    exportPng: useCallback(() => run('png'), [run]),
    exportSvg: useCallback(() => run('svg'), [run]),
    exportPdf: useCallback(() => run('pdf'), [run]),
  };
}
