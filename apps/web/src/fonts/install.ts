import { FONT_FAMILIES } from './catalog';

const STYLE_ID = 'opencanvas-fonts';

function quoteFamily(family: string): string {
  return `"${family.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** `@font-face` rules for every bundled family, ready for a `<style>` element. */
export function bundledFontFaceCss(): string {
  return FONT_FAMILIES.flatMap((font) =>
    font.faces.map(
      (face) =>
        `@font-face{font-family:${quoteFamily(font.family)};font-style:${face.style};` +
        `font-weight:${face.weight};font-display:swap;` +
        `src:url(${face.url}) format("woff2");}`,
    ),
  ).join('\n');
}

/**
 * Adds the bundled fonts to the page once. Files are served from this app, so the editor works
 * offline; loading is left to the browser (fonts a document does not use cost nothing).
 */
export function installBundledFonts(target: Document = document): void {
  if (target.getElementById(STYLE_ID)) return;
  const style = target.createElement('style');
  style.id = STYLE_ID;
  style.textContent = bundledFontFaceCss();
  target.head.append(style);
}
