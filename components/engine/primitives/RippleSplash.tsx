import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing, runOnJS } from 'react-native-reanimated';

interface Props {
  /** increment to fire a new ripple/splash burst */
  trigger: number;
  color: string;
  size?: number;
  rings?: number;
}

/**
 * Concentric expanding-and-fading rings — a water splash / impact effect.
 * Generic enough for a droplet hitting a surface, a ripple from a dropped
 * object, or a sonar-style "ping" in any future lesson. Positioned by the
 * parent (absolute-fill a container and this centers itself).
 */
export default function RippleSplash({ trigger, color, size = 70, rings = 3 }: Props) {
  return (
    <View style={styles.root} pointerEvents="none">
      {Array.from({ length: rings }, (_, i) => (
        <Ring key={i} trigger={trigger} color={color} size={size} delay={i * 120} />
      ))}
    </View>
  );
}

function Ring({ trigger, color, size, delay }: { trigger: number; color: string; size: number; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger <= 0) return;
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }));
  }, [trigger]);

  const style = useAnimatedStyle(() => ({
    width: size * (0.2 + progress.value * 0.8),
    height: (size * (0.2 + progress.value * 0.8)) * 0.4,
    borderRadius: 999,
    opacity: 1 - progress.value,
    marginLeft: -(size * (0.2 + progress.value * 0.8)) / 2,
    marginTop: -((size * (0.2 + progress.value * 0.8)) * 0.4) / 2,
  }));

  return <Animated.View style={[styles.ring, { borderColor: color }, style]} />;
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  ring: { position: 'absolute', borderWidth: 2 },
});
