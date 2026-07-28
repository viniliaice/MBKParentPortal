import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ParticleBurst from '@/components/engine/primitives/ParticleBurst';
import SceneCamera from '@/components/engine/primitives/SceneCamera';
import type { CauseEffectExplorerConfig } from '@/data/learningData';

interface Props {
  config: CauseEffectExplorerConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  /** resolved from config.sceneKey by the caller; receives 0-100 scene progress */
  renderScene: (sceneProgress: number) => React.ReactNode;
}

const SPEEDS = [0.5, 1, 2] as const;
const VIEWPORT_SIZE = 260;

/**
 * A guided, camera-directed, multi-stage simulation with real playback
 * controls (Play/Pause/Restart/Step Back/Step Forward/speed) — the "museum
 * exhibit" interaction: the student advances one named stage at a time,
 * each stage transitions the underlying scene value slowly with a
 * cinematic camera move synced to it, and playback ALWAYS stops at the end
 * of a stage so the caption can be read before continuing. Nothing
 * auto-advances through multiple stages unattended.
 *
 * Two indices are tracked deliberately: `activeIndex` updates the instant a
 * transition begins (so the camera pans to the new stage's shot *during*
 * the animation, not after it), while `settledIndex` only updates once that
 * transition finishes (gating the caption reveal and stage-tracker "done"
 * marks) — this is what makes the camera feel like it's directing the
 * student's attention rather than just following a finished state.
 *
 * Generic across subjects: `config.stages` describes an ordered sequence of
 * (scene value, camera shot, caption) triples, so a future Biology cell
 * division or Chemistry titration lesson reuses this exact component.
 */
