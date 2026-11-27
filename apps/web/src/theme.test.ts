/* eslint-disable @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call,
   @typescript-eslint/no-unsafe-return, @typescript-eslint/no-empty-function --
   These tests run the inline <head> bootstrap the way a browser runs it: as source text
   evaluated against a stub document. Reimplementing it in TypeScript would test a copy
   rather than the script that actually ships, which is the one that can go wrong. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { contrastRatio } from './templates/readability';
import type { ResolvedTheme, ThemePreference } from './theme';
import {
  applyTheme,
  isThemePreference,
  readStoredTheme,
  resolveTheme,
  THEME_BOOTSTRAP_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';

// Vitest runs with the package as its working directory.
const THEME_CSS = readFileSync(
  resolve(process.cwd(), '../../packages/ui/src/styles/theme.css'),
  'utf8',
);

/** Pulls `--color-*` declarations out of a block of the stylesheet. */
function tokensIn(source: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const match of source.matchAll(/--color-([a-z-]+):\s*(#[0-9a-f]{3,8});/gi)) {
    tokens[match[1] ?? ''] = match[2] ?? '';
  }
  return tokens;
}

function blockAfter(marker: string): string {
  const start = THEME_CSS.indexOf(marker);
  expect(start, `"${marker}" is missing from theme.css`).toBeGreaterThanOrEqual(0);
  const open = THEME_CSS.indexOf('{', start);
  const close = THEME_CSS.indexOf('}', open);
  return THEME_CSS.slice(open, close);
}

const LIGHT = tokensIn(blockAfter('@theme {'));
const DARK = { ...LIGHT, ...tokensIn(blockAfter('\n.dark {')) };

// Text that must be readable on the surface it is painted on. Keeping this list here, rather
// than trusting that a hand-picked palette happens to work, is what makes a second theme safe
// to add: the gate fails before anyone has to squint at a screenshot.
const TEXT_PAIRS: readonly (readonly [string, string])[] = [
  ['foreground', 'background'],
  ['foreground', 'panel'],
  ['foreground', 'muted'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'panel'],
  ['muted-foreground', 'muted'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['destructive-foreground', 'destructive'],
  ['destructive', 'panel'],
  ['success', 'panel'],
  ['warning', 'panel'],
  ['primary', 'panel'],
];

describe('the theme tokens', () => {
  it('defines a dark value for every colour the light theme has', () => {
    const lightNames = Object.keys(LIGHT).sort();
    const darkNames = Object.keys(tokensIn(blockAfter('\n.dark {'))).sort();
    expect(darkNames).toEqual(lightNames);
  });

  for (const [name, tokens] of [
    ['light', LIGHT],
    ['dark', DARK],
  ] as const) {
    it(`keeps every ${name} foreground readable on its surface`, () => {
      const failures: string[] = [];
      for (const [front, back] of TEXT_PAIRS) {
        const foreground = tokens[front];
        const background = tokens[back];
        expect(foreground, `${name}: --color-${front}`).toBeDefined();
        expect(background, `${name}: --color-${back}`).toBeDefined();
        const ratio = contrastRatio(foreground ?? '#000', background ?? '#fff');
        if (ratio < 4.5) failures.push(`${front} on ${back} = ${ratio.toFixed(2)}:1`);
      }
      expect(failures).toEqual([]);
    });
  }

  it('keeps borders visible against the panels they divide', () => {
    for (const [name, tokens] of [
      ['light', LIGHT],
      ['dark', DARK],
    ] as const) {
      // Not text, so AA does not apply; it only has to be seen.
      const ratio = contrastRatio(tokens['border'] ?? '#000', tokens['panel'] ?? '#fff');
      expect(ratio, `${name} border on panel`).toBeGreaterThan(1.15);
    }
  });

  it('keeps the workspace distinct from the panels floating above it', () => {
    for (const [name, tokens] of [
      ['light', LIGHT],
      ['dark', DARK],
    ] as const) {
      expect(tokens['workspace'], `${name} workspace`).not.toBe(tokens['panel']);
    }
  });

  it('drives the dark variant from the class, not the operating system', () => {
    // Tailwind's default `dark:` variant follows prefers-color-scheme, which would ignore a
    // user who asked for light while their OS is dark.
    expect(THEME_CSS).toContain('@custom-variant dark (&:where(.dark, .dark *));');
  });

  it('tells the browser to restyle its own furniture', () => {
    expect(THEME_CSS).toContain('color-scheme: dark;');
  });
});

describe('the theme preference', () => {
  it('accepts only the three it knows', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('midnight')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('follows the operating system when set to system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('ignores the operating system once the user has chosen', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('falls back to system for missing or damaged storage', () => {
    expect(readStoredTheme(undefined)).toBe('system');
    expect(readStoredTheme({ getItem: () => null })).toBe('system');
    expect(readStoredTheme({ getItem: () => 'neon' })).toBe('system');
    expect(readStoredTheme({ getItem: () => 'dark' })).toBe('dark');
  });

  it('survives storage that throws, as it does in private browsing', () => {
    expect(
      readStoredTheme({
        getItem: () => {
          throw new Error('blocked');
        },
      }),
    ).toBe('system');
  });
});

describe('applying a theme', () => {
  it('marks the element and tells the browser which way round it is', () => {
    const root = document.createElement('div');
    applyTheme(root, 'dark');
    expect(root.classList.contains('dark')).toBe(true);
    expect(root.style.colorScheme).toBe('dark');

    applyTheme(root, 'light');
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
  });
});

describe('the pre-paint bootstrap', () => {
  // The inline copy in index.html is what actually runs; this keeps the two from drifting.
  const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

  it('is present in the document head, before anything can paint', () => {
    expect(html).toContain(THEME_STORAGE_KEY);
    expect(html.indexOf('prefers-color-scheme')).toBeLessThan(html.indexOf('<body>'));
  });

  /** Runs the real snippet against a stand-in browser and reports what it decided. */
  function runSnippet(source: string, stored: string | null, osDark: boolean): ResolvedTheme {
    const classes = new Set<string>();
    const root = {
      classList: {
        toggle: (name: string, on: boolean) => {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      },
      style: { colorScheme: '' },
    };
    const scope = {
      localStorage: { getItem: (key: string) => (key === THEME_STORAGE_KEY ? stored : null) },
      matchMedia: (query: string) => ({ matches: osDark && query.includes('dark') }),
      document: { documentElement: root },
    };
    // The snippet reaches for bare `localStorage`, `window` and `document`, so hand it each.
    new Function('localStorage', 'window', 'document', source)(
      scope.localStorage,
      scope,
      scope.document,
    );
    expect(root.style.colorScheme).toBe(classes.has('dark') ? 'dark' : 'light');
    return classes.has('dark') ? 'dark' : 'light';
  }

  const CASES: readonly (readonly [ThemePreference | null, boolean])[] = [
    ['dark', false],
    ['light', true],
    ['system', true],
    ['system', false],
    [null, true],
    [null, false],
  ];

  it('resolves a stored choice the same way the module does', () => {
    for (const [stored, osDark] of CASES) {
      const expected = resolveTheme(stored ?? 'system', osDark);
      expect(
        runSnippet(THEME_BOOTSTRAP_SCRIPT, stored, osDark),
        `stored=${String(stored)} osDark=${String(osDark)}`,
      ).toBe(expected);
    }
  });

  it('matches the copy that is actually inlined in index.html', () => {
    const inline = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
    for (const [stored, osDark] of CASES) {
      expect(
        runSnippet(inline, stored, osDark),
        `inline: stored=${String(stored)} osDark=${String(osDark)}`,
      ).toBe(resolveTheme(stored ?? 'system', osDark));
    }
  });

  it('stays light when storage throws instead of leaving the page unstyled', () => {
    const thrower = {
      getItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() =>
      new Function('localStorage', 'window', 'document', THEME_BOOTSTRAP_SCRIPT)(
        thrower,
        { matchMedia: () => ({ matches: true }) },
        { documentElement: { classList: { toggle: () => {} }, style: {} } },
      ),
    ).not.toThrow();
  });
});
