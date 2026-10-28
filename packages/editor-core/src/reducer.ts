import {
  AssetSchema,
  DocumentSchema,
  ElementSchema,
  GroupElementSchema,
  LIMITS,
  PageGuideSchema,
  PageSchema,
  collectElementIds,
  collectReferencedAssetIds,
  err,
  findElementIndex,
  generateId,
  getElementBounds,
  ok,
  type DesignDocument,
  type DesignElement,
  type GroupElement,
  type Page,
  type Result,
  unionBounds,
} from '@opencanvas/document';

import type { CommandError, EditorCommand, ElementPatch, ReorderTarget } from './commands';

export interface ReducerOptions {
  /** Clock used for `metadata.updatedAt`; injectable for deterministic tests. */
  now?: () => Date;
}

type Outcome = Result<DesignDocument, CommandError>;

/** Read-only view of the document that page-level commands may consult. */
interface PageContext {
  assets: DesignDocument['assets'];
  /** Lazily collected because only cloning commands need document-wide id allocation. */
  elementIds: () => Set<string>;
}

function withPage(
  document: DesignDocument,
  pageId: string,
  commandType: EditorCommand['type'],
  update: (page: Page, context: PageContext) => Result<Page, CommandError>,
): Outcome {
  const index = document.pages.findIndex((page) => page.id === pageId);
  const page = document.pages[index];
  if (!page) {
    return err({
      code: 'page-not-found',
      message: `Page "${pageId}" does not exist.`,
      command: commandType,
    });
  }
  let elementIds: Set<string> | undefined;
  const updated = update(page, {
    assets: document.assets,
    elementIds: () => {
      elementIds ??= collectElementIds(document);
      return elementIds;
    },
  });
  if (!updated.ok) return updated;
  // No-op page updates must not produce a new document (and thus a new history entry).
  if (updated.value === page) return ok(document);
  const pages = document.pages.slice();
  pages[index] = updated.value;
  return ok({ ...document, pages });
}

/** Images, filled frames and every nested group child may only point at registered assets. */
function checkAssetReference(
  element: DesignElement,
  context: PageContext,
  commandType: EditorCommand['type'],
): CommandError | null {
  const assetId =
    element.type === 'image' || element.type === 'frame' ? element.assetId : undefined;
  if (assetId !== undefined && !(assetId in context.assets)) {
    return {
      code: 'asset-not-found',
      message: `Asset "${assetId}" is not registered in this document.`,
      command: commandType,
    };
  }
  if (element.type === 'group') {
    for (const child of element.children) {
      const error = checkAssetReference(child, context, commandType);
      if (error) return error;
    }
  }
  return null;
}

function freshElementId(usedIds: Set<string>): string {
  let id = generateId('el');
  while (usedIds.has(id)) id = generateId('el');
  return id;
}

/** Clones a complete element tree. Only roots receive a positional offset, never group children. */
function cloneElementWithNewIds(
  element: DesignElement,
  usedIds: Set<string>,
  rootId?: string,
  offset = 0,
): DesignElement {
  const id = rootId ?? freshElementId(usedIds);
  usedIds.add(id);
  if (element.type === 'group') {
    return {
      ...element,
      id,
      x: element.x + offset,
      y: element.y + offset,
      children: element.children.map((child) => cloneElementWithNewIds(child, usedIds)),
    };
  }
  return { ...element, id, x: element.x + offset, y: element.y + offset };
}

function patchElement(
  element: DesignElement,
  patch: ElementPatch,
  context: PageContext,
  commandType: EditorCommand['type'],
): Result<DesignElement, CommandError> {
  // Identity is never patchable, even if a caller tries.
  const candidate = { ...element, ...patch, id: element.id, type: element.type };
  const parsed = ElementSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return err({
      code: 'invalid-result',
      message: issue
        ? `Invalid value for "${issue.path.map(String).join('.')}": ${issue.message}`
        : 'The update produced an invalid element.',
      command: commandType,
    });
  }
  const assetError = checkAssetReference(parsed.data, context, commandType);
  if (assetError) return err(assetError);
  return ok(parsed.data);
}

