import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, interpolateColor } from 'react-native-reanimated';

interface Props {
  celsius: number;
  min?: number;
  max?: number;
  label?: string;
  size?: number;
}

const COLD = '#3D5AFE';
const HOT = '#FF5370';

/**
 * A vertical thermometer bulb+stem that fills and recolors with
 * temperature. Generic enough for fridges, weather lessons, chemistry
 * (reaction temperature), biology (body temperature) — not fridge-specific
 * despite being introduced for the Refrigerators explorable.
 */
export default function TemperatureIndicator({ celsius, min = -10, max = 40, label, size = 90 }: Props) {
  const pct = Math.max(0, Math.min(1, (celsius - min) / (max - min)));
  const stemHeight = size;
  const fillHeight = Math.max(6, pct * (stemHeight - 18));

  const fillStyle = useAnimatedStyle(() => ({
    height: withTiming(fillHeight, { duration: 220 }),
    backgroundColor: withTiming(interpolateColor(pct, [0, 1], [COLD, HOT]), { duration: 220 }),
  }));

  return (
    <View style={styles.wrap} accessible accessibilityLabel={`${label ?? 'Temperature'}: ${Math.round(celsius)} degrees Celsius`}>
      <View style={[styles.stem, { height: stemHeight - 14 }]}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <View style={[styles.bulb, { backgroundColor: pct > 0.5 ? HOT : COLD }]} />
      <Text style={styles.value}>{Math.round(celsius)}°C</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 4 },
  stem: {
    width: 14, borderTopLeftRadius: 7, borderTopRightRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'flex-end', overflow: 'hidden',
    borderWidth: 1, borderBottomWidth: 0, borderColor: 'rgba(255,255,255,0.15)',
  },
  fill: { width: '100%', borderRadius: 6 },
  bulb: { width: 22, height: 22, borderRadius: 11, marginTop: -4 },
  value: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  label: { fontSize: 9, fontWeight: '700', color: '#8892B0', letterSpacing: 0.5, textTransform: 'uppercase' },
});
