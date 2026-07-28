import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  direction?: 'up' | 'down' | 'left' | 'right';
  color: string;
  size?: number;
  /** loops a small bob in the pointing direction while true */
  active?: boolean;
}

/**
 * A small bobbing directional arrow used to draw the eye to flow direction
 * (water flowing down, heat moving out, lift pushing up). Shared across any
 * simulation/diagram that needs to indicate motion without a full particle
 * system.
 */
export default function AnimatedArrow({ direction = 'down', color, size = 20, active = true }: Props) {
  const offset = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      offset.value = withTiming(0, { duration: 150 });
      return;
    }
    offset.value = withRepeat(
      withSequence(
        withTiming(6, { duration: 450, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 450, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [active, offset]);

  const style = useAnimatedStyle(() => {
    const map: Record<string, { x: number; y: number }> = {
      up: { x: 0, y: -offset.value },
      down: { x: 0, y: offset.value },
      left: { x: -offset.value, y: 0 },
      right: { x: offset.value, y: 0 },
    };
    const t = map[direction];
    return { transform: [{ translateX: t.x }, { translateY: t.y }], opacity: active ? 1 : 0.25 };
  });

  const iconName = {
    up: 'arrow-up', down: 'arrow-down', left: 'arrow-back', right: 'arrow-forward',
  }[direction] as any;

  return (
    <Animated.View style={[styles.wrap, style]}>
      <Ionicons name={iconName} size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
