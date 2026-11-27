import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

export interface ThemeState {
  /** What the user chose: `system`, `light`, or `dark`. */
  preference: ThemePreference;
  /** What that resolves to right now, once the OS has had its say. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

export type ThemeStore = StoreApi<ThemeState>;

const DARK_QUERY = '(prefers-color-scheme: dark)';

function systemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(DARK_QUERY).matches;
}

/**
 * The interface theme, held outside React.
 *
 * A context would mean every surface that offers the switch has to sit under one provider, and
 * the editor is mounted on its own in tests and when embedded. A store has no such requirement
 * and still gives one source of truth.
 */
export function createThemeStore(): ThemeStore {
  const initial = readStoredTheme(typeof window === 'undefined' ? undefined : window.localStorage);
  const store = createStore<ThemeState>((set, get) => ({
    preference: initial,
    resolved: resolveTheme(initial, systemPrefersDark()),
    setPreference: (preference) => {
      if (preference === get().preference) return;
      set({ preference, resolved: resolveTheme(preference, systemPrefersDark()) });
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, preference);
      } catch {
        // Blocked storage is not worth failing a theme change over; it just will not persist.
      }
    },
  }));

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const media = window.matchMedia(DARK_QUERY);
    const sync = () => {
      const { preference, resolved } = store.getState();
      const next = resolveTheme(preference, media.matches);
      if (next !== resolved) store.setState({ resolved: next });
    };
    media.addEventListener('change', sync);

    // Another tab changing the theme should not leave this one out of step.
    window.addEventListener('storage', (event) => {
      if (event.key !== THEME_STORAGE_KEY) return;
      const preference = readStoredTheme(window.localStorage);
      store.setState({ preference, resolved: resolveTheme(preference, media.matches) });
    });
  }

  return store;
}

let shared: ThemeStore | null = null;

/** The one store the app uses. Created lazily so importing this module stays side-effect free. */
export function themeStore(): ThemeStore {
  shared ??= createThemeStore();
  return shared;
}

/** Test seam: forget the shared store so the next call builds a fresh one. */
export function resetThemeStore(): void {
  shared = null;
}

/** Keeps the document element in step with whatever the store says. */
export function subscribeThemeToDocument(store: ThemeStore): () => void {
  applyTheme(document.documentElement, store.getState().resolved);
  let last = store.getState().resolved;
  return store.subscribe((state) => {
    if (state.resolved === last) return;
    last = state.resolved;
    applyTheme(document.documentElement, state.resolved);
  });
}