function resolveIndex(current: number, length: number, to: ReorderTarget): number {
  const last = length - 1;
  if (to === 'front') return last;
  if (to === 'back') return 0;
  if (to === 'forward') return Math.min(last, current + 1);
  if (to === 'backward') return Math.max(0, current - 1);
  return Math.max(0, Math.min(last, Math.trunc(to.index)));
}

function applyToPage(
  page: Page,
  command: EditorCommand,
  context: PageContext,
): Result<Page, CommandError> {
  switch (command.type) {
    case 'page.setBackground':
      return ok({ ...page, background: command.background });

    case 'page.addGuide': {
      if (page.guides.length >= LIMITS.maxGuidesPerPage) {
        return err({
          code: 'invalid-command',
          message: `A page may hold at most ${LIMITS.maxGuidesPerPage} guides.`,
          command: command.type,
        });
      }
      if (page.guides.some((guide) => guide.id === command.guide.id)) {
        return err({
          code: 'invalid-command',
          message: `Guide id "${command.guide.id}" already exists on this page.`,
          command: command.type,
        });
      }
      const parsed = PageGuideSchema.safeParse(command.guide);
      if (!parsed.success) {
        return err({
          code: 'invalid-command',
          message: 'The guide is invalid.',
          command: command.type,
        });
      }
      return ok({ ...page, guides: [...page.guides, parsed.data] });
    }

    case 'page.updateGuide': {
      const index = page.guides.findIndex((guide) => guide.id === command.guideId);
      const guide = page.guides[index];
      if (!guide) {
        return err({
          code: 'invalid-command',
          message: `Guide "${command.guideId}" does not exist on this page.`,
          command: command.type,
        });
      }
      const position = PageGuideSchema.shape.position.safeParse(command.position);
      if (!position.success) {
        return err({
          code: 'invalid-command',
          message: 'The guide position is invalid.',
          command: command.type,
        });
      }
      if (guide.position === position.data) return ok(page);
      const guides = page.guides.slice();
      guides[index] = { ...guide, position: position.data };
      return ok({ ...page, guides });
    }

    case 'page.removeGuide': {
      const guides = page.guides.filter((guide) => guide.id !== command.guideId);
      if (guides.length === page.guides.length) {
        return err({
          code: 'invalid-command',
          message: `Guide "${command.guideId}" does not exist on this page.`,
          command: command.type,
        });
      }
      return ok({ ...page, guides });
    }

    case 'page.clearGuides':
      return page.guides.length === 0 ? ok(page) : ok({ ...page, guides: [] });

    case 'page.replaceContent': {
      const parsed = PageSchema.safeParse({
        id: page.id,
        ...(page.name !== undefined ? { name: page.name } : {}),
        background: command.background,
        elements: command.elements,
      });
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return err({
          code: 'invalid-result',
          message: issue
            ? `Invalid page content: ${issue.path.map(String).join('.')} ${issue.message}`
            : 'Invalid page content.',
          command: command.type,
        });
      }
      return ok({
        ...page,
        background: parsed.data.background,
        elements: parsed.data.elements,
      });
    }

    case 'element.add': {
      if (findElementIndex(page, command.element.id) !== -1) {
        return err({
          code: 'invalid-command',
          message: `An element with id "${command.element.id}" already exists on this page.`,
          command: command.type,
        });
      }
      // Elements arrive from many producers (UI, drops, AI); never trust them unchecked.
      const parsed = ElementSchema.safeParse(command.element);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return err({
          code: 'invalid-command',
          message: issue
            ? `Invalid element "${issue.path.map(String).join('.')}": ${issue.message}`
            : 'The element is invalid.',
          command: command.type,
        });
      }
      const element = parsed.data;
      const assetError = checkAssetReference(element, context, command.type);
      if (assetError) return err(assetError);
      if (page.elements.length >= LIMITS.maxElementsPerPage) {
        return err({
          code: 'invalid-command',
          message: `A page may hold at most ${LIMITS.maxElementsPerPage} elements.`,
          command: command.type,
        });
      }
      const elements = page.elements.slice();
      const index =
        command.index === undefined
          ? elements.length
          : Math.max(0, Math.min(elements.length, command.index));
      elements.splice(index, 0, element);
      return ok({ ...page, elements });
    }

    case 'element.update':
      return applyToPage(
        page,
        {
          type: 'element.updateMany',
          pageId: command.pageId,
          updates: [{ elementId: command.elementId, patch: command.patch }],
        },
        context,
      );

    case 'element.updateMany': {
      const elements = page.elements.slice();
      for (const { elementId, patch } of command.updates) {
        const index = findElementIndex(page, elementId);
        const element = elements[index];
        if (!element) {
          return err({
            code: 'element-not-found',
            message: `Element "${elementId}" does not exist on page "${page.id}".`,
            command: command.type,
          });
        }
        const patched = patchElement(element, patch, context, command.type);
        if (!patched.ok) return patched;
        elements[index] = patched.value;
      }
      return ok({ ...page, elements });
    }

    case 'element.delete': {
      const ids = new Set(command.elementIds);
      const elements = page.elements.filter((element) => !ids.has(element.id));
      if (elements.length === page.elements.length) {
        return err({
          code: 'element-not-found',
          message: 'None of the requested elements exist on this page.',
          command: command.type,
        });
      }
      return ok({ ...page, elements });
    }

    case 'element.duplicate': {
      const offset = command.offset ?? 20;
      const selectedIds = new Set(command.elementIds);
      const sources = page.elements.filter((element) => selectedIds.has(element.id));
      if (sources.length === 0) {
        return err({
          code: 'element-not-found',
          message: 'None of the requested elements exist on this page.',
          command: command.type,
        });
      }
      if (page.elements.length + sources.length > LIMITS.maxElementsPerPage) {
        return err({
          code: 'invalid-command',
          message: `A page may hold at most ${LIMITS.maxElementsPerPage} elements.`,
          command: command.type,
        });
      }
      const usedIds = context.elementIds();
      const requestedIds = new Set<string>();
      for (const id of command.newIds ?? []) {
        if (usedIds.has(id) || requestedIds.has(id)) {
          return err({
            code: 'invalid-command',
            message: `Element id "${id}" already exists or is repeated.`,
            command: command.type,
          });
        }
        requestedIds.add(id);
      }
      const rootIds = new Map(
        command.elementIds.map((id, index) => [id, command.newIds?.[index]] as const),
      );
      const copies = sources.map((source) =>
        cloneElementWithNewIds(source, usedIds, rootIds.get(source.id), offset),
      );
      return ok({ ...page, elements: [...page.elements, ...copies] });
    }

    case 'element.paste': {
      if (command.elements.length === 0) {
        return err({
          code: 'invalid-command',
          message: 'There are no copied elements to paste.',
          command: command.type,
        });
      }
      if (page.elements.length + command.elements.length > LIMITS.maxElementsPerPage) {
        return err({
          code: 'invalid-command',
          message: `A page may hold at most ${LIMITS.maxElementsPerPage} elements.`,
          command: command.type,
        });
      }
      const sources: DesignElement[] = [];
      for (const source of command.elements) {
        const parsed = ElementSchema.safeParse(source);
        if (!parsed.success) {
          const issue = parsed.error.issues[0];
          return err({
            code: 'invalid-command',
            message: issue
              ? `Invalid copied element "${issue.path.map(String).join('.')}": ${issue.message}`
              : 'A copied element is invalid.',
            command: command.type,
          });
        }
        const assetError = checkAssetReference(parsed.data, context, command.type);
        if (assetError) return err(assetError);
        sources.push(parsed.data);
      }
      const usedIds = context.elementIds();
      const offset = command.offset ?? 20;
      const copies = sources.map((source) =>
        cloneElementWithNewIds(source, usedIds, undefined, offset),
      );
      return ok({ ...page, elements: [...page.elements, ...copies] });
    }

    case 'element.reorder': {
      const from = findElementIndex(page, command.elementId);
      const element = page.elements[from];
      if (!element) {
        return err({
          code: 'element-not-found',
          message: `Element "${command.elementId}" does not exist on page "${page.id}".`,
          command: command.type,
        });
      }
      const to = resolveIndex(from, page.elements.length, command.to);
      if (to === from) return ok(page);
      const elements = page.elements.slice();
      elements.splice(from, 1);
      elements.splice(to, 0, element);
      return ok({ ...page, elements });
    }

    case 'element.group': {
      if (command.elementIds.length < 2) {
        return err({
          code: 'invalid-command',
          message: 'Select at least two elements to create a group.',
          command: command.type,
        });
      }
      // All ids must exist on this page and be at top level
      const idSet = new Set(command.elementIds);
      const selected = page.elements.filter((el) => idSet.has(el.id));
      if (selected.length !== command.elementIds.length) {
        return err({
          code: 'element-not-found',
          message:
            'One or more selected elements do not exist on this page (or are nested inside another group).',
          command: command.type,
        });
      }
      const groupId = command.groupId ?? generateId('el');
      if (
        page.elements.some((el) => el.id === groupId) ||
        selected.some((el) => el.id === groupId)
      ) {
        return err({
          code: 'invalid-command',
          message: `Element id "${groupId}" already exists.`,
          command: command.type,
        });
      }
      // Compute bounding box of selected elements (axis-aligned, ignoring rotation for group box)
      const bounds = unionBounds(selected.map((el) => getElementBounds(el)));
      const children = selected.map((el) => ({
        ...el,
        x: el.x - bounds.left,
        y: el.y - bounds.top,
      }));
      const group: GroupElement = {
        id: groupId,
        x: bounds.left,
        y: bounds.top,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        type: 'group',
        children,
      };
      const parsed = GroupElementSchema.safeParse(group);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return err({
          code: 'invalid-result',
          message: issue ? `Group is invalid: ${issue.message}` : 'Group is invalid.',
          command: command.type,
        });
      }
      // Insert group where the earliest selected element was, remove originals
      const remaining = page.elements.filter((el) => !idSet.has(el.id));
      const firstIdx = page.elements.findIndex((el) => idSet.has(el.id));
      const insertAt = firstIdx === -1 ? remaining.length : firstIdx;
      // Clamp to remaining length after removal
      const clamped = Math.max(0, Math.min(remaining.length, insertAt));
      remaining.splice(clamped, 0, parsed.data);
      return ok({ ...page, elements: remaining });
    }

    case 'element.ungroup': {
      const idx = findElementIndex(page, command.groupId);
      const group = page.elements[idx];
      if (!group) {
        return err({
          code: 'element-not-found',
          message: `Group "${command.groupId}" does not exist on page "${page.id}".`,
          command: command.type,
        });
      }
      if (group.type !== 'group') {
        return err({
          code: 'invalid-command',
          message: `Element "${command.groupId}" is not a group.`,
          command: command.type,
        });
      }
      const children = group.children.map((child) => ({
        ...child,
        // Restore absolute position
        x: child.x + group.x,
        y: child.y + group.y,
      }));
      // Validate each child still fits schema (should, but check)
      for (const child of children) {
        const parsed = ElementSchema.safeParse(child);
        if (!parsed.success) {
          return err({
            code: 'invalid-result',
            message: `Ungrouped child "${child.id}" is invalid.`,
            command: command.type,
          });
        }
      }
      const elements = page.elements.slice();
      elements.splice(idx, 1, ...children);
      return ok({ ...page, elements });
    }

    case 'document.rename':
    case 'document.resize':
    case 'asset.register':
    case 'asset.remove':
    case 'page.add':
    case 'page.duplicate':
    case 'page.delete':
    case 'page.reorder':
      return err({
        code: 'invalid-command',
        message: `${command.type} is not a page command.`,
        command: command.type,
      });
  }
}

