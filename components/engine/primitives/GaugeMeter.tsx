import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, Easing,
  interpolate, Extrapolation,
} from 'react-native-reanimated';

interface Props {
  value: number; // 0-100
  color: string;
  label: string;
  unit?: string;
  size?: number;
}

const TICK_COUNT = 9;

/**
 * A proper semicircular dial gauge — tick marks, a colored fill arc (built
 * from small rotated bars, since no SVG library is installed in this
 * project), a needle that springs to its new reading with a touch of
 * overshoot instead of linearly tweening, a pivot that glows when the
 * reading is high, and a value readout that pops each time it changes.
 * Fully generic — pressure, speed, lift, temperature-as-a-dial, any 0-100
 * reading in any future subject.
 */
export default function GaugeMeter({ value, color, label, unit, size = 88 }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  const needleValue = useSharedValue(clamped);
  const prevValueRef = React.useRef(clamped);
  const pop = useSharedValue(1);
  const glow = useSharedValue(0);

  useEffect(() => {
    needleValue.value = withSpring(clamped, { damping: 11, stiffness: 90, mass: 0.7 });
    glow.value = withTiming(clamped / 100, { duration: 300 });
    if (Math.abs(clamped - prevValueRef.current) > 0.5) {
      pop.value = 1.22;
      pop.value = withSpring(1, { damping: 8, stiffness: 260 });
    }
    prevValueRef.current = clamped;
  }, [clamped]);

  const pivotPulse = useSharedValue(0);
  useEffect(() => {
    pivotPulse.value = withRepeat(withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, []);

  const needleStyle = useAnimatedStyle(() => {
    const deg = interpolate(needleValue.value, [0, 100], [-88, 88], Extrapolation.CLAMP);
    return { transform: [{ rotate: `${deg}deg` }] };
  });

  const pivotStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pivotPulse.value * 0.15 + glow.value * 0.25 }],
    shadowOpacity: 0.3 + glow.value * 0.6,
  }));

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  const radius = size / 2;
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const t = i / (TICK_COUNT - 1);
    const deg = -90 + t * 180;
    const rad = (deg * Math.PI) / 180;
    const tickRadius = radius - 4;
    const x = radius + Math.sin(rad) * tickRadius;
    const y = radius - Math.cos(rad) * tickRadius;
    return { deg, x, y, active: t * 100 <= clamped + 3 };
  });

  return (
    <View style={styles.wrap}>
      <View style={[styles.arc, { width: size, height: radius + 6, borderColor: 'rgba(255,255,255,0.12)' }]}>
        {ticks.map((t, i) => (
          <View
            key={i}
            style={[
              styles.tick,
              {
                left: t.x - 1, top: Math.min(t.y, radius) - 3,
                backgroundColor: t.active ? color : 'rgba(255,255,255,0.15)',
                transform: [{ rotate: `${t.deg}deg` }],
              },
            ]}
          />
        ))}

        <Animated.View
          style={[
            styles.needle,
            needleStyle,
            { height: radius - 14, backgroundColor: color, left: radius - 1.5, bottom: 0 },
          ]}
        />
        <Animated.View style={[styles.pivot, pivotStyle, { left: radius - 5, backgroundColor: color, shadowColor: color }]} />
      </View>
      <Animated.Text style={[styles.value, { color }, valueStyle]}>{Math.round(clamped)}{unit ?? ''}</Animated.Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 2 },
  arc: {
    alignItems: 'center', justifyContent: 'flex-end', overflow: 'visible',
    position: 'relative',
  },
  tick: { position: 'absolute', width: 2, height: 6, borderRadius: 1 },
  needle: { position: 'absolute', width: 3, borderRadius: 2 },
  pivot: {
    position: 'absolute', bottom: -5, width: 10, height: 10, borderRadius: 5,
    shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, elevation: 4,
  },
  value: { fontSize: 15, fontWeight: '800', marginTop: 6 },
  label: { fontSize: 9, fontWeight: '700', color: '#8892B0', letterSpacing: 0.5, textTransform: 'uppercase' },
});
