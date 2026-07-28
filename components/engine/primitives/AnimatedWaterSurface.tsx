import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing, interpolate, Extrapolation,
} from 'react-native-reanimated';

interface Props {
  /** 0-100 fill level, animates smoothly to new values */
  level: number;
  color: string;
  /** container corner radius so the water clips to match its vessel */
  borderRadius?: number;
  /** 0-1, ambient wave motion intensity; turn up during active flow, down at rest */
  turbulence?: number;
  /** true while water is actively flowing in/out — speeds up the surface ripple and adds a swirl highlight */
  flowing?: boolean;
  style?: object;
}

/**
 * A reusable liquid-fill surface: animated height, a subtly moving surface
 * line (two overlapping "wave" bands drifting at different speeds so it
 * never looks perfectly still), and a rotating swirl highlight while
 * `flowing` is true. This replaces every scene's old flat-rectangle water
 * fill (`height: '${level}%'` snapping straight to a new value) — used by
 * the toilet bowl, the tank, and reusable for any future liquid-vessel
 * lesson (a beaker, an aquarium, a fuel tank).
 */
export default function AnimatedWaterSurface({ level, color, borderRadius = 0, turbulence = 0.4, flowing = false, style }: Props) {
  const heightPct = useSharedValue(level);
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const swirl = useSharedValue(0);

  useEffect(() => {
    heightPct.value = withTiming(level, { duration: 380, easing: Easing.out(Easing.cubic) });
  }, [level]);

  useEffect(() => {
    wave1.value = withRepeat(withTiming(1, { duration: flowing ? 900 : 2600, easing: Easing.linear }), -1, false);
    wave2.value = withRepeat(withTiming(1, { duration: flowing ? 1300 : 3400, easing: Easing.linear }), -1, false);
  }, [flowing]);

  useEffect(() => {
    if (flowing) {
      swirl.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.linear }), -1, false);
    } else {
      swirl.value = withTiming(0, { duration: 300 });
    }
  }, [flowing]);

  const bodyStyle = useAnimatedStyle(() => ({
    height: `${heightPct.value}%`,
  }));

  const wave1Style = useAnimatedStyle(() => {
    const x = interpolate(wave1.value, [0, 1], [0, -40], Extrapolation.CLAMP);
    return { transform: [{ translateX: x }] };
  });

  const wave2Style = useAnimatedStyle(() => {
    const x = interpolate(wave2.value, [0, 1], [-40, 0], Extrapolation.CLAMP);
    return { transform: [{ translateX: x }] };
  });

  const swirlStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swirl.value * 360}deg` }],
    opacity: flowing ? 0.5 * turbulence + 0.15 : 0,
  }));

  return (
    <Animated.View style={[styles.body, bodyStyle, { backgroundColor: `${color}CC`, borderRadius }, style]}>
      <View style={styles.surfaceClip}>
        <Animated.View style={[styles.waveBand, wave1Style, { backgroundColor: `${color}55` }]} />
        <Animated.View style={[styles.waveBand, styles.waveBandOffset, wave2Style, { backgroundColor: `${color}33` }]} />
      </View>
      <Animated.View style={[styles.swirl, swirlStyle, { borderColor: `#FFFFFF` }]} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  body: { width: '100%', overflow: 'hidden', position: 'relative' },
  surfaceClip: { position: 'absolute', top: 0, left: 0, right: 0, height: 10, overflow: 'hidden' },
  waveBand: { position: 'absolute', top: -3, left: -20, right: -20, height: 14, borderRadius: 10 },
  waveBandOffset: { top: 1 },
  swirl: {
    position: 'absolute', top: '20%', left: '30%', width: 26, height: 26, borderRadius: 13,
    borderWidth: 2, borderStyle: 'dashed',
  },
});
