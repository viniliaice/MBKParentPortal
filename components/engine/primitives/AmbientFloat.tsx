import React, { useEffect } from 'react';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** vertical bob distance in px */
  distance?: number;
  /** one full up-down cycle, ms */
  durationMs?: number;
  /** slight rotation wobble in degrees, 0 disables */
  rotationDeg?: number;
  /** stagger the phase so multiple ambient elements don't move in lockstep */
  delayMs?: number;
  active?: boolean;
}

/**
 * Wraps anything in a gentle perpetual float — the brief's "nothing should
 * feel static" applies to every idle element in a scene, not just the ones
 * being dragged. Fully generic: an icon, a gauge, a diagram part, a card
 * corner decoration can all be wrapped in this. Runs entirely on the UI
 * thread via worklets so wrapping many elements stays cheap.
 */
export default function AmbientFloat({ children, style, distance = 4, durationMs = 2400, rotationDeg = 0, delayMs = 0, active = true }: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      t.value = withTiming(0, { duration: 200 });
      return;
    }
    t.value = withSequence(
      withTiming(0, { duration: delayMs }),
      withRepeat(
        withTiming(1, { duration: durationMs / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    );
  }, [active, durationMs, delayMs]);

  const animStyle = useAnimatedStyle(() => {
    const translateY = -distance + t.value * distance * 2;
    const rotate = rotationDeg ? (-rotationDeg + t.value * rotationDeg * 2) : 0;
    return {
      transform: [
        { translateY },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return <Animated.View style={[style, animStyle]}>{children}</Animated.View>;
}
