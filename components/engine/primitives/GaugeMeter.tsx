import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming, Extrapolation, interpolate } from 'react-native-reanimated';

interface Props {
  value: number; // 0-100
  color: string;
  label: string;
  unit?: string;
  size?: number;
}

/**
 * Shared semicircular gauge — pressure, speed, lift, anything expressed as
 * 0-100 on a dial. Used across simulations instead of every scene hand-
 * rolling its own gauge markup (previously WaterTowerScene had one built
 * inline; this replaces that pattern with a reusable component so future
 * Biology/Chemistry gauges don't reinvent it).
 */
export default function GaugeMeter({ value, color, label, unit, size = 84 }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const needleAngle = useDerivedValue(() => withTiming(clamped, { duration: 220 }), [clamped]);

  const needleStyle = useAnimatedStyle(() => {
    const deg = interpolate(needleAngle.value, [0, 100], [-90, 90], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const radius = size / 2;

  return (
    <View style={styles.wrap}>
      <View style={[styles.arc, { width: size, height: radius, borderRadius: radius, borderColor: 'rgba(255,255,255,0.18)' }]}>
        <Animated.View
          style={[
            styles.needle,
            needleStyle,
            { height: radius - 8, backgroundColor: color, left: radius - 1.5, bottom: 0 },
          ]}
        />
        <View style={[styles.pivot, { left: radius - 4, backgroundColor: color }]} />
      </View>
      <Text style={[styles.value, { color }]}>{Math.round(clamped)}{unit ?? ''}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  arc: {
    borderWidth: 3, borderBottomWidth: 0,
    alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  needle: { position: 'absolute', width: 3, borderRadius: 2 },
  pivot: { position: 'absolute', bottom: -4, width: 8, height: 8, borderRadius: 4 },
  value: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  label: { fontSize: 9, fontWeight: '700', color: '#8892B0', letterSpacing: 0.5, textTransform: 'uppercase' },
});
