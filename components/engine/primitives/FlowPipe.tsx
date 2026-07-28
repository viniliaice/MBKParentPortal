import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate, Extrapolation } from 'react-native-reanimated';

interface Props {
  color: string;
  /** pipe orientation */
  horizontal?: boolean;
  /** length along the pipe's main axis, px */
  length: number;
  thickness?: number;
  active?: boolean;
  /** ms per pulse traveling the full length; slower = calmer flow, faster = more pressure */
  speedMs?: number;
  reverse?: boolean;
}

/**
 * A pipe segment with a light "pulse" traveling along it to sell the idea
 * of flowing water/pressure without needing per-frame particle sim — cheap,
 * reusable for any pipe/tube/vein in any future lesson (blood flow in
 * Biology, electricity in a circuit). Renders its own base pipe body so
 * scenes can drop this in directly instead of hand-building a pipe + a
 * separate flow indicator each time.
 */
export default function FlowPipe({ color, horizontal = true, length, thickness = 8, active = true, speedMs = 900, reverse = false }: Props) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: speedMs, easing: Easing.linear }), -1, false);
  }, [active, speedMs]);

  const pulseStyle = useAnimatedStyle(() => {
    const raw = reverse ? 1 - t.value : t.value;
    const pos = interpolate(raw, [0, 1], [-thickness * 2, length], Extrapolation.CLAMP);
    return horizontal
      ? { transform: [{ translateX: pos }], opacity: active ? 0.9 : 0 }
      : { transform: [{ translateY: pos }], opacity: active ? 0.9 : 0 };
  });

  return (
    <View
      style={[
        styles.pipe,
        horizontal
          ? { width: length, height: thickness, borderRadius: thickness / 2 }
          : { height: length, width: thickness, borderRadius: thickness / 2 },
        { backgroundColor: `${color}33`, borderColor: `${color}55` },
      ]}
    >
      <Animated.View
        style={[
          styles.pulse,
          pulseStyle,
          horizontal
            ? { width: thickness * 1.6, height: thickness }
            : { height: thickness * 1.6, width: thickness },
          { backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pipe: { overflow: 'hidden', borderWidth: 1.5, position: 'relative' },
  pulse: { position: 'absolute', borderRadius: 8, opacity: 0.9 },
});
