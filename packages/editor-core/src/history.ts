import type { DesignDocument, DesignElement } from '@opencanvas/document';

import type { EditorCommand, ElementPatch } from './commands';

const ELEMENT_LABELS: Record<DesignElement['type'], string> = {
  rect: 'rectangle',
  ellipse: 'ellipse',
  text: 'text',
  image: 'image',
  path: 'drawing',
  icon: 'icon',
  frame: 'frame',
  group: 'group',
};

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function countLabel(count: number, singular: string): string {
  return count === 1 ? singular : `${count} ${singular}s`;
}

function elementLabel(document: DesignDocument, pageId: string, elementId: string): string {
  const element = document.pages
    .find((page) => page.id === pageId)
    ?.elements.find((candidate) => candidate.id === elementId);
  return element ? ELEMENT_LABELS[element.type] : 'element';
}

function selectionLabel(document: DesignDocument, pageId: string, ids: readonly string[]): string {
  const unique = new Set(ids);
  return unique.size === 1
    ? elementLabel(document, pageId, ids[0] ?? '')
    : countLabel(unique.size, 'element');
}

function updateLabel(
  document: DesignDocument,
  pageId: string,
  updates: readonly { elementId: string; patch: ElementPatch }[],
): string {
  const target = selectionLabel(
    document,
    pageId,
    updates.map((update) => update.elementId),
  );
  const keys = new Set(updates.flatMap((update) => Object.keys(update.patch)));
  const has = (...names: string[]) => names.some((name) => keys.has(name));

  if (has('text')) return `Edited ${target}`;
  if (
    has(
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'textAlign',
      'lineHeight',
      'letterSpacing',
      'underline',
      'textTransform',
      'listStyle',
    )
  ) {
    return `Changed ${target} typography`;
  }
  if (has('locked')) return `${updates[0]?.patch.locked ? 'Locked' : 'Unlocked'} ${target}`;
  if (has('visible')) return `${updates[0]?.patch.visible ? 'Showed' : 'Hid'} ${target}`;
  if (has('name')) return `Renamed ${target}`;
  if (has('crop', 'fit')) return `Adjusted ${target} crop`;
  if (has('rotation') && !has('x', 'y', 'width', 'height')) return `Rotated ${target}`;
  if (has('width', 'height') && !has('x', 'y')) return `Resized ${target}`;
  if (has('x', 'y') && !has('width', 'height', 'rotation')) return `Moved ${target}`;
  if (
    has(
      'fill',
      'stroke',
      'color',
      'opacity',
      'cornerRadius',
      'filters',
      'strokeWidth',
      'flipX',
      'flipY',
    )
  ) {
    return `Changed ${target} appearance`;
  }
  return `Updated ${target}`;
}

/** A stable, human-readable label for one undoable command, based on the pre-command document. */
export function describeCommand(command: EditorCommand, document: DesignDocument): string {
  switch (command.type) {
    case 'document.rename':
      return 'Renamed design';
    case 'document.resize':
      return 'Resized design';
    case 'page.setBackground':
      return 'Changed page background';
    case 'page.addGuide':
      return `Added ${command.guide.kind} guide`;
    case 'page.updateGuide':
      return `Moved ${document.pages.find((page) => page.id === command.pageId)?.guides.find((guide) => guide.id === command.guideId)?.kind ?? 'page'} guide`;
    case 'page.removeGuide':
      return 'Removed guide';
    case 'page.clearGuides':
      return 'Cleared page guides';
    case 'page.add':
      return command.elements?.length ? 'Inserted template page' : 'Added page';
    case 'page.replaceContent':
      return 'Applied template';
    case 'page.duplicate':
      return 'Duplicated page';
    case 'page.delete':
      return 'Deleted page';
    case 'page.reorder':
      return 'Moved page';
    case 'asset.register':
      return 'Added image';
    case 'asset.remove':
      return 'Removed image asset';
    case 'element.add':
      return `Added ${ELEMENT_LABELS[command.element.type]}`;
    case 'element.update':
      return updateLabel(document, command.pageId, [
        { elementId: command.elementId, patch: command.patch },
      ]);
    case 'element.updateMany':
      return updateLabel(document, command.pageId, command.updates);
    case 'element.delete':
      return title(`Deleted ${selectionLabel(document, command.pageId, command.elementIds)}`);
    case 'element.duplicate':
      return title(`Duplicated ${selectionLabel(document, command.pageId, command.elementIds)}`);
    case 'element.paste':
      return `Pasted ${countLabel(command.elements.length, 'element')}`;
    case 'element.reorder':
      return 'Changed layer order';
    case 'element.group':
      return `Grouped ${countLabel(new Set(command.elementIds).size, 'element')}`;
    case 'element.ungroup':
      return 'Ungrouped elements';
  }
}