/**
 * Pure reducer: returns a new document (structural sharing for untouched pages) or an
 * error describing why the command could not be applied. The input is never mutated.
 */
export function applyCommand(
  document: DesignDocument,
  command: EditorCommand,
  options: ReducerOptions = {},
): Outcome {
  let outcome: Outcome;
  switch (command.type) {
    case 'document.rename': {
      const name = command.name.trim();
      if (name.length === 0) {
        return err({
          code: 'invalid-command',
          message: 'A design name cannot be empty.',
          command: command.type,
        });
      }
      outcome = ok({ ...document, name });
      break;
    }
    case 'document.resize': {
      const size = DocumentSchema.shape.size.safeParse({
        width: command.width,
        height: command.height,
      });
      if (!size.success) {
        return err({
          code: 'invalid-command',
          message: `Unsupported canvas size ${command.width}×${command.height}.`,
          command: command.type,
        });
      }
      outcome = ok({ ...document, size: size.data });
      break;
    }
    case 'asset.register': {
      const parsed = AssetSchema.safeParse(command.asset);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return err({
          code: 'invalid-command',
          message: issue
            ? `Invalid asset "${issue.path.map(String).join('.')}": ${issue.message}`
            : 'Invalid asset record.',
          command: command.type,
        });
      }
      const asset = parsed.data;
      if (asset.id in document.assets) {
        return err({
          code: 'invalid-command',
          message: `Asset "${asset.id}" is already registered.`,
          command: command.type,
        });
      }
      if (Object.keys(document.assets).length >= LIMITS.maxAssetsPerDocument) {
        return err({
          code: 'invalid-command',
          message: `A document may reference at most ${LIMITS.maxAssetsPerDocument} assets.`,
          command: command.type,
        });
      }
      outcome = ok({ ...document, assets: { ...document.assets, [asset.id]: asset } });
      break;
    }
    case 'asset.remove': {
      if (!(command.assetId in document.assets)) {
        return err({
          code: 'asset-not-found',
          message: `Asset "${command.assetId}" is not registered in this document.`,
          command: command.type,
        });
      }
      if (collectReferencedAssetIds(document).has(command.assetId)) {
        return err({
          code: 'invalid-command',
          message: 'This asset is still used on the canvas. Delete those images first.',
          command: command.type,
        });
      }
      const { [command.assetId]: _removed, ...assets } = document.assets;
      outcome = ok({ ...document, assets });
      break;
    }
    case 'page.add': {
      if (document.pages.length >= LIMITS.maxPages) {
        return err({
          code: 'invalid-command',
          message: `A document may have at most ${LIMITS.maxPages} pages.`,
          command: command.type,
        });
      }
      const newPageId = command.pageId ?? generateId('page');
      if (document.pages.some((p) => p.id === newPageId)) {
        return err({
          code: 'invalid-command',
          message: `Page id "${newPageId}" already exists.`,
          command: command.type,
        });
      }
      const candidate: Page = {
        id: newPageId,
        background: command.background ?? { type: 'solid', color: '#ffffff' },
        elements: command.elements ? [...command.elements] : [],
        guides: [],
      };
      const parsed = PageSchema.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        return err({
          code: 'invalid-command',
          message: issue
            ? `Invalid page content: ${issue.path.map(String).join('.')} ${issue.message}`
            : 'Invalid page content.',
          command: command.type,
        });
      }
      const newPage: Page = parsed.data;
      const pages = document.pages.slice();
      if (command.afterPageId) {
        const idx = pages.findIndex((p) => p.id === command.afterPageId);
        if (idx === -1) {
          return err({
            code: 'page-not-found',
            message: `Page "${command.afterPageId}" does not exist.`,
            command: command.type,
          });
        }
        pages.splice(idx + 1, 0, newPage);
      } else {
        pages.push(newPage);
      }
      outcome = ok({ ...document, pages });
      break;
    }
    case 'page.duplicate': {
      if (document.pages.length >= LIMITS.maxPages) {
        return err({
          code: 'invalid-command',
          message: `A document may have at most ${LIMITS.maxPages} pages.`,
          command: command.type,
        });
      }
      const idx = document.pages.findIndex((p) => p.id === command.pageId);
      if (idx === -1) {
        return err({
          code: 'page-not-found',
          message: `Page "${command.pageId}" does not exist.`,
          command: command.type,
        });
      }
      const source = document.pages[idx];
      if (!source) {
        return err({
          code: 'page-not-found',
          message: `Page "${command.pageId}" does not exist.`,
          command: command.type,
        });
      }
      const newPageId = command.newPageId ?? generateId('page');
      if (document.pages.some((p) => p.id === newPageId)) {
        return err({
          code: 'invalid-command',
          message: `Page id "${newPageId}" already exists.`,
          command: command.type,
        });
      }
      // Clone complete element trees so nested children cannot collide with the source page.
      const usedIds = collectElementIds(document);
      const clonedElements = source.elements.map((element) =>
        cloneElementWithNewIds(element, usedIds),
      );
      const newPage: Page = {
        id: newPageId,
        ...(source.name ? { name: source.name } : {}),
        background: source.background,
        elements: clonedElements,
        guides: source.guides.map((guide) => ({ ...guide })),
      };
      const pages = document.pages.slice();
      pages.splice(idx + 1, 0, newPage);
      outcome = ok({ ...document, pages });
      break;
    }
    case 'page.delete': {
      if (document.pages.length <= 1) {
        return err({
          code: 'invalid-command',
          message: 'A document must have at least one page.',
          command: command.type,
        });
      }
      const idx = document.pages.findIndex((p) => p.id === command.pageId);
      if (idx === -1) {
        return err({
          code: 'page-not-found',
          message: `Page "${command.pageId}" does not exist.`,
          command: command.type,
        });
      }
      const pages = document.pages.slice();
      pages.splice(idx, 1);
      outcome = ok({ ...document, pages });
      break;
    }
    case 'page.reorder': {
      const from = document.pages.findIndex((p) => p.id === command.pageId);
      if (from === -1) {
        return err({
          code: 'page-not-found',
          message: `Page "${command.pageId}" does not exist.`,
          command: command.type,
        });
      }
      const to = Math.max(0, Math.min(document.pages.length - 1, Math.trunc(command.toIndex)));
      if (to === from) return ok(document);
      const pages = document.pages.slice();
      const [moved] = pages.splice(from, 1);
      if (!moved) return ok(document);
      pages.splice(to, 0, moved);
      outcome = ok({ ...document, pages });
      break;
    }
    case 'page.setBackground':
    case 'page.addGuide':
    case 'page.updateGuide':
    case 'page.removeGuide':
    case 'page.clearGuides':
    case 'page.replaceContent':
    case 'element.add':
    case 'element.update':
    case 'element.updateMany':
    case 'element.delete':
    case 'element.duplicate':
    case 'element.paste':
    case 'element.reorder':
    case 'element.group':
    case 'element.ungroup':
      outcome = withPage(document, command.pageId, command.type, (page, context) =>
        applyToPage(page, command, context),
      );
      break;
  }

  if (!outcome.ok) return outcome;
  if (outcome.value === document) return outcome;

  const now = (options.now ?? (() => new Date()))();
  return ok({
    ...outcome.value,
    metadata: { ...outcome.value.metadata, updatedAt: now.toISOString() },
  });
}
