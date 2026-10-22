import {
  applyTextTransform,
  LIST_INDENT_EM,
  listPrefix,
  type ListStyle,
  type TextTransform,
} from '@opencanvas/document';
import { Textbox } from 'fabric';

/**
 * A Textbox that renders the document's `textTransform` without rewriting the text.
 *
 * Fabric has no notion of CSS casing, so the transform is applied where lines are split: the
 * element keeps the characters the author typed, `text` stays untouched (which is also what the
 * inline editor commits), and only the drawn lines are cased. Anything else would bake
 * "HELLO" into the document the moment someone toggled uppercase.
 */
export class DocumentTextbox extends Textbox {
  declare textTransform: TextTransform;
  declare listStyle: ListStyle;

  static override ownDefaults = {
    ...Textbox.ownDefaults,
    textTransform: 'none' as TextTransform,
    listStyle: 'none' as ListStyle,
  };

  override _splitTextIntoLines(text: string) {
    return super._splitTextIntoLines(applyTextTransform(text, this.textTransform));
  }

  /**
   * Wraps at a narrower width when a list is on, so the marker sits inside the box instead of
   * pushing the last word past its right edge, then prefixes each non-empty visual line.
   */
  override _wrapText(lines: string[], desiredWidth: number) {
    if (this.listStyle === 'none') return super._wrapText(lines, desiredWidth);
    const indent = this.fontSize * LIST_INDENT_EM;
    const wrapped = super._wrapText(lines, Math.max(this.fontSize, desiredWidth - indent));
    let number = 0;
    return wrapped.map((graphemes) => {
      if (graphemes.join('').trim().length === 0) return graphemes;
      number += 1;
      return [...listPrefix(this.listStyle, number), ...graphemes];
    });
  }

  /**
   * Changes the casing and re-splits the lines. Returns whether anything changed, so the adapter
   * can avoid re-measuring on every render.
   */
  setTextTransform(transform: TextTransform): boolean {
    if (this.textTransform === transform) return false;
    this.textTransform = transform;
    this.refreshLayout();
    return true;
  }

  /** Same contract as `setTextTransform`, for the list style. */
  setListStyle(style: ListStyle): boolean {
    if (this.listStyle === style) return false;
    this.listStyle = style;
    this.refreshLayout();
    return true;
  }

  /** Re-splits lines after a display-only property changed. */
  private refreshLayout() {
    this.initDimensions();
    this.dirty = true;
    this.setCoords();
  }
}
