import type { DesignDocument, DesignElement, Page } from './schema';

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
