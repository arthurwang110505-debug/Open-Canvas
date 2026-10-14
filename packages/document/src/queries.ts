import type { Asset, DesignDocument, DesignElement, Page } from './schema';

export function findPage(document: DesignDocument, pageId: string): Page | undefined {
  return document.pages.find((page) => page.id === pageId);
}

export function findElement(page: Page, elementId: string): DesignElement | undefined {
  return page.elements.find((element) => element.id === elementId);
}

export function findElementIndex(page: Page, elementId: string): number {
  return page.elements.findIndex((element) => element.id === elementId);
}

export function collectElementIds(document: DesignDocument): Set<string> {
  const ids = new Set<string>();
  for (const page of document.pages) {
    for (const element of page.elements) ids.add(element.id);
  }
  return ids;
}

/** Normalizes any angle (degrees) into the `[0, 360)` range. */
export function normalizeRotation(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function findAsset(document: DesignDocument, assetId: string): Asset | undefined {
  return document.assets[assetId];
}

/** Ids of assets referenced by at least one element on any page. */
export function collectReferencedAssetIds(document: DesignDocument): Set<string> {
  const ids = new Set<string>();
  for (const page of document.pages) {
    for (const element of page.elements) {
      if (element.type === 'image') ids.add(element.assetId);
    }
  }
  return ids;
}

/**
 * Fits `asset` dimensions inside `maxWidth`x`maxHeight` preserving aspect ratio
 * (never upscales). Used when inserting images and building thumbnails.
 */
export function fitWithin(
  size: { width: number; height: number },
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / size.width, maxHeight / size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}
