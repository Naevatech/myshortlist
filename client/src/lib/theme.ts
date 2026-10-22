import { useCallback, useSyncExternalStore } from 'react';

/** Light or dark, remembered on this device. Light unless the person turns dark mode on. */
export type Theme = 'light' | 'dark';

const KEY = 'shortlist-theme';
const listeners = new Set<() => void>();

function read(): Theme {
  try {
    return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

let current: Theme = typeof window === 'undefined' ? 'light' : read();

function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dk', theme === 'dark');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0E1116' : '#1F3A5F');
}

/** Called once before the first render, so the page never flashes the wrong theme. */
export function initTheme() {
  apply(current);
}

export function setTheme(theme: Theme) {
  current = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* storage can be unavailable; the choice then lasts for this visit only */
  }
  apply(theme);
  listeners.forEach((l) => l());
}

export function useTheme() {
  const theme = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => 'light' as Theme,
  );
  const toggle = useCallback(() => setTheme(current === 'dark' ? 'light' : 'dark'), []);
  return { dark: theme === 'dark', toggle };
}
