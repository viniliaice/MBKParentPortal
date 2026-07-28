import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing, type SharedValue } from 'react-native-reanimated';

interface Props {
  /** increment to fire a new spray */
  trigger: number;
  color: string;
  count?: number;
  /** launch direction bias in degrees, 0 = straight up, 90 = right */
  directionDeg?: number;
  spreadDeg?: number;
}

interface Droplet {
  angle: number;
  speed: number;
  delay: number;
  size: number;
}

/**
 * Droplets launched with a simple parabolic arc (gravity pulls them back
 * down) — used for the flush splash, and reusable for any liquid-impact
 * moment (a leak spraying, a fountain, a spilled beaker in a future
 * Chemistry lesson). Distinct from ParticleBurst (celebration confetti,
 * radial and symmetric) — this one is directional and has gravity, reading
 * as water rather than confetti.
 */
export default function WaterDroplets({ trigger, color, count = 8, directionDeg = 0, spreadDeg = 70 }: Props) {
  const progress = useSharedValue(0);

  const droplets = useMemo<Droplet[]>(
    () => Array.from({ length: count }, () => ({
      angle: directionDeg + (Math.random() - 0.5) * spreadDeg,
      speed: 30 + Math.random() * 26,
      delay: Math.random() * 80,
      size: 3 + Math.random() * 3,
    })),
    [count, directionDeg, spreadDeg],
  );

  useEffect(() => {
    if (trigger <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) });
  }, [trigger]);

  return (
    <View style={styles.root} pointerEvents="none">
      {droplets.map((d, i) => (
        <Droplet key={i} droplet={d} progress={progress} color={color} />
      ))}
    </View>
  );
}

function Droplet({ droplet, progress, color }: { droplet: Droplet; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value * 1000 - droplet.delay) / 420));
    const rad = (droplet.angle * Math.PI) / 180;
    const x = Math.sin(rad) * droplet.speed * t;
    // gravity arc: rises then falls, biased upward at launch
    const y = -droplet.speed * 1.1 * t + 60 * t * t;
    return {
      opacity: t <= 0 ? 0 : 1 - t * 0.9,
      transform: [{ translateX: x }, { translateY: y }],
    };
  });

  return <Animated.View style={[styles.droplet, { width: droplet.size, height: droplet.size * 1.4, backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  droplet: { position: 'absolute', borderRadius: 6, marginLeft: -2, marginTop: -2 },
});
