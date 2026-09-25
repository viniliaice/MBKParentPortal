import { useColorScheme } from 'react-native';
import colors from '@/constants/colors';

export function useColors() {
  const scheme = useColorScheme();
  // `colors` holds the two palettes plus a shared `radius` number, so the
  // lookup is typed on the palettes rather than on the whole object.
  const palettes: Record<string, typeof colors.light> = { light: colors.light, dark: colors.dark };
  const palette = scheme === 'dark' ? palettes.dark : palettes.light;
  return { ...palette, radius: colors.radius };
}
