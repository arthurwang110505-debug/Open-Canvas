import {
  applyListMarkers,
  applyTextTransform,
  LIST_INDENT_EM,
  type TextElement,
} from '@opencanvas/document';

/**
 * Vertical text metrics shared with the canvas renderer.
 *
 * Fabric draws a `Textbox` from the top of the element box. Its first baseline sits
 * `_fontSizeMult * (1 - _fontSizeFraction)` = `1.13 * (1 - 0.222)` em below the top of the line
 * box, and each following line advances by `fontSize * lineHeight`. Using the same constants
 * keeps exported text where the user sees it on the canvas.
 */
export const TEXT_BASELINE_EM = 0.908;

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  letterSpacing: number;
}

/**
 * Measures a string in pixels for a style. The SVG renderer stays pure by accepting this as a
 * parameter; the browser passes a canvas 2D measurement so wrapped text exports as it renders.
 */
export type TextMeasurer = (text: string, style: TextStyle) => number;

export function textStyleOf(element: TextElement): TextStyle {
  return {
    fontFamily: element.fontFamily,
    fontSize: element.fontSize,
    fontWeight: element.fontWeight,
    fontStyle: element.fontStyle,
    letterSpacing: element.letterSpacing,
  };
}

/** Hard line breaks, exactly as a canvas text object treats them. */
export function splitHardLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

function wrapLine(
  line: string,
  maxWidth: number,
  style: TextStyle,
  measure: TextMeasurer,
): string[] {
  if (line.length === 0) return [''];
  if (measure(line, style) <= maxWidth) return [line];

  // Splitting on the separators keeps them, so spacing inside a line is preserved.
  const pieces = line.split(/(\s+)/);
  const lines: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (piece.length === 0) continue;
    const candidate = current + piece;
    if (current.trim().length > 0 && measure(candidate.trimEnd(), style) > maxWidth) {
      lines.push(current.trimEnd());
      current = piece.trimStart();
    } else {
      current = candidate;
    }
  }
  const tail = current.trimEnd();
  if (tail.length > 0) lines.push(tail);
  // A word longer than the box stays on its own line and overflows, as it does on the canvas.
  return lines.length > 0 ? lines : [''];
}

/**
 * The lines a text element occupies. Without a measurer only hard breaks are applied (SVG has no
 * automatic wrapping); with one, each hard line is wrapped to the element width.
 */
export function wrapTextLines(element: TextElement, measure?: TextMeasurer): string[] {
  // Casing is display-only, so the document keeps the text as typed and every renderer applies it
  // here — before wrapping, exactly like the canvas text object does.
  const hardLines = splitHardLines(applyTextTransform(element.text, element.textTransform));
  const lines = measure ? wrapHardLines(hardLines, element, measure) : hardLines;
  // List markers are added after wrapping so they land on visual lines, never in the stored text.
  return applyListMarkers(lines, element.listStyle);
}

function wrapHardLines(
  hardLines: readonly string[],
  element: TextElement,
  measure: TextMeasurer,
): string[] {
  const indent = element.listStyle === 'none' ? 0 : element.fontSize * LIST_INDENT_EM;
  const maxWidth = element.width - indent;
  if (!Number.isFinite(maxWidth) || maxWidth <= 0) return [...hardLines];
  const style = textStyleOf(element);
  return hardLines.flatMap((line) => wrapLine(line, maxWidth, style, measure));
}
