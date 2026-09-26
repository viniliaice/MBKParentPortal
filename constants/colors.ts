/**
 * The app's two palettes.
 *
 * Every screen reads its colours from `useColors()` (which resolves the parent's
 * chosen appearance), never from a literal. Both palettes declare the same keys,
 * so a missing token is a type error rather than a hard-to-spot dark-mode-only bug.
 *
 * The dark palette is the app's original look and is unchanged in spirit; the light
 * palette is the same design language on a white surface, with every text colour
 * chosen to stay readable on its background.
 */
export interface AppColors {
  text: string;
  tint: string;
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  /** Tinted fill for primary-coloured chips, tabs and icon wells. */
  primarySoft: string;
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
  /** Panels: cards and sheets. */
  surface: string;
  /** Nested wells inside a card (info rows, stat boxes). */
  surfaceMuted: string;
  /** Recessed areas such as progress tracks. */
  surfaceSunken: string;
  borderStrong: string;
  /** Body copy: long message text, paragraphs. */
  textBody: string;
  /** Secondary labels: timestamps, captions, helper lines. */
  textSecondary: string;
  /** Tertiary labels: the quietest text that still has to be readable. */
  textDim: string;
  placeholder: string;
  inputBackground: string;
  inputBorder: string;
  skeleton: string;
  /** Full-screen backgrounds behind modals and page sheets. */
  overlay: string;
  /** Dim layer drawn over the content when a modal is open. */
  backdrop: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarInactive: string;
  /** The aurora wash behind every screen. */
  gradient: readonly [string, string, string];
  glowPrimary: string;
  glowSecondary: string;
  glowAccent: string;
  /** The brand gradient used by primary buttons and hero cards. */
  brandGradient: readonly [string, string];
  onBrand: string;
  /** Chip/badge fill with enough contrast for its own text in both modes. */
  badge: string;
}

const dark: AppColors = {
  text: '#FFFFFF',
  tint: '#3D5AFE',
  background: '#0B1026',
  foreground: '#FFFFFF',
  card: '#141D3A',
  cardForeground: '#FFFFFF',
  primary: '#3D5AFE',
  primaryForeground: '#FFFFFF',
  primarySoft: 'rgba(61,90,254,0.18)',
  secondary: '#00BCD4',
  secondaryForeground: '#FFFFFF',
  muted: '#1A2A5C',
  mutedForeground: '#A2ABC9',
  accent: '#2ECC71',
  accentForeground: '#FFFFFF',
  destructive: '#FF5370',
  destructiveForeground: '#FFFFFF',
  border: 'rgba(255,255,255,0.08)',
  input: '#1A2A5C',
  warning: '#F59E0B',
  gold: '#F6C90E',
  surface: '#141D3A',
  surfaceMuted: 'rgba(255,255,255,0.05)',
  surfaceSunken: 'rgba(255,255,255,0.04)',
  borderStrong: 'rgba(255,255,255,0.14)',
  textBody: '#D5DAE9',
  textSecondary: '#A2ABC9',
  textDim: '#7F89A8',
  placeholder: '#7F89A8',
  inputBackground: 'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.10)',
  skeleton: 'rgba(255,255,255,0.07)',
  overlay: '#0B1026',
  backdrop: 'rgba(2,6,23,0.72)',
  tabBar: '#0B1026',
  tabBarBorder: 'rgba(255,255,255,0.08)',
  tabBarInactive: '#8892B0',
  gradient: ['#0B1026', '#0F1B3D', '#0B1026'],
  glowPrimary: 'rgba(61,90,254,0.08)',
  glowSecondary: 'rgba(0,188,212,0.06)',
  glowAccent: 'rgba(46,204,113,0.05)',
  brandGradient: ['#3D5AFE', '#00BCD4'],
  onBrand: '#FFFFFF',
  badge: 'rgba(255,255,255,0.08)',
};

const light: AppColors = {
  text: '#0F172A',
  tint: '#2E45D8',
  background: '#F6F8FF',
  foreground: '#0F172A',
  card: '#FFFFFF',
  cardForeground: '#0F172A',
  primary: '#2E45D8',
  primaryForeground: '#FFFFFF',
  primarySoft: '#E5EAFF',
  secondary: '#0E7490',
  secondaryForeground: '#FFFFFF',
  muted: '#E8EDF8',
  mutedForeground: '#4C5570',
  accent: '#15803D',
  accentForeground: '#FFFFFF',
  destructive: '#C62B45',
  destructiveForeground: '#FFFFFF',
  border: 'rgba(15,23,42,0.09)',
  input: '#F1F4FB',
  warning: '#B45309',
  gold: '#A16207',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F4FB',
  surfaceSunken: '#EAEEF8',
  borderStrong: 'rgba(15,23,42,0.16)',
  textBody: '#39415A',
  textSecondary: '#4C5570',
  textDim: '#6E7791',
  placeholder: '#6E7791',
  inputBackground: '#F1F4FB',
  inputBorder: 'rgba(15,23,42,0.14)',
  skeleton: 'rgba(15,23,42,0.07)',
  overlay: '#F6F8FF',
  backdrop: 'rgba(15,23,42,0.40)',
  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(15,23,42,0.10)',
  tabBarInactive: '#5F6980',
  gradient: ['#F6F8FF', '#E9EFFF', '#F6F8FF'],
  glowPrimary: 'rgba(61,90,254,0.12)',
  glowSecondary: 'rgba(0,188,212,0.10)',
  glowAccent: 'rgba(21,128,61,0.08)',
  brandGradient: ['#3D5AFE', '#00BCD4'],
  onBrand: '#FFFFFF',
  badge: 'rgba(15,23,42,0.06)',
};

/**
 * Accent colours that come from data rather than the theme (the curriculum's subject
 * and topic colours) are bright enough to sit on a dark surface but can be too pale
 * to read as text on a white one. In light mode they are shaded — the hue is kept,
 * the value is not, so bars and icons stay recognisable and labels stay legible.
 */
export function accessibleAccent(hex: string, isDark: boolean): string {
  if (isDark) return hex;
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => Math.round(((value >> shift) & 0xff) * 0.72);
  return `#${[16, 8, 0].map(shift => channel(shift).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Status tints (correct/incorrect fills, status pills) are built from the theme's solid
 * status colours, so the same intent stays readable on a white card and a dark one.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const value = parseInt(match[1], 16);
  const channel = (shift: number) => (value >> shift) & 0xff;
  return `rgba(${channel(16)}, ${channel(8)}, ${channel(0)}, ${alpha})`;
}

const colors = { light, dark, radius: 16 };

export default colors;
