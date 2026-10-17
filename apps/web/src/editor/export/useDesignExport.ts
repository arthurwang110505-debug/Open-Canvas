import type { DesignDocument, ImageAsset, Result } from '@opencanvas/document';
import { err, ok } from '@opencanvas/document';
import { renderDocumentToPdf, renderPageToSvg, type SvgPageOptions } from '@opencanvas/export';
import { blobToDataUrl, dataUrlToBlob } from '@opencanvas/storage';
import { useCallback, useRef, useState } from 'react';

import { useAssetServices } from '../assets/useAssetServices';
import { useEditorStore, useNotificationStore } from '../hooks';
import { useExportServices } from './useExportServices';
import { exportFileName, type ExportExtension } from './fileNames';

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
      const svgOptions: SvgPageOptions = {
        pageId: state.activePageId,
        resolveImageHref,
        ...(services.measureText ? { measureText: services.measureText } : {}),
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
