import { useState, useEffect, useCallback } from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'rio-no-ponto-theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch { /* noop */ }
  return 'system';
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === 'system' ? getSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', resolved);

  // Update meta theme-color to match
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', resolved === 'light' ? '#f5f5f7' : '#0d0d0d');
  }
}

export interface UseThemeReturn {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  cycle: () => void;
}

export function useTheme(): UseThemeReturn {
  const [mode, setModeState] = useState<ThemeMode>(getStoredTheme);

  const resolved: 'light' | 'dark' = mode === 'system' ? getSystemTheme() : mode;

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    try { localStorage.setItem(STORAGE_KEY, newMode); } catch { /* noop */ }
    applyTheme(newMode);
  }, []);

  const cycle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system';
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* noop */ }
      applyTheme(next);
      return next;
    });
  }, []);

  // Apply on mount
  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  // Listen for system preference changes
  useEffect(() => {
    if (mode !== 'system') return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const handler = () => applyTheme('system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  return { mode, resolved, setMode, cycle };
}
