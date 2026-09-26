/**
 * The app's two palettes plus a shared shape (radius).
 *
 * Light and dark are deliberately different palettes now: the scheme is chosen
 * by the user in More → Appearance, not by the OS, so both must be complete and
 * readable on their own. Screen code reads from these tokens through
 * `hooks/useColors()` and `hooks/useTheme()` — never hardcode a hex.
 */

/** Brand/accent colours that read well on both palettes. */
export const palette = {
  primary: '#3D5AFE',
  secondary: '#00BCD4',
  accent: '#2ECC71',
  warning: '#F59E0B',
  gold: '#F6C90E',
  destructive: '#FF5370',
} as const;

/** Subject / avatar cycle — used identically on both palettes. */
export const AVATAR_COLORS = ['#3D5AFE', '#00BCD4', '#2ECC71', '#F59E0B', '#EC4899', '#8B5CF6'];

type ThemeTokens = {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  warning: string;
  gold: string;
};

export type ThemePalette = 'light' | 'dark';

const light: ThemeTokens = {
  text: '#101528',
  tint: '#3D5AFE',
  background: '#F4F6FC',
  foreground: '#101528',
  card: '#FFFFFF',
  cardForeground: '#101528',
  primary: '#3D5AFE',
  primaryForeground: '#FFFFFF',
  secondary: '#0091A8',
  secondaryForeground: '#FFFFFF',
  muted: '#E9EDF7',
  mutedForeground: '#4E5C7E',
  accent: '#1F9D55',
  accentForeground: '#FFFFFF',
  destructive: '#E0485F',
  destructiveForeground: '#FFFFFF',
  border: 'rgba(16,21,40,0.10)',
  input: '#EEF1FA',
  warning: '#C47F0B',
  gold: '#C79A0A',
};

const dark: ThemeTokens = {
  text: '#FFFFFF',
  tint: '#3D5AFE',
  background: '#0B1026',
  foreground: '#FFFFFF',
  card: '#141D3A',
  cardForeground: '#FFFFFF',
  primary: '#3D5AFE',
  primaryForeground: '#FFFFFF',
  secondary: '#00BCD4',
  secondaryForeground: '#FFFFFF',
  muted: '#1A2A5C',
  mutedForeground: '#8892B0',
  accent: '#2ECC71',
  accentForeground: '#FFFFFF',
  destructive: '#FF5370',
  destructiveForeground: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  input: '#1A2A5C',
  warning: '#F59E0B',
  gold: '#F6C90E',
};

const colors = {
  light,
  dark,
  radius: 16,
};

export default colors;
