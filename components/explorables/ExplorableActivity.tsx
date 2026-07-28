import React, { useState, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import DraggableSlider from '@/components/explorables/DraggableSlider';
import ToiletScene from '@/components/explorables/scenes/ToiletScene';
import WaterTowerScene from '@/components/explorables/scenes/WaterTowerScene';
import FridgeScene from '@/components/explorables/scenes/FridgeScene';
import HelicopterScene from '@/components/explorables/scenes/HelicopterScene';
import ContaminationScene from '@/components/explorables/scenes/ContaminationScene';
import type { Activity, ExplorableThreshold } from '@/data/learningData';

interface Props {
  activity: Activity;
  submitted: boolean;
  onSubmit: (correct: boolean) => void;
}

const SCENE_COMPONENTS: Record<string, React.ComponentType<{ value: number; color: string }>> = {
  toilet: ToiletScene,
  waterTower: WaterTowerScene,
  fridge: FridgeScene,
  helicopter: HelicopterScene,
  contamination: ContaminationScene,
};

const EXPLORABLE_COLOR = '#22D3EE';

function activeThreshold(value: number, thresholds: ExplorableThreshold[]): ExplorableThreshold {
  let current = thresholds[0];
  for (const t of thresholds) {
    if (value >= t.at) current = t;
  }
  return current;
}

/**
 * Brilliant.org's signature format: drag a variable, watch a live diagram
 * react, read a short explanation that updates as you cross thresholds —
 * there's no single "correct" tap, the exploration itself is the activity.
 * Reuses the existing activity contract (onCorrect/onIncorrect via onSubmit)
 * so it drops into the same lesson flow as every other activity type
 * without touching app/lesson/[id].tsx's state machine.
 */
export default function ExplorableActivity({ activity, submitted, onSubmit }: Props) {
  const config = activity.explorableConfig;
  const [value, setValue] = useState(0);
  const [maxReached, setMaxReached] = useState(0);
  const calloutAnim = useRef(new Animated.Value(1)).current;
  const lastMessageRef = useRef<string | null>(null);

  if (!config) return null;

  const SceneComponent = SCENE_COMPONENTS[config.scene];
  const threshold = activeThreshold(value, config.thresholds);
  const completionThreshold = config.completionThreshold ?? 85;
  const hasExploredEnough = maxReached >= completionThreshold;

  const handleChange = (v: number) => {
    setValue(v);
    if (v > maxReached) setMaxReached(v);
  };

  // Re-play a tiny pop animation whenever the callout message text changes,
  // so new information reads as "new" instead of the text silently swapping.
  if (threshold.message !== lastMessageRef.current) {
    lastMessageRef.current = threshold.message;
    calloutAnim.setValue(0.6);
    Animated.spring(calloutAnim, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }

  const handleGotIt = () => {
    if (submitted) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.sceneBox}>
        {SceneComponent ? <SceneComponent value={value} color={EXPLORABLE_COLOR} /> : null}
      </View>

      <Animated.View
        style={[
          styles.callout,
          { opacity: calloutAnim, transform: [{ scale: calloutAnim.interpolate({ inputRange: [0.6, 1], outputRange: [0.96, 1] }) }] },
        ]}
      >
        <Ionicons name="bulb" size={16} color={EXPLORABLE_COLOR} />
        <Text style={styles.calloutText}>{threshold.message}</Text>
      </Animated.View>

      <DraggableSlider
        label={config.sliderLabel}
        color={EXPLORABLE_COLOR}
        onChange={handleChange}
      />

      <View style={styles.exploreProgressRow}>
        <View style={styles.exploreProgressTrack}>
          <View
            style={[
              styles.exploreProgressFill,
              { width: `${Math.min(100, (maxReached / completionThreshold) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.exploreProgressLabel}>
          {hasExploredEnough ? 'Fully explored' : 'Keep dragging to explore more'}
        </Text>
      </View>

      {!submitted && (
        <TouchableOpacity
          style={[styles.gotItBtn, !hasExploredEnough && styles.gotItBtnDisabled]}
          onPress={handleGotIt}
          disabled={!hasExploredEnough}
          activeOpacity={0.85}
        >
          <Text style={[styles.gotItText, !hasExploredEnough && styles.gotItTextDisabled]}>
            {hasExploredEnough ? 'Got it!' : `Explore ${completionThreshold}%+ to continue`}
          </Text>
          {hasExploredEnough && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sceneBox: {
    minHeight: 170, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.15)', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  callout: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(34,211,238,0.08)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(34,211,238,0.25)',
  },
  calloutText: { flex: 1, fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  exploreProgressRow: { gap: 6 },
  exploreProgressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  exploreProgressFill: { height: 4, borderRadius: 2, backgroundColor: EXPLORABLE_COLOR },
  exploreProgressLabel: { fontSize: 11, color: '#8892B0' },
  gotItBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: EXPLORABLE_COLOR, paddingVertical: 14, borderRadius: 14,
  },
  gotItBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  gotItText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  gotItTextDisabled: { color: '#4A5080' },
});
