import React, { useEffect } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, runOnJS, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { playSound } from '@/lib/audio/soundEngine';

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
  disabled?: boolean;
}

/**
 * Gesture-handler + Reanimated driven slider — the engine-layer counterpart
 * to components/explorables/DraggableSlider.tsx (which stays on the older
 * PanResponder API and keeps powering the existing 4 explorable scenes
 * untouched). New engine activities (ParameterExperiment, DragMechanism,
 * etc.) use this one so their drag interactions run on the UI thread via
 * worklets instead of bouncing through the JS thread on every touch move.
 *
 * Juice pass: the handle compresses and glows while actively held, gently
 * "breathes" when idle so it never reads as a static control waiting to be
 * noticed, and the numeric readout pops on every value change instead of
 * silently updating.
 */
export default function DraggableControl({
  label, color, min = 0, max = 100, value, unit, onChange, hapticStep = 10, disabled = false,
}: Props) {
  const trackWidth = useSharedValue(0);
  const progress = useSharedValue(value !== undefined ? (value - min) / (max - min) : 0);
  const lastHapticBand = useSharedValue(-1);
  const lastReportedValue = useSharedValue(Number.NaN);
  const pressScale = useSharedValue(1);
  const idleBreath = useSharedValue(0);
  const glow = useSharedValue(0);
  const valueScale = useSharedValue(1);
  const [displayValue, setDisplayValue] = React.useState(value ?? min);
  const [dragging, setDragging] = React.useState(false);

  useEffect(() => {
    idleBreath.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [idleBreath]);

  // Keep the native gesture position in sync when a parent resets a control.
  useEffect(() => {
    valueScale.value = withSpring(dragging ? 1.08 : 1, { damping: 10, stiffness: 300 });
  }, [dragging, valueScale]);

  useEffect(() => {
    const safeRange = max - min;
    const next = value ?? min;
    const nextProgress = safeRange > 0 ? Math.max(0, Math.min(1, (next - min) / safeRange)) : 0;
    progress.value = nextProgress;
    lastReportedValue.value = Math.round(next);
    setDisplayValue(next);
  }, [value, min, max, progress, lastReportedValue]);

  const reportChange = (valueToReport: number) => {
    setDisplayValue(valueToReport);
    onChange(valueToReport);
  };

  const fireHaptic = () => {
    Haptics.selectionAsync();
    // A tiny tick per crossed 10%-band — same cadence as the haptic detent
    // so touch and sound reinforce the same discrete "step" feeling
    // instead of firing on unrelated events.
    playSound('uiTick', 0.18);
  };

  const setDraggingJS = (v: boolean) => setDragging(v);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onBegin((e) => {
      'worklet';
      if (trackWidth.value <= 0) return;
      pressScale.value = withSpring(1.18, { damping: 10, stiffness: 300 });
      glow.value = withTiming(1, { duration: 150 });
      runOnJS(setDraggingJS)(true);
      const p = Math.max(0, Math.min(1, e.x / trackWidth.value));
      progress.value = p;
      const nextValue = min + p * (max - min);
      lastReportedValue.value = Math.round(nextValue);
      runOnJS(reportChange)(nextValue);
    })
    .onUpdate((e) => {
      'worklet';
      if (trackWidth.value <= 0) return;
      const p = Math.max(0, Math.min(1, e.x / trackWidth.value));
      progress.value = p;
      const nextValue = min + p * (max - min);
      // React only needs a new value when the displayed whole-number value
      // changes. This keeps a fast gesture on the UI thread instead of
      // scheduling hundreds of JS renders for sub-pixel motion.
      const roundedValue = Math.round(nextValue);
      if (roundedValue !== lastReportedValue.value) {
        lastReportedValue.value = roundedValue;
        runOnJS(reportChange)(nextValue);
      }
      const band = Math.floor(p * 100 / hapticStep);
      if (band !== lastHapticBand.value) {
        lastHapticBand.value = band;
        runOnJS(fireHaptic)();
      }
    })
    .onFinalize(() => {
      'worklet';
      progress.value = withSpring(progress.value, { damping: 20, stiffness: 200 });
      pressScale.value = withSpring(1, { damping: 12, stiffness: 260 });
      glow.value = withTiming(0, { duration: 300 });
      runOnJS(setDraggingJS)(false);
    });

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.value = e.nativeEvent.layout.width;
  };

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const fillGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + glow.value * 0.5,
  }));

  const handleStyle = useAnimatedStyle(() => {
    const breath = 1 + idleBreath.value * 0.06 * (1 - glow.value);
    return {
      transform: [
        { translateX: progress.value * trackWidth.value - 14 },
        { scale: pressScale.value * breath },
      ],
      shadowOpacity: 0.3 + glow.value * 0.4,
    };
  });

  const glowRingStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.6,
    transform: [{ scale: 1 + glow.value * 0.7 }],
  }));

  const valueStyle = useAnimatedStyle(() => ({
    transform: [{ scale: valueScale.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Animated.Text style={[styles.valueLabel, { color }, valueStyle]}>{Math.round(displayValue)}{unit ?? ''}</Animated.Text>
      </View>
      <GestureDetector gesture={pan}>
        <View
          style={styles.track}
          onLayout={onLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ min, max, now: Math.round(displayValue) }}
          accessibilityState={{ disabled }}
          accessibilityActions={disabled ? [] : [
            { name: 'increment', label: 'Increase' },
            { name: 'decrement', label: 'Decrease' },
          ]}
          onAccessibilityAction={(event) => {
            // Screen-reader increment/decrement can't drag the gesture
            // track directly, so it steps by 5% of the range and reports
            // through the same reportChange path a real drag would use —
            // keeping VoiceOver/TalkBack users able to actually operate
            // every sandbox variable, not just see its current value.
            const step = (max - min) * 0.05;
            const current = min + progress.value * (max - min);
            const next = event.nativeEvent.actionName === 'increment'
              ? Math.min(max, current + step)
              : Math.max(min, current - step);
            const p = (next - min) / (max - min);
            progress.value = p;
            setDisplayValue(next);
            onChange(next);
          }}
        >
          <View style={styles.trackBg} />
          <Animated.View style={[styles.trackFill, fillStyle, fillGlowStyle, { backgroundColor: color }]} />
          <Animated.View style={[styles.handleGlow, glowRingStyle, handleStyle, { backgroundColor: color }]} />
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
  handleGlow: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
  },
  handle: {
    position: 'absolute', width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#141D3A', borderWidth: 3,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
