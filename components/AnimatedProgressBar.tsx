import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';

interface Props {
  /** 0-100 */
  progress: number;
  color: string;
  height?: number;
  trackColor?: string;
  style?: ViewStyle;
  /** ms, default 450 */
  duration?: number;
}

/**
 * Progress bars across Learning previously snapped instantly to their new
 * width (plain View + template-string width). Animating the fill is the
 * cheapest "juice" win in the whole flow — it makes advancing a lesson,
 * finishing an activity, or gaining mastery feel like something happened
 * instead of teleporting.
 */
export default function AnimatedProgressBar({ progress, color, height = 6, trackColor = 'rgba(255,255,255,0.08)', style, duration = 450 }: Props) {
  const clamped = Math.max(0, Math.min(100, progress));
  const anim = useRef(new Animated.Value(clamped)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    Animated.timing(anim, { toValue: clamped, duration, useNativeDriver: false }).start();
  }, [clamped, duration, anim]);

  return (
    <View style={[{ height, backgroundColor: trackColor, borderRadius: height / 2, overflow: 'hidden' }, style]}>
      <Animated.View
        style={{
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'], extrapolate: 'clamp' }),
        }}
      />
    </View>
  );
}
