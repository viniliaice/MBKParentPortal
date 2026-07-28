import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, withSequence, runOnJS, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { DragMechanismConfig } from '@/data/learningData';

interface Props {
  config: DragMechanismConfig;
  color: string;
  /** resolved from config.describeKey by the caller — given the 0-100 drag position, describe what's happening */
  describe: (position: number) => string;
  onPositionChange?: (position: number) => void;
  disabled?: boolean;
  trackWidth?: number;
}

/**
 * Generic "drag a mechanical part along a track and observe the effect"
 * interaction — built for the toilet float valve, but equally usable for a
 * thermostat dial, a chemistry burette stopcock, or an engineering lever.
 *
 * Juice pass: the knob compresses and glows on grab, has a light idle
 * "invite me" pulse before the first touch, snaps to the endpoints with a
 * satisfying overshoot spring (not a dead stop), fires haptic detents every
 * 10%, and pulses gold at full extension to sell "you found the limit."
 * The description text slides/fades in fresh each time it changes instead
 * of silently swapping.
 */
export default function DragMechanism({ config, color, describe, onPositionChange, disabled, trackWidth: trackWidthProp }: Props) {
  const trackWidth = trackWidthProp ?? 220;
  const knobSize = 46;
  const travel = trackWidth - knobSize;
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const grabGlow = useSharedValue(0);
  const idleInvite = useSharedValue(0);
  const [position, setPosition] = useState(0);
  const [everTouched, setEverTouched] = useState(false);
  const lastHapticBand = useRef(-1);

  useEffect(() => {
    if (everTouched) {
      idleInvite.value = withTiming(0, { duration: 200 });
      return;
    }
    idleInvite.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 550, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 550, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 900 }),
      ),
      -1,
      false,
    );
  }, [everTouched]);

  const markTouched = () => setEverTouched(true);

  const report = (p: number) => {
    setPosition(p);
    onPositionChange?.(p);
    const band = Math.round(p / 10);
    if (band !== lastHapticBand.current) {
      lastHapticBand.current = band;
      Haptics.selectionAsync();
    }
    if (p >= 99 || p <= 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      startX.value = x.value;
      pressScale.value = withSpring(1.15, { damping: 9, stiffness: 280 });
      grabGlow.value = withTiming(1, { duration: 150 });
      runOnJS(markTouched)();
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(0, Math.min(travel, startX.value + e.translationX));
      x.value = next;
      const pct = travel > 0 ? (next / travel) * 100 : 0;
      runOnJS(report)(pct);
    })
    .onFinalize(() => {
      'worklet';
      x.value = withSpring(x.value, { damping: 14, stiffness: 240, mass: 0.8 });
      pressScale.value = withSpring(1, { damping: 10, stiffness: 260 });
      grabGlow.value = withTiming(0, { duration: 250 });
    });

  const knobStyle = useAnimatedStyle(() => {
    const invite = idleInvite.value * 8;
    return {
      transform: [{ translateX: x.value + invite }, { scale: pressScale.value }],
      shadowOpacity: 0.35 + grabGlow.value * 0.45,
    };
  });

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: grabGlow.value * 0.55,
    transform: [{ translateX: x.value }, { scale: 1 + grabGlow.value * 0.6 }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + knobSize / 2,
  }));

  const isAtLimit = position >= 98 || position <= 2;
  const limitGlowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isAtLimit ? 0.5 : 0, { duration: 200 }),
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{config.title}</Text>
      <View style={[styles.track, { width: trackWidth }]}>
        <View style={styles.trackBg} />
        <Animated.View style={[styles.trackFill, fillStyle, { backgroundColor: `${color}55` }]} />
        <Animated.View style={[styles.trackLimitGlow, limitGlowStyle, { backgroundColor: color, left: position <= 2 ? 0 : undefined, right: position >= 98 ? 0 : undefined }]} />
        <GestureDetector gesture={pan}>
          <View style={styles.knobHitbox}>
            <Animated.View style={[styles.knobGlow, glowRingStyle, { backgroundColor: color, width: knobSize, height: knobSize, borderRadius: knobSize / 2 }]} />
            <Animated.View style={[styles.knob, knobStyle, { borderColor: color, width: knobSize, height: knobSize, borderRadius: knobSize / 2 }]}>
              <Ionicons name={config.partIcon as any} size={20} color={color} />
            </Animated.View>
          </View>
        </GestureDetector>
      </View>
      <View style={styles.endLabelsRow}>
        <Text style={styles.endLabel}>{config.minLabel}</Text>
        <Text style={styles.endLabel}>{config.maxLabel}</Text>
      </View>
      <DescribeText key={describe(position)} text={describe(position)} color={color} />
    </View>
  );
}

function DescribeText({ text, color }: { text: string; color: string }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = 0;
    anim.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
  }, [text]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: (1 - anim.value) * 6 }],
  }));

  return (
    <Animated.Text style={[styles.describeText, { color }, style]}>{text}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, width: '100%' },
  title: { fontSize: 12, fontWeight: '700', color: '#8892B0', letterSpacing: 0.5, textTransform: 'uppercase' },
  track: { height: 46, justifyContent: 'center' },
  trackBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', position: 'absolute', left: 0, right: 0 },
  trackFill: { height: 8, borderRadius: 4, position: 'absolute', left: 0 },
  trackLimitGlow: { position: 'absolute', top: -4, width: 16, height: 16, borderRadius: 8 },
  knobHitbox: { width: '100%', height: 46, justifyContent: 'center' },
  knobGlow: { position: 'absolute' },
  knob: {
    position: 'absolute', borderWidth: 2.5, backgroundColor: '#141D3A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  endLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  endLabel: { fontSize: 10, color: '#4A5080', fontWeight: '600' },
  describeText: { fontSize: 13, fontWeight: '600', textAlign: 'center', minHeight: 34 },
});
