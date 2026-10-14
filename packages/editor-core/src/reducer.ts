import {
  AssetSchema,
  DocumentSchema,
  ElementSchema,
  LIMITS,
  collectReferencedAssetIds,
  err,
  findElementIndex,
  generateId,
  ok,
  type DesignDocument,
  type DesignElement,
  type Page,
  type Result,
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
  const updated = update(page, { assets: document.assets });
  if (!updated.ok) return updated;
  // No-op page updates must not produce a new document (and thus a new history entry).
  if (updated.value === page) return ok(document);
  const pages = document.pages.slice();
  pages[index] = updated.value;
  return ok({ ...document, pages });
}

/** Image elements may only point at registered assets; other types never carry `assetId`. */
function checkAssetReference(
  element: DesignElement,
  context: PageContext,
  commandType: EditorCommand['type'],
): CommandError | null {
  if (element.type !== 'image' || element.assetId in context.assets) return null;
  return {
    code: 'asset-not-found',
    message: `Asset "${element.assetId}" is not registered in this document.`,
    command: commandType,
  };
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

    case 'element.add': {
      if (findElementIndex(page, command.element.id) !== -1) {
        return err({
          code: 'invalid-command',
          message: `An element with id "${command.element.id}" already exists on this page.`,
          command: command.type,
        });
      }
      const assetError = checkAssetReference(command.element, context, command.type);
      if (assetError) return err(assetError);
      const elements = page.elements.slice();
      const index =
        command.index === undefined
          ? elements.length
          : Math.max(0, Math.min(elements.length, command.index));
      elements.splice(index, 0, command.element);
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
      const copies: DesignElement[] = [];
      command.elementIds.forEach((elementId, i) => {
        const source = page.elements.find((element) => element.id === elementId);
        if (!source) return;
        copies.push({
          ...source,
          id: command.newIds?.[i] ?? generateId('el'),
          x: source.x + offset,
          y: source.y + offset,
        });
      });
      if (copies.length === 0) {
        return err({
          code: 'element-not-found',
          message: 'None of the requested elements exist on this page.',
          command: command.type,
        });
      }
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

    case 'document.rename':
    case 'document.resize':
    case 'asset.register':
    case 'asset.remove':
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
    case 'page.setBackground':
    case 'element.add':
    case 'element.update':
    case 'element.updateMany':
    case 'element.delete':
    case 'element.duplicate':
    case 'element.reorder':
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
