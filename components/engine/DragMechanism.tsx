import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
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
 * The part springs slightly on release for a physical, weighted feel
 * instead of just stopping dead where the finger lifted.
 */
export default function DragMechanism({ config, color, describe, onPositionChange, disabled, trackWidth: trackWidthProp }: Props) {
  const trackWidth = trackWidthProp ?? 220;
  const knobSize = 44;
  const travel = trackWidth - knobSize;
  const x = useSharedValue(0);
  const startX = useSharedValue(0);
  const [position, setPosition] = useState(0);

  const report = (p: number) => {
    setPosition(p);
    onPositionChange?.(p);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin(() => {
      'worklet';
      startX.value = x.value;
    })
    .onUpdate((e) => {
      'worklet';
      const next = Math.max(0, Math.min(travel, startX.value + e.translationX));
      x.value = next;
      const pct = travel > 0 ? (next / travel) * 100 : 0;
      runOnJS(report)(pct);
    })
    .onEnd(() => {
      'worklet';
      x.value = withSpring(x.value, { damping: 22, stiffness: 220 });
    });

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: x.value + knobSize / 2,
  }));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{config.title}</Text>
      <View style={[styles.track, { width: trackWidth }]}>
        <View style={styles.trackBg} />
        <Animated.View style={[styles.trackFill, fillStyle, { backgroundColor: `${color}55` }]} />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.knob, knobStyle, { borderColor: color, width: knobSize, height: knobSize, borderRadius: knobSize / 2 }]}>
            <Ionicons name={config.partIcon as any} size={20} color={color} />
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.endLabelsRow}>
        <Text style={styles.endLabel}>{config.minLabel}</Text>
        <Text style={styles.endLabel}>{config.maxLabel}</Text>
      </View>
      <Text style={[styles.describeText, { color }]}>{describe(position)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, width: '100%' },
  title: { fontSize: 12, fontWeight: '700', color: '#8892B0', letterSpacing: 0.5, textTransform: 'uppercase' },
  track: { height: 44, justifyContent: 'center' },
  trackBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)', position: 'absolute', left: 0, right: 0 },
  trackFill: { height: 8, borderRadius: 4, position: 'absolute', left: 0 },
  knob: {
    position: 'absolute', borderWidth: 2.5, backgroundColor: '#141D3A',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 5,
  },
  endLabelsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  endLabel: { fontSize: 10, color: '#4A5080', fontWeight: '600' },
  describeText: { fontSize: 13, fontWeight: '600', textAlign: 'center', minHeight: 34 },
});
