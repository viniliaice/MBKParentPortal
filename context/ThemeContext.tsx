import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

/**
 * User-selected appearance. More → Appearance toggles it and the choice is
 * persisted under `@mbk_appearance` (`light` | `dark`). Rhythm / semantics are
 * addressed through `useColors()` and `useTheme()`; this context resolves the
 * palette key only.
 */
const STORAGE_KEY = '@mbk_appearance';

export type AppScheme = 'light' | 'dark';

interface ThemeContextType {
  scheme: AppScheme;
  isDark: boolean;
  setScheme: (scheme: AppScheme) => void;
  toggle: () => void;
  /** Resolved after the stored preference has been read. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setSchemeState] = useState<AppScheme>('dark');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then(val => {
        if (!alive) return;
        if (val === 'light' || val === 'dark') setSchemeState(val);
      })
      .catch(() => {
        // A corrupt pref must never block the app; the default scheme stands.
      })
      .finally(() => {
        if (alive) setReady(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const setScheme = (next: AppScheme) => {
    setSchemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory choice already applies.
    });
  };

  const value = useMemo<ThemeContextType>(
    () => ({
      scheme,
      isDark: scheme === 'dark',
      setScheme,
      toggle: () => setSchemeState(prev => {
        const next = prev === 'dark' ? 'light' : 'dark';
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
        return next;
      }),
      ready,
    }),
    [scheme, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useScheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useScheme must be used inside ThemeProvider');
  return ctx;
}
