import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing, runOnJS, type SharedValue,
} from 'react-native-reanimated';

interface Props {
  /** increment this to fire a new burst (e.g. on each correct answer / challenge complete) */
  trigger: number;
  color: string;
  count?: number;
  onDone?: () => void;
}

interface Particle {
  angle: number;
  distance: number;
  delay: number;
}

/**
 * Lightweight celebratory particle burst for micro-wins inside a lesson
 * (completing a repair, hitting a target reading) — distinct from the
 * full-screen CelebrationOverlay which fires once per whole lesson. Built
 * on Reanimated shared values so it stays on the UI thread; no external
 * particle library needed for a ~10-dot burst.
 */
export default function ParticleBurst({ trigger, color, count = 10, onDone }: Props) {
  const progress = useSharedValue(0);
  const particles = useMemo<Particle[]>(
    () => Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2,
      distance: 40 + Math.random() * 24,
      delay: Math.random() * 60,
    })),
    [count],
  );

  useEffect(() => {
    if (trigger <= 0) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished && onDone) runOnJS(onDone)();
    });
  }, [trigger]);

  return (
    <View style={styles.root} pointerEvents="none">
      {particles.map((p, i) => (
        <Dot key={i} particle={p} progress={progress} color={color} />
      ))}
    </View>
  );
}

function Dot({ particle, progress, color }: { particle: Particle; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (progress.value * 1000 - particle.delay) / 500));
    const eased = t * (2 - t); // ease-out quad, cheap inline
    const x = Math.cos(particle.angle) * particle.distance * eased;
    const y = Math.sin(particle.angle) * particle.distance * eased;
    return {
      opacity: t <= 0 ? 0 : 1 - t,
      transform: [{ translateX: x }, { translateY: y }, { scale: 1 - t * 0.4 }],
    };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 },
});
