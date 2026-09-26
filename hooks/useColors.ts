import colors from '@/constants/colors';
import { useScheme } from '@/context/ThemeContext';
import type { ThemePalette } from '@/constants/colors';

/**
 * Tokens for the currently selected appearance. The palette comes from the
 * ThemeContext preference (persisted, user-chosen), not from the OS scheme.
 */
export function useColors() {
  const { scheme } = useScheme();
  const palette = colors[scheme];
  return { ...palette, radius: colors.radius, scheme };
}

/**
 * Rhythm tokens shared across the app so spacing, radii, shadows and typography
 * stay consistent. `backgroundColor` entries exist only where the shadow color
 * is used inside `@react-native-shadow`-style box shadows; they are always
 * literal whites (shadow color), not theme surfaces.
 */
export function useTheme() {
  const { scheme, isDark } = useScheme();
  return {
    isDark,
    scheme: scheme as ThemePalette,
    radius: colors.radius,
    spacing: {
      xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32,
    },
    typography: {
      h1: 26, h2: 20, h3: 17, body: 15, sub: 13, caption: 11,
    },
    shadow: (() => {
      // 'rgba' literals are shadow colours, not theme surfaces: safe on both
      // palettes.
      if (scheme === 'dark') {
        return { shadowColor: '#000000', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 };
      }
      return { shadowColor: '#1A2440', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 };
    })(),
  };
}
