import React from 'react';
import { StyleSheet, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Renders the card as a tappable surface with a pressed state. */
  onPress?: () => void;
  accessibilityLabel?: string;
  /** Padding on all sides; pass 0 for edge-to-edge rows. */
  padded?: boolean;
}

/** The one panel style in the app: themed surface, thin border, 18pt corners. */
export function Card({ children, style, onPress, accessibilityLabel, padded = true }: Props) {
  const c = useColors();
  const base = [
    styles.card,
    { backgroundColor: c.surface, borderColor: c.border },
    padded && styles.padded,
    style,
  ];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <TouchableOpacity style={base} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={accessibilityLabel}>
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1 },
  padded: { padding: 16 },
});
