import {
  LIMITS,
  createImageElement,
  fitWithin,
  generateId,
  type ImageAsset,
} from '@opencanvas/document';
import { importImageFile } from '@opencanvas/storage';
import { useMemo, useState } from 'react';

import { useEditorStore, useNotificationStore } from '../hooks';
import { useAssetServices } from './useAssetServices';

/** Inserted images never exceed this share of the page so they land fully visible. */
const INSERT_RATIO = 0.6;

export interface InsertOptions {
  /** Page point the image should be centered on; defaults to the page center. */
  at?: { x: number; y: number };
}

export interface ImageImport {
  /** Validates, stores and places each file. Failures are reported, never thrown. */
  importFiles: (files: Iterable<File>, options?: InsertOptions) => Promise<void>;
  /** Places an already registered asset on the active page. */
  insertAsset: (assetId: string, options?: InsertOptions) => void;
  /**
   * Removes an unused asset record from the document. Its bytes stay in the session store
   * so Undo can bring the upload back. Nothing prunes unreferenced blobs yet; deleting the project
   * is what removes them.
   */
  removeAsset: (assetId: string) => void;
  /** Number of files currently being decoded. */
  pending: number;
}

export function useImageImport(): ImageImport {
  const store = useEditorStore();
  const notifications = useNotificationStore();
  const services = useAssetServices();
  const [pending, setPending] = useState(0);

  const actions = useMemo(() => {
    const placement = (asset: ImageAsset, options: InsertOptions | undefined) => {
      const { size } = store.getState().document;
      const fitted = fitWithin(asset, size.width * INSERT_RATIO, size.height * INSERT_RATIO);
      const center = options?.at ?? { x: size.width / 2, y: size.height / 2 };
      return {
        ...fitted,
        x: Math.round(center.x - fitted.width / 2),
        y: Math.round(center.y - fitted.height / 2),
      };
    };

    const addImageElement = (
      asset: ImageAsset,
      options: InsertOptions | undefined,
      mergeKey: string,
    ) => {
      const { activePageId, dispatch } = store.getState();
      const element = createImageElement({
        assetId: asset.id,
        ...(asset.name !== undefined ? { name: asset.name } : {}),
        ...placement(asset, options),
      });
      return dispatch({ type: 'element.add', pageId: activePageId, element }, { mergeKey });
    };

    const importOne = async (file: File, options: InsertOptions | undefined) => {
      const imported = await importImageFile(file, {
        decode: services.decode,
        maxBytes: LIMITS.maxAssetBytes,
      });
      if (!imported.ok) {
        notifications.getState().show({
          kind: 'error',
          title: `Could not add "${file.name}"`,
          message: imported.error.message,
        });
        return;
      }
      const { asset, blob } = imported.value;
      // Bytes first: the canvas starts loading as soon as the element exists.
      await services.blobStore.put(asset.id, blob);

      // Register + add share a merge key so one Undo removes both.
      const mergeKey = `insert-image:${generateId()}`;
      const registered = store.getState().dispatch({ type: 'asset.register', asset }, { mergeKey });
      if (!registered.ok) {
        await services.blobStore.delete(asset.id);
        return; // The store already surfaced the command error.
      }
      const added = addImageElement(asset, options, mergeKey);
      if (!added.ok) {
        store.getState().undo();
        await services.blobStore.delete(asset.id);
      }
    };

    return {
      importFiles: async (files: Iterable<File>, options?: InsertOptions) => {
        const list = [...files];
        if (list.length === 0) return;
        setPending((count) => count + list.length);
        try {
          // Sequential keeps insertion order equal to selection order and bounds memory use.
          for (const file of list) {
            try {
              await importOne(file, options);
            } catch (cause) {
              const detail = cause instanceof Error ? cause.message : String(cause);
              notifications.getState().show({
                kind: 'error',
                title: `Could not add "${file.name}"`,
                message: `Unexpected failure while importing: ${detail}`,
              });
            } finally {
              setPending((count) => count - 1);
            }
          }
        } catch (cause) {
          // Only reachable if iteration itself fails; keep the counter consistent.
          setPending(0);
          throw cause;
        }
      },

      insertAsset: (assetId: string, options?: InsertOptions) => {
        const asset = store.getState().document.assets[assetId];
        if (!asset) {
          notifications.getState().show({
            kind: 'error',
            title: 'Image unavailable',
            message: 'This upload is no longer part of the document.',
          });
          return;
        }
        addImageElement(asset, options, `insert-asset:${generateId()}`);
      },

      removeAsset: (assetId: string) => {
        // Rejected while an element still uses the asset; the command error toast explains.
        store.getState().dispatch({ type: 'asset.remove', assetId });
      },
    };
  }, [store, notifications, services]);

  return { ...actions, pending };
}
