import { TooltipProvider } from '@opencanvas/ui';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeToggle } from './ThemeToggle';
import { THEME_STORAGE_KEY } from './theme';
import { resetThemeStore } from './themeStore';
import { useThemeEffect } from './useAppTheme';

/** jsdom has no real media queries, so the OS preference is supplied by this stand-in. */
function stubSystemPreference(dark: boolean) {
  const listeners = new Set<() => void>();
  let matches = dark;
  vi.stubGlobal('matchMedia', (query: string) => {
    const asksForDark = query.includes('prefers-color-scheme: dark');
    return {
      // A getter, not a snapshot: the hook keeps the object and re-reads it when notified,
      // exactly as a real MediaQueryList behaves.
      get matches() {
        return asksForDark ? matches : false;
      },
      media: query,
      addEventListener: (_: string, handler: () => void) => listeners.add(handler),
      removeEventListener: (_: string, handler: () => void) => listeners.delete(handler),
    } as unknown as MediaQueryList;
  });
  return {
    set(next: boolean) {
      act(() => {
        matches = next;
        for (const listener of listeners) listener();
      });
    },
  };
}

function Harness() {
  useThemeEffect();
  return <ThemeToggle />;
}

function renderToggle() {
  // The store reads the OS and storage once, when it is first built, so each case needs a
  // fresh one rather than whatever the previous case left behind.
  resetThemeStore();
  return render(
    <TooltipProvider>
      <Harness />
    </TooltipProvider>,
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

async function choose(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Change appearance' }));
  const menu = await screen.findByRole('menu', { name: 'Appearance' });
  await user.click(within(menu).getByRole('menuitem', { name: new RegExp(label) }));
}

describe('the appearance switch', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    document.documentElement.style.colorScheme = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('starts on whatever the operating system asks for', () => {
    stubSystemPreference(true);
    renderToggle();
    expect(isDark()).toBe(true);
  });

  it('switches the whole document when a theme is picked', async () => {
    stubSystemPreference(false);
    renderToggle();
    expect(isDark()).toBe(false);

    await choose('Dark');
    expect(isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    await choose('Light');
    expect(isDark()).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('remembers the choice for the next visit', async () => {
    stubSystemPreference(false);
    renderToggle();
    await choose('Dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('keeps following the system after the system changes, but only on system', async () => {
    const system = stubSystemPreference(false);
    renderToggle();

    system.set(true);
    expect(isDark(), 'system preference should still be followed').toBe(true);

    // Once the user pins a theme, the OS no longer gets a vote.
    await choose('Light');
    expect(isDark()).toBe(false);
    system.set(true);
    expect(isDark(), 'an explicit choice outranks the OS').toBe(false);
  });

  it('shows which option is active', async () => {
    stubSystemPreference(false);
    const user = userEvent.setup();
    renderToggle();
    await choose('Dark');

    await user.click(screen.getByRole('button', { name: 'Change appearance' }));
    const menu = await screen.findByRole('menu', { name: 'Appearance' });
    expect(within(menu).getByRole('menuitem', { name: /Dark/ })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(within(menu).getByRole('menuitem', { name: /Light/ })).toHaveAttribute(
      'aria-current',
      'false',
    );
  });

  it('ignores a stored value it does not recognise', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'neon');
    stubSystemPreference(true);
    renderToggle();
    // Falls back to system rather than refusing to render or picking light blindly.
    expect(isDark()).toBe(true);
  });
});