export default function CauseEffectExplorer({ config, submitted, onComplete, accentColor, renderScene }: Props) {
  const stages = config.stages;

  const [activeIndex, setActiveIndex] = useState(0);
  const [settledIndex, setSettledIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<typeof SPEEDS[number]>(1);
  const [sceneProgress, setSceneProgress] = useState(() => stages[0]?.toValue ?? 0);
  const [furthestReached, setFurthestReached] = useState(0);
  const [burstTrigger, setBurstTrigger] = useState(0);

  const sceneShared = useSharedValue(stages[0]?.toValue ?? 0);
  const cancelRef = useRef<() => void>(() => {});

  const activeStage = stages[activeIndex];
  const settledStage = stages[settledIndex];
  const isFirstStage = settledIndex === 0;
  const isLastStage = settledIndex === stages.length - 1;
  const hasCompletedOnce = furthestReached >= stages.length - 1;

  const runTransition = (toIdx: number) => {
    cancelRef.current();
    const stage = stages[toIdx];
    const from = stages[toIdx - 1]?.toValue ?? 0;
    const duration = Math.max(120, stage.durationMs / speed);

    setActiveIndex(toIdx);
    setPlaying(true);
    sceneShared.value = from;
    setSceneProgress(from);

    sceneShared.value = withTiming(stage.toValue, { duration, easing: Easing.inOut(Easing.cubic) });

    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      setSceneProgress(from + (stage.toValue - from) * t);
      if (t >= 1) {
        clearInterval(interval);
        setPlaying(false);
        setSettledIndex(toIdx);
        setFurthestReached(f => Math.max(f, toIdx));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (toIdx === stages.length - 1) {
          setBurstTrigger(n => n + 1);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    }, 16);

    cancelRef.current = () => {
      clearInterval(interval);
      setPlaying(false);
    };
  };

  const handlePlayPause = () => {
    if (playing) {
      cancelRef.current();
      // Snap to the settled stage since a paused mid-transition can't be
      // resumed cleanly from an arbitrary point — a second press replays
      // the stage from its start, which is more predictable for a learner.
      setActiveIndex(settledIndex);
      sceneShared.value = withTiming(settledStage?.toValue ?? 0, { duration: 200 });
      setSceneProgress(settledStage?.toValue ?? 0);
      return;
    }
    if (isLastStage) return;
    runTransition(settledIndex + 1);
  };

  const handleStepForward = () => {
    if (playing || isLastStage) return;
    runTransition(settledIndex + 1);
  };

  const handleStepBack = () => {
    if (playing || isFirstStage) return;
    cancelRef.current();
    const prevIdx = settledIndex - 1;
    const targetValue = stages[prevIdx]?.toValue ?? 0;
    setActiveIndex(prevIdx);
    setSettledIndex(prevIdx);
    sceneShared.value = withTiming(targetValue, { duration: 320, easing: Easing.inOut(Easing.cubic) });
    setSceneProgress(targetValue);
    Haptics.selectionAsync();
  };

  const handleRestart = () => {
    cancelRef.current();
    setPlaying(false);
    setActiveIndex(0);
    setSettledIndex(0);
    const restValue = stages[0]?.toValue ?? 0;
    sceneShared.value = withTiming(restValue, { duration: 320 });
    setSceneProgress(restValue);
    Haptics.selectionAsync();
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(speed);
    setSpeed(SPEEDS[(idx + 1) % SPEEDS.length]);
    Haptics.selectionAsync();
  };

  const handleComplete = () => {
    if (submitted || !hasCompletedOnce) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  useEffect(() => () => cancelRef.current(), []);

  const camera = activeStage?.camera ?? { scale: 1, focusX: 50, focusY: 50 };

  return (
    <View style={styles.container}>
      <View style={styles.sceneOuter}>
        <SceneCamera
          sceneWidth={config.sceneWidth}
          sceneHeight={config.sceneHeight}
          viewportWidth={VIEWPORT_SIZE}
          viewportHeight={VIEWPORT_SIZE}
          shot={camera}
          durationMs={Math.max(400, (activeStage?.durationMs ?? 900) / speed)}
        >
          {renderScene(sceneProgress)}
        </SceneCamera>
        <View style={styles.particleAnchor}>
          <ParticleBurst trigger={burstTrigger} color={accentColor} />
        </View>
      </View>

      <StageTracker stages={stages} activeIndex={activeIndex} furthestReached={furthestReached} accentColor={accentColor} />

      {!playing && settledStage && (
        <StageCaption key={settledStage.id} title={settledStage.title} text={settledStage.caption} accentColor={accentColor} />
      )}
      {playing && (
        <View style={styles.captionBoxPlaying}>
          <Ionicons name="eye" size={14} color="#8892B0" />
          <Text style={styles.captionPlayingText}>Watch closely…</Text>
        </View>
      )}

      <PlaybackControls
        playing={playing}
        speed={speed}
        canStepBack={!playing && !isFirstStage}
        canStepForward={!playing && !isLastStage}
        canPlay={!isLastStage}
        accentColor={accentColor}
        onPlayPause={handlePlayPause}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onRestart={handleRestart}
        onCycleSpeed={cycleSpeed}
      />

      {!submitted && (
        <TouchableOpacity
          style={[styles.completeBtn, !hasCompletedOnce && styles.completeBtnDisabled]}
          onPress={handleComplete}
          disabled={!hasCompletedOnce}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeBtnText, !hasCompletedOnce && styles.completeBtnTextDisabled]}>
            {hasCompletedOnce ? (config.completionLabel ?? 'Got it!') : 'Step through every stage first'}
          </Text>
          {hasCompletedOnce && <Ionicons name="checkmark" size={18} color="#FFFFFF" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

function StageTracker({ stages, activeIndex, furthestReached, accentColor }: {
  stages: { id: string; title: string }[]; activeIndex: number; furthestReached: number; accentColor: string;
}) {
  return (
    <View style={styles.trackerRow}>
      {stages.map((s, i) => {
        const state = i === activeIndex ? 'active' : i <= furthestReached ? 'done' : 'upcoming';
        return (
          <View
            key={s.id}
            style={[
              styles.trackerDot,
              state === 'active' && { backgroundColor: accentColor, width: 20 },
              state === 'done' && { backgroundColor: accentColor, opacity: 0.5 },
            ]}
          />
        );
      })}
    </View>
  );
}

function StageCaption({ title, text, accentColor }: { title: string; text: string; accentColor: string }) {
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
      <Text style={[styles.captionTitle, { color: accentColor }]}>{title}</Text>
      <Text style={styles.captionText}>{text}</Text>
    </Animated.View>
  );
}

function PlaybackControls({
  playing, speed, canStepBack, canStepForward, canPlay, accentColor,
  onPlayPause, onStepBack, onStepForward, onRestart, onCycleSpeed,
}: {
  playing: boolean; speed: number; canStepBack: boolean; canStepForward: boolean; canPlay: boolean; accentColor: string;
  onPlayPause: () => void; onStepBack: () => void; onStepForward: () => void; onRestart: () => void; onCycleSpeed: () => void;
}) {
  return (
    <View style={styles.controlsRow}>
      <ControlButton icon="refresh" onPress={onRestart} label="Restart" />
      <ControlButton icon="play-skip-back" onPress={onStepBack} disabled={!canStepBack} label="Step back" />
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: accentColor, opacity: canPlay || playing ? 1 : 0.4 }]}
        onPress={onPlayPause}
        disabled={!canPlay && !playing}
        activeOpacity={0.85}
        accessibilityLabel={playing ? 'Pause' : 'Play'}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={22} color="#04222A" />
      </TouchableOpacity>
      <ControlButton icon="play-skip-forward" onPress={onStepForward} disabled={!canStepForward} label="Step forward" />
      <TouchableOpacity style={styles.speedBtn} onPress={onCycleSpeed} activeOpacity={0.75} accessibilityLabel="Change speed">
        <Text style={styles.speedBtnText}>{speed}x</Text>
      </TouchableOpacity>
    </View>
  );
}

function ControlButton({ icon, onPress, disabled, label }: { icon: string; onPress: () => void; disabled?: boolean; label: string }) {
  return (
    <TouchableOpacity
      style={[styles.controlBtn, disabled && styles.controlBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      accessibilityLabel={label}
    >
      <Ionicons name={icon as any} size={18} color={disabled ? '#4A5080' : '#CCCCCC'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  sceneOuter: {
    borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', alignSelf: 'center', position: 'relative',
  },
  particleAnchor: { position: 'absolute', top: '50%', left: '50%' },
  trackerRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  trackerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  captionBox: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1, minHeight: 70, gap: 4,
  },
  captionBoxPlaying: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 14, padding: 14, minHeight: 70,
  },
  captionPlayingText: { fontSize: 13, color: '#8892B0', fontStyle: 'italic' },
  captionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  captionText: { fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  controlBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  controlBtnDisabled: { opacity: 0.35 },
  playBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  speedBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  speedBtnText: { fontSize: 12, fontWeight: '800', color: '#CCCCCC' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14, backgroundColor: 'rgba(46,204,113,0.85)',
  },
  completeBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  completeBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
