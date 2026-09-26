import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  name: string;
  /** The child's accent colour, from the data layer. Defaults to the brand colour. */
  color?: string;
  size?: number;
  style?: ViewStyle;
}

/** First initial of a name — the app's stand-in for a photo, which the school does not hold. */
export function initialFor(name: string): string {
  return (name.trim()[0] ?? '?').toUpperCase();
}

export function Avatar({ name, color, size = 44, style }: Props) {
  const c = useColors();
  const tint = color ?? c.primary;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: tint,
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42, color: c.onBrand }]}>{initialFor(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800' },
});
