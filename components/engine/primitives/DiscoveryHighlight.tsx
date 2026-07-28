import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSpring, Easing } from 'react-native-reanimated';

interface Props {
  color: string;
  size?: number;
  active?: boolean;
  children?: React.ReactNode;
}

/**
 * A soft pulsing glow ring wrapped around whatever part of a scene just
 * became the focus of a "discovery" moment (per the brief: "zoom into the
 * relevant area, highlight it, pulse important components"). Generic
 * spotlight primitive — not tied to toilets or any diagram shape.
 */
export function DiscoveryHighlight({ color, size = 60, active = true, children }: Props) {
  const pulse = useSharedValue(0);
  const scale = useSharedValue(active ? 1 : 0.9);

  useEffect(() => {
    scale.value = withSpring(active ? 1 : 0.9, { damping: 12, stiffness: 180 });
    if (active) {
      pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), -1, false);
    }
  }, [active]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: active ? 0.5 * (1 - pulse.value) : 0,
    transform: [{ scale: 1 + pulse.value * 0.4 }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View style={[styles.ring, ringStyle, { borderColor: color, width: size, height: size, borderRadius: size / 2 }]} />
      <Animated.View style={[styles.content, contentStyle]}>{children}</Animated.View>
    </View>
  );
}

interface LabelProps {
  text: string;
  color: string;
  visible: boolean;
}

/**
 * A small floating callout label that pops in with a spring and gently
 * bobs — used to name a part the instant it becomes relevant, instead of a
 * static caption block. Reusable anywhere a diagram needs to label a live
 * element.
 */
export function FloatingLabel({ text, color, visible }: LabelProps) {
  const anim = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    anim.value = withSpring(visible ? 1 : 0, { damping: 11, stiffness: 160 });
  }, [visible]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ scale: 0.7 + anim.value * 0.3 }, { translateY: (1 - anim.value) * 8 }],
  }));

  return (
    <Animated.View style={[styles.label, style, { borderColor: `${color}66`, backgroundColor: `${color}22` }]} pointerEvents="none">
      <Text style={[styles.labelText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', borderWidth: 2 },
  content: { alignItems: 'center', justifyContent: 'center' },
  label: {
    position: 'absolute', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1,
  },
  labelText: { fontSize: 10, fontWeight: '800' },
});
