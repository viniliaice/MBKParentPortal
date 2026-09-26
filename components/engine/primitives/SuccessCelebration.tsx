import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, withDelay, Easing,
} from 'react-native-reanimated';

interface Props {
  /** increment to fire a new celebration */
  trigger: number;
  color?: string;
  size?: number;
}

const SPARKLE_COUNT = 6;

/**
 * A checkmark that pops in with a spring + a small ring of sparkles firing
 * outward + a soft glow pulse behind it — the shared "you got it" moment
 * used anywhere a correct answer or completed interaction needs to feel
 * like a small win instead of a color change. Generic across all activity
 * types and future subjects.
 */
export default function SuccessCelebration({ trigger, color = '#2ECC71', size = 22 }: Props) {
  const checkScale = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (trigger <= 0) return;
    checkScale.value = 0;
    checkScale.value = withSequence(
      withSpring(1.3, { damping: 8, stiffness: 260 }),
      withSpring(1, { damping: 10, stiffness: 260 }),
    );
    glow.value = 0;
    glow.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0, { duration: 500 }));
  }, [trigger]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.6,
    transform: [{ scale: 1 + glow.value * 1.2 }],
  }));

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      <Animated.View style={[styles.glow, glowStyle, { backgroundColor: color, width: size, height: size, borderRadius: size / 2 }]} />
      <Animated.View style={checkStyle}>
        <Ionicons name="checkmark-circle" size={size} color={color} />
      </Animated.View>
      {Array.from({ length: SPARKLE_COUNT }, (_, i) => (
        <Sparkle key={i} index={i} trigger={trigger} color={color} />
      ))}
    </View>
  );
}

function Sparkle({ index, trigger, color }: { index: number; trigger: number; color: string }) {
  const t = useSharedValue(0);
  const angle = (index / SPARKLE_COUNT) * Math.PI * 2;

  useEffect(() => {
    if (trigger <= 0) return;
    t.value = 0;
    t.value = withDelay(index * 20, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, [trigger]);

  const style = useAnimatedStyle(() => {
    const dist = 18 + t.value * 14;
    return {
      opacity: t.value <= 0 ? 0 : (1 - t.value),
      transform: [
        { translateX: Math.cos(angle) * dist },
        { translateY: Math.sin(angle) * dist },
        { scale: 1 - t.value * 0.5 },
      ],
    };
  });

  return <Animated.View style={[styles.sparkle, style, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute' },
  sparkle: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});
