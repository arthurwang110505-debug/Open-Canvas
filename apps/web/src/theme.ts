/**
 * Interface theme: the chrome around a design, never the design itself.
 *
 * A document's own colours belong to the document — switching the app to dark must not change
 * what a page looks like, or what it exports to. Only the surfaces around the canvas follow.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

/** The theme actually in effect once `system` has been resolved against the OS. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'opencanvas.theme';

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (PREFERENCES as readonly string[]).includes(value);
}

/** Reads the stored choice, falling back to `system` for anything unrecognised or unreadable. */
export function readStoredTheme(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference {
  try {
    const stored = storage?.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    // Private browsing and blocked-storage modes throw rather than returning null.
    return 'system';
  }
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Puts the resolved theme on the document element.
 *
 * `color-scheme` is set alongside the class so the browser's own furniture — scrollbars, form
 * controls, the text caret — matches instead of staying stubbornly light.
 */
export function applyTheme(root: HTMLElement, theme: ResolvedTheme): void {
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

/**
 * The snippet that runs before React mounts.
 *
 * Without it the first paint is light and then snaps to dark, which is the single most
 * noticeable flaw in a themed app. Kept as a string so `index.html` can run it synchronously in
 * the document head, before any stylesheet paints.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{
var s=localStorage.getItem('${THEME_STORAGE_KEY}');
var d=s==='dark'||((s===null||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark',d);
document.documentElement.style.colorScheme=d?'dark':'light';
}catch(e){}})();`;
