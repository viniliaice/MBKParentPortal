import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, withRepeat, withSequence, Easing,
} from 'react-native-reanimated';
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
 *
 * Juice pass: the trigger button compresses on press-in and has a subtle
 * idle "invite" pulse before first use; each new caption slides/fades in
 * as its own event rather than the text silently swapping; the scene box
 * gets a soft glow ring the instant playback starts; completing for the
 * first time fires a full success glow + particle burst combo instead of
 * just enabling a button.
 */
export default function CauseEffectExplorer({ config, submitted, onComplete, accentColor, renderScene }: Props) {
  const duration = config.totalDurationMs ?? 2200;
  const progressShared = useSharedValue(0);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [burstTrigger, setBurstTrigger] = useState(0);

  const pressScale = useSharedValue(1);
  const invitePulse = useSharedValue(0);
  const sceneGlow = useSharedValue(0);

  useEffect(() => {
    if (hasPlayedOnce) {
      invitePulse.value = withTiming(0, { duration: 200 });
      return;
    }
    invitePulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }),
        withTiming(0, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, [hasPlayedOnce]);

  useEffect(() => {
    sceneGlow.value = withTiming(playing ? 1 : 0, { duration: 250 });
  }, [playing]);

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
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }, 16);
  };

  const handlePressIn = () => {
    if (playing) return;
    pressScale.value = withSpring(0.94, { damping: 14, stiffness: 400 });
  };
  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handleComplete = () => {
    if (submitted || !hasPlayedOnce) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  const currentStage = config.stages[stageIndex];

  const triggerBtnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * (1 + invitePulse.value * 0.04) }],
  }));

  const sceneGlowStyle = useAnimatedStyle(() => ({
    opacity: sceneGlow.value * 0.5,
    borderColor: accentColor,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.sceneBox}>
        <Animated.View style={[styles.sceneGlowRing, sceneGlowStyle]} pointerEvents="none" />
        {renderScene(progress, stageIndex)}
        <View style={styles.particleAnchor}>
          <ParticleBurst trigger={burstTrigger} color={accentColor} />
        </View>
      </View>

      {currentStage && (
        <StageCaption key={currentStage.id} text={currentStage.caption} accentColor={accentColor} />
      )}

      <Animated.View style={triggerBtnStyle}>
        <TouchableOpacity
          style={[styles.triggerBtn, { backgroundColor: accentColor, opacity: playing ? 0.75 : 1 }]}
          onPress={handleTrigger}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={playing}
          activeOpacity={1}
        >
          <Ionicons name={playing ? 'hourglass' : ((config.triggerIcon ?? 'play') as any)} size={18} color="#04222A" />
          <Text style={styles.triggerBtnText}>{hasPlayedOnce ? `Replay: ${config.triggerLabel}` : config.triggerLabel}</Text>
        </TouchableOpacity>
      </Animated.View>

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

function StageCaption({ text, accentColor }: { text: string; accentColor: string }) {
  const anim = useSharedValue(0);
  useEffect(() => {
    anim.value = 0;
    anim.value = withSpring(1, { damping: 14, stiffness: 160 });
  }, [text]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: (1 - anim.value) * 10 }, { scale: 0.97 + anim.value * 0.03 }],
  }));

  return (
    <Animated.View style={[styles.captionBox, style, { borderColor: `${accentColor}44` }]}>
      <Text style={styles.captionText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sceneBox: {
    minHeight: 180, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    padding: 16, position: 'relative', overflow: 'hidden',
  },
  sceneGlowRing: {
    ...StyleSheet.absoluteFillObject, borderRadius: 18, borderWidth: 2,
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
