import { useEffect } from 'react';
import { useStore } from 'zustand';

import { subscribeThemeToDocument, themeStore, type ThemeState } from './themeStore';

/** Reads and changes the interface theme from anywhere, with or without a provider above. */
export function useAppTheme(): ThemeState {
  return useStore(themeStore());
}

/**
 * Mounts the theme onto the document.
 *
 * Called once, near the root. `index.html` has already set the class before the first paint;
 * this keeps it correct for everything that happens afterwards.
 */
export function useThemeEffect(): void {
  useEffect(() => subscribeThemeToDocument(themeStore()), []);
}
