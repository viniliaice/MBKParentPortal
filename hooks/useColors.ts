import colors, { type AppColors } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

/** The palette keys plus the shared corner radius. */
export type Colors = AppColors & { radius: number };

/**
 * Resolves the active palette from the parent's appearance choice (More → Appearance).
 * Read colours from here — a literal hex in a screen is a bug in the other mode.
 */
export function useColors(): Colors {
  const { scheme } = useTheme();
  // `colors` holds the two palettes plus a shared `radius` number, so the
  // lookup is typed on the palettes rather than on the whole object.
  const palettes: Record<string, AppColors> = { light: colors.light, dark: colors.dark };
  const palette = palettes[scheme];
  return { ...palette, radius: colors.radius };
}
