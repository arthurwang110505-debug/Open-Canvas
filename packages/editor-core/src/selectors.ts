import type { DesignElement, Page } from '@opencanvas/document';

import type { EditorState } from './store';

export function selectActivePage(state: EditorState): Page {
  const page = state.document.pages.find((p) => p.id === state.activePageId);
  if (!page) throw new Error(`Active page "${state.activePageId}" is missing from the document.`);
  return page;
}

export function selectSelectedElements(state: EditorState): DesignElement[] {
  if (state.selectedIds.length === 0) return [];
  const page = selectActivePage(state);
  const selected = new Set(state.selectedIds);
  return page.elements.filter((element) => selected.has(element.id));
}

export function selectSingleSelectedElement(state: EditorState): DesignElement | null {
  const elements = selectSelectedElements(state);
  return elements.length === 1 ? (elements[0] ?? null) : null;
}

export const selectCanUndo = (state: EditorState): boolean => state.past.length > 0;
export const selectCanRedo = (state: EditorState): boolean => state.future.length > 0;
