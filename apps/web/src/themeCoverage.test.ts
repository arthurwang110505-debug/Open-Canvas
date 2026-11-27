import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOTS = [resolve(process.cwd(), 'src'), resolve(process.cwd(), '../../packages/ui/src')];

/**
 * Whole files that are deliberately one colour in both themes: Present mode is a darkened
 * theatre by design, and the thumbnails render a design's own paper, which is the document
 * rather than the interface. Switching the app to dark must not repaint someone's artwork.
 *
 * Anything narrower is marked in place with a `theme-ok:` comment giving the reason, so the
 * exception lives next to the code it excuses instead of in a list that nobody rereads.
 */
const EXEMPT = [
  'share/PresentMode.tsx',
  'editor/PageThumbnail.tsx',
  'templates/TemplateThumbnail.tsx',
  'projects/ProjectThumbnail.tsx',
];

const INLINE_EXEMPT = 'theme-ok:';

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      out.push(...sourceFiles(path));
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) {
      out.push(path);
    }
  }
  return out;
}

const FILES = ROOTS.flatMap(sourceFiles);

function offenders(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const file of FILES) {
    const label = relative(process.cwd(), file);
    if (EXEMPT.some((exempt) => label.endsWith(exempt))) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const [index, line] of lines.entries()) {
      // The marker may sit on the line itself or on the one above it, which is where a
      // formatter will push it for a long className.
      if (line.includes(INLINE_EXEMPT) || (lines[index - 1] ?? '').includes(INLINE_EXEMPT))
        continue;
      const match = pattern.exec(line);
      if (match) found.push(`${label}: ${match[0]}`);
      pattern.lastIndex = 0;
    }
  }
  return found;
}

describe('theme coverage', () => {
  it('paints no interface surface with a hard-coded colour', () => {
    // A literal like bg-[#f7f8fc] or bg-white cannot follow the theme, so it is the one way a
    // dark mode quietly regresses: everything else adapts and one panel stays glaring.
    expect(offenders(/\b(bg|text|border|ring|divide)-\[#[0-9a-fA-F]{3,8}\]/)).toEqual([]);
  });

  it('uses the panel token rather than plain white for chrome', () => {
    expect(offenders(/\bbg-white\b(?!\/)/)).toEqual([]);
  });

  it('uses semantic tokens rather than a fixed palette ramp', () => {
    const ramp =
      /\b(bg|text|border|ring|fill|stroke)-(slate|gray|zinc|neutral|stone|emerald|amber|rose|indigo|violet)-\d{2,3}\b/;
    expect(offenders(ramp)).toEqual([]);
  });
});
