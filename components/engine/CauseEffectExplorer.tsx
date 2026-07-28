import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ParticleBurst from '@/components/engine/primitives/ParticleBurst';
import type { CauseEffectExplorerConfig } from '@/data/learningData';

interface Props {
  config: CauseEffectExplorerConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  /** resolved from config.sceneKey by the caller; receives 0-1 progress + current stage index */
  renderScene: (progress: number, stageIndex: number) => React.ReactNode;
}

/**
 * "Press a trigger, watch a chain of effects play out" activity — a
 * museum-style push-button demo. Built for "flush the toilet, watch the
 * siphon", equally usable for "drop the ball, watch the pendulum", "strike
 * the match, watch combustion", etc. The trigger can be pressed multiple
 * times (replay), and completion only requires having watched the full
 * sequence once — no drag precision required, unlike ParameterExperiment.
 */
export default function CauseEffectExplorer({ config, submitted, onComplete, accentColor, renderScene }: Props) {
  const duration = config.totalDurationMs ?? 2200;
  const progressShared = useSharedValue(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [burstTrigger, setBurstTrigger] = useState(0);

  const stageIndex = (() => {
    const elapsedMs = progress * duration;
    let idx = 0;
    config.stages.forEach((s, i) => { if (elapsedMs >= s.atMs) idx = i; });
    return idx;
  })();

  const handleTrigger = () => {
    if (playing) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPlaying(true);
    progressShared.value = 0;
    setProgress(0);

    // The shared value drives any Animated sub-parts renderScene wants on the
    // UI thread; the plain interval alongside it drives the JS-side
    // `progress` number, since scenes here are View-based (not Skia) and
    // need a JS render each frame to update non-worklet layout math.
    progressShared.value = withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) });

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      setProgress(t);
      if (t >= 1) {
        clearInterval(interval);
        setPlaying(false);
        setHasPlayedOnce(true);
        setBurstTrigger(n => n + 1);
      }
    }, 16);
  };

  const handleComplete = () => {
    if (submitted || !hasPlayedOnce) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  const currentStage = config.stages[stageIndex];

  return (
    <View style={styles.container}>
      <View style={styles.sceneBox}>
        {renderScene(progress, stageIndex)}
        <View style={styles.particleAnchor}>
          <ParticleBurst trigger={burstTrigger} color={accentColor} />
        </View>
      </View>

      {currentStage && (
        <View style={[styles.captionBox, { borderColor: `${accentColor}44` }]}>
          <Text style={styles.captionText}>{currentStage.caption}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.triggerBtn, { backgroundColor: accentColor, opacity: playing ? 0.7 : 1 }]}
        onPress={handleTrigger}
        disabled={playing}
        activeOpacity={0.85}
      >
        <Ionicons name={(config.triggerIcon ?? 'play') as any} size={18} color="#04222A" />
        <Text style={styles.triggerBtnText}>{hasPlayedOnce ? `Replay: ${config.triggerLabel}` : config.triggerLabel}</Text>
      </TouchableOpacity>

      {!submitted && (
        <TouchableOpacity
          style={[styles.completeBtn, !hasPlayedOnce && styles.completeBtnDisabled]}
          onPress={handleComplete}
          disabled={!hasPlayedOnce}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeBtnText, !hasPlayedOnce && styles.completeBtnTextDisabled]}>
            {hasPlayedOnce ? (config.completionLabel ?? 'Got it!') : 'Watch it happen first'}
          </Text>
          {hasPlayedOnce && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sceneBox: {
    minHeight: 180, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    padding: 16, position: 'relative', overflow: 'hidden',
  },
  particleAnchor: { position: 'absolute', top: '50%', left: '50%' },
  captionBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1, minHeight: 54,
  },
  captionText: { fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  triggerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  triggerBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(46,204,113,0.85)',
  },
  completeBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  completeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
