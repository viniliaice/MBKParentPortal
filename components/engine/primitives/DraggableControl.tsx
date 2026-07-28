import React from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  label: string;
  color: string;
  min?: number;
  max?: number;
  value?: number;
  unit?: string;
  onChange: (value: number) => void;
  /** fires once per crossed band, used for haptic "detents" while dragging */
  hapticStep?: number;
}

/**
 * Gesture-handler + Reanimated driven slider — the engine-layer counterpart
 * to components/explorables/DraggableSlider.tsx (which stays on the older
 * PanResponder API and keeps powering the existing 4 explorable scenes
 * untouched). New engine activities (ParameterExperiment, DragMechanism,
 * etc.) use this one so their drag interactions run on the UI thread via
 * worklets instead of bouncing through the JS thread on every touch move.
 */
export default function DraggableControl({
  label, color, min = 0, max = 100, value, unit, onChange, hapticStep = 10,
}: Props) {
  const trackWidth = useSharedValue(0);
  const progress = useSharedValue(value !== undefined ? (value - min) / (max - min) : 0);
  const lastHapticBand = useSharedValue(-1);
  const [displayValue, setDisplayValue] = React.useState(value ?? min);

  const reportChange = (p: number) => {
    const v = min + p * (max - min);
    setDisplayValue(v);
    onChange(v);
  };

  const fireHaptic = () => {
    Haptics.selectionAsync();
  };

  const pan = Gesture.Pan()
    .onBegin((e) => {
      'worklet';
      if (trackWidth.value <= 0) return;
      const p = Math.max(0, Math.min(1, e.x / trackWidth.value));
      progress.value = p;
      runOnJS(reportChange)(p);
    })
    .onUpdate((e) => {
      'worklet';
      if (trackWidth.value <= 0) return;
      const p = Math.max(0, Math.min(1, e.x / trackWidth.value));
      progress.value = p;
      runOnJS(reportChange)(p);
      const band = Math.floor(p * 100 / hapticStep);
      if (band !== lastHapticBand.value) {
        lastHapticBand.value = band;
        runOnJS(fireHaptic)();
      }
    })
    .onEnd(() => {
      'worklet';
      progress.value = withSpring(progress.value, { damping: 20, stiffness: 200 });
    });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * trackWidth.value - 14 }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.valueLabel, { color }]}>{Math.round(displayValue)}{unit ?? ''}</Text>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout}>
          <View style={styles.trackBg} />
          <Animated.View style={[styles.trackFill, fillStyle, { backgroundColor: color }]} />
          <Animated.View style={[styles.handle, handleStyle, { borderColor: color }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: '700', color: '#CCCCCC' },
  valueLabel: { fontSize: 13, fontWeight: '800' },
  track: { height: 44, justifyContent: 'center' },
  trackBg: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' },
  trackFill: { position: 'absolute', height: 8, borderRadius: 4 },
  handle: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#141D3A', borderWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
