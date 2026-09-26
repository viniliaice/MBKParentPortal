import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

/**
 * The parent's appearance choice.
 *
 * This is the *only* theme system in the app: screens read colours through
 * `useColors()`, which resolves these values. `system` follows the device and is
 * the default, so an existing parent sees no change until they choose otherwise.
 *
 * The choice is stored on the device (AsyncStorage) rather than server-side: it is
 * a display preference, not school data, and it has to apply before the network
 * answers.
 */
export type ThemePreference = 'light' | 'dark' | 'system';
export type ThemeScheme = 'light' | 'dark';

const THEME_KEY = '@mbk_theme';

interface ThemeContextType {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** The appearance actually in use, after resolving `system`. */
  scheme: ThemeScheme;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function isPreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(value => {
        if (isPreference(value)) setPreferenceState(value);
      })
      .catch(() => {
        // A corrupt preference must never block the app; `system` is the fallback.
      });
  }, []);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {
      // The choice still applies for this session even if it cannot be stored.
    });
  }, []);

  const scheme: ThemeScheme = preference === 'system'
    ? (systemScheme === 'light' ? 'light' : 'dark')
    : preference;

  const value = useMemo(
    () => ({ preference, setPreference, scheme, isDark: scheme === 'dark' }),
    [preference, setPreference, scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
