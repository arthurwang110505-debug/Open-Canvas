import type {
  Asset,
  DesignElement,
  EllipseElement,
  Fill,
  IconElement,
  ImageElement,
  PathElement,
  RectElement,
  TextElement,
} from '@opencanvas/document';

/**
 * Union of every editable property across element types (minus identity fields).
 * The reducer re-validates the patched element against the schema, so properties that
 * do not apply to a given element type are stripped and invalid values are rejected.
 */
type EditableProps<T> = Omit<T, 'id' | 'type'>;
export type ElementPatch = Partial<
  EditableProps<RectElement> &
    EditableProps<EllipseElement> &
    EditableProps<TextElement> &
    EditableProps<ImageElement> &
    EditableProps<PathElement> &
    EditableProps<IconElement>
>;

export type ReorderTarget = 'front' | 'back' | 'forward' | 'backward' | { index: number };

/**
 * Every mutation of a document goes through one of these commands. The UI, keyboard
 * shortcuts, AI assistant and (later) collaboration all share the same vocabulary, which
 * keeps history, autosave and validation consistent.
 */
export type EditorCommand =
  | { type: 'document.rename'; name: string }
  | { type: 'document.resize'; width: number; height: number }
  | { type: 'page.setBackground'; pageId: string; background: Fill }
  /** Adds a page, optionally seeded with template content (background and elements). */
  | {
      type: 'page.add';
      afterPageId?: string;
      pageId?: string;
      background?: Fill;
      elements?: readonly DesignElement[];
    }
  /** Replaces a page's background and elements in one undoable step (template application). */
  | {
      type: 'page.replaceContent';
      pageId: string;
      background: Fill;
      elements: readonly DesignElement[];
    }
  | { type: 'page.duplicate'; pageId: string; newPageId?: string }
  | { type: 'page.delete'; pageId: string }
  | { type: 'page.reorder'; pageId: string; toIndex: number }
  /**
   * Adds an asset record to the document. Bytes live in an asset store; the record only
   * carries metadata. Image elements may reference the asset once it is registered.
   */
  | { type: 'asset.register'; asset: Asset }
  /** Removes an asset record. Rejected while any element still references it. */
  | { type: 'asset.remove'; assetId: string }
  | { type: 'element.add'; pageId: string; element: DesignElement; index?: number }
  | { type: 'element.update'; pageId: string; elementId: string; patch: ElementPatch }
  | {
      type: 'element.updateMany';
      pageId: string;
      updates: readonly { elementId: string; patch: ElementPatch }[];
    }
  | { type: 'element.delete'; pageId: string; elementIds: readonly string[] }
  | {
      type: 'element.duplicate';
      pageId: string;
      elementIds: readonly string[];
      /** Offset applied to the copies so they are visibly distinct. Defaults to 20px. */
      offset?: number;
      /** Optional ids for the copies (same order as `elementIds`); generated when omitted. */
      newIds?: readonly string[];
    }
  | { type: 'element.reorder'; pageId: string; elementId: string; to: ReorderTarget }
  | { type: 'element.group'; pageId: string; elementIds: readonly string[]; groupId?: string }
  | { type: 'element.ungroup'; pageId: string; groupId: string };

export type EditorCommandType = EditorCommand['type'];

export interface CommandError {
  code:
    | 'page-not-found'
    | 'element-not-found'
    | 'asset-not-found'
    | 'invalid-result'
    | 'invalid-command';
  message: string;
  command: EditorCommandType;
}
