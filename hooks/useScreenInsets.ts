import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Top padding for a screen header, including the browser's own chrome on web. */
export function useTopPadding(): number {
  const insets = useSafeAreaInsets();
  return Platform.OS === 'web' ? 67 : insets.top;
}

/** Bottom padding that clears the floating tab bar without hiding the last row. */
export function useTabBarSpacing(): number {
  return Platform.OS === 'web' ? 34 + 84 : 100;
}
