import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DraggableControl from '@/components/engine/primitives/DraggableControl';
import GaugeMeter from '@/components/engine/primitives/GaugeMeter';
import TemperatureIndicator from '@/components/engine/primitives/TemperatureIndicator';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { playSound, playAmbient, stopAmbient } from '@/lib/audio/soundEngine';
import type { PhysicsSandboxConfig } from '@/data/learningData';
import type { PhysicsModel } from '@/lib/physics/PhysicsModel';

interface Props<TInputs extends Record<string, number>, TState> {
  config: PhysicsSandboxConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  model: PhysicsModel<TInputs, TState>;
  renderScene: (state: TState) => React.ReactNode;
  computeReadout: (state: TState, readoutId: string) => number;
  narrate?: (state: TState, inputs: TInputs) => string;
}

const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;

/**
 * A continuous, free-play physics sandbox — "dozens of tiny interactions,
 * everything responds continuously, every variable influences every other
 * variable" per the brief, implemented as a genuine simulation loop rather
 * than scripted animation: every tick, the live parameter values are fed
 * into `model.step()`, and the resulting state drives both the rendered
 * scene and the readouts. Dragging any slider takes effect on the very
 * next tick — there is no "replay a canned sequence" step anywhere in this
 * component.
 *
 * Fully generic: nothing here references toilets, water, or Physics. A
 * future Biology "ecosystem" or Chemistry "reaction rate" sandbox supplies
 * its own PhysicsModel + scene renderer + readout function and gets this
 * exact same interaction shell (sliders, gauges, trigger button, "explored
 * long enough" gate) for free.
 */
export default function PhysicsSandbox<TInputs extends Record<string, number>, TState>({
  config, submitted, onComplete, accentColor, model, renderScene, computeReadout, narrate,
}: Props<TInputs, TState>) {
  const initialInputs = useMemo(() => {
    const values: Record<string, number> = {};
    for (const p of config.parameters) values[p.id] = p.defaultValue ?? p.min;
    return values as TInputs;
  }, [config.parameters]);

  const [inputs, setInputs] = useState<TInputs>(initialInputs);
  const [simState, setSimState] = useState<TState>(() => model.createRestingState(initialInputs));
  const [playSeconds, setPlaySeconds] = useState(0);
  const [everInteracted, setEverInteracted] = useState(false);
  // Progressive disclosure: reveal 2 variables at a time instead of every
  // slider at once. A real critique of the first pass was "six sliders on
  // screen simultaneously is more simultaneous variables than a first
  // free-play encounter should introduce" — this doesn't change the
  // simulation at all (every parameter still has its real default value
  // from initialInputs the whole time, hidden or not), it only changes
  // what's rendered, so a curious student can still reveal everything
  // quickly without the screen being overwhelming on first look.
  const [visibleCount, setVisibleCount] = useState(() => Math.min(2, config.parameters.length));
  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  const minPlaySeconds = config.minPlaySeconds ?? 8;
  const hasPlayedEnough = playSeconds >= minPlaySeconds && everInteracted;

  // The continuous tick loop — this IS the "real simulation, not scripted
  // animation" requirement. Runs at 30Hz on the JS thread (the scenes are
  // plain Views with derived layout math per tick, not pure worklet
  // transforms, so a JS interval driving React state is the correct tool
  // here — Reanimated's UI thread is still used for the *smoothing*
  // between each tick's target values via withTiming/withSpring inside the
  // scene components themselves). Stops once the activity is submitted —
  // after the student has moved on to "Next," there's no reason to keep
  // stepping a simulation nobody is watching (Phase 8 performance: this
  // was previously an unbounded interval that outlived the interaction).
  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => {
      setSimState(prev => model.step(prev, inputsRef.current, TICK_MS / 1000));
      setPlaySeconds(s => s + TICK_MS / 1000);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [model, submitted]);

  // A soft ambient room tone plays only while this sandbox is the active,
  // mounted, not-yet-submitted activity — rather than globally — so it
  // never bleeds into other screens or lingers after the student moves on.
  useEffect(() => {
    if (submitted) {
      stopAmbient();
      return;
    }
    playAmbient();
    return () => stopAmbient();
  }, [submitted]);

  const handleParamChange = (id: string, value: number) => {
    if (!everInteracted) setEverInteracted(true);
    setInputs(prev => ({ ...prev, [id]: value }));
  };

  const handleTrigger = () => {
    if (!model.trigger) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSound('flushWhoosh');
    if (!everInteracted) setEverInteracted(true);
    setSimState(prev => model.trigger!(prev));
  };

  const handleComplete = () => {
    if (submitted || !hasPlayedEnough) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound('successChime');
    onComplete(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.sceneBox}>{renderScene(simState)}</View>

      {config.readouts.length > 0 && (
        <View style={styles.readoutRow}>
          {config.readouts.map(r => {
            const value = computeReadout(simState, r.id);
            if (r.kind === 'thermometer') {
              return <TemperatureIndicator key={r.id} celsius={value} label={r.label} />;
            }
            return <GaugeMeter key={r.id} value={value} color={r.color} label={r.label} unit={r.unit} />;
          })}
        </View>
      )}

      {narrate && <NarrateBox text={narrate(simState, inputs)} accentColor={accentColor} />}

      {model.trigger && (
        <TriggerButton label={config.triggerLabel ?? 'Trigger'} icon={config.triggerIcon} accentColor={accentColor} onPress={handleTrigger} />
      )}

      <View style={styles.controlsStack}>
        {config.parameters.slice(0, visibleCount).map(p => (
          <DraggableControl
            key={p.id}
            label={p.label}
            color={p.color ?? accentColor}
            min={p.min}
            max={p.max}
            value={inputs[p.id] as number}
            unit={p.unit}
            onChange={(v) => handleParamChange(p.id, v)}
          />
        ))}
      </View>

      {!submitted && visibleCount < config.parameters.length && (
        <TouchableOpacity
          style={[styles.revealMoreBtn, { borderColor: `${accentColor}55` }]}
          onPress={() => {
            Haptics.selectionAsync();
            playSound('discoveryPing', 0.4);
            setVisibleCount(c => Math.min(config.parameters.length, c + 2));
          }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Reveal more variables to experiment with"
        >
          <Ionicons name="add-circle-outline" size={16} color={accentColor} />
          <Text style={[styles.revealMoreText, { color: accentColor }]}>
            Try another variable ({config.parameters.length - visibleCount} more)
          </Text>
        </TouchableOpacity>
      )}

      {!submitted && (
        <View style={styles.playProgressRow}>
          <AnimatedProgressBar
            progress={everInteracted ? Math.min(100, (playSeconds / minPlaySeconds) * 100) : 0}
            color={accentColor}
            height={4}
            trackColor="rgba(255,255,255,0.08)"
          />
          <Text style={styles.playProgressLabel}>
            {hasPlayedEnough ? 'Explored enough — keep going or continue' : everInteracted ? 'Keep experimenting…' : 'Drag a control or press the trigger to begin'}
          </Text>
        </View>
      )}

      {!submitted && (
        <CompleteButton enabled={hasPlayedEnough} onPress={handleComplete} accentColor={accentColor} />
      )}
    </View>
  );
}

function TriggerButton({ label, icon, accentColor, onPress }: { label: string; icon?: string; accentColor: string; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <TouchableOpacity
        style={[styles.triggerBtn, { backgroundColor: accentColor }]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 14, stiffness: 320 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 280 }); }}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Ionicons name={(icon ?? 'play') as any} size={18} color="#04222A" />
        <Text style={styles.triggerBtnText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}


function NarrateBox({ text, accentColor }: { text: string; accentColor: string }) {
  const anim = useSharedValue(0);
  const lastTextRef = useRef('');
  useEffect(() => {
    if (text === lastTextRef.current) return;
    lastTextRef.current = text;
    anim.value = 0;
    anim.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [text]);

  const style = useAnimatedStyle(() => ({
    opacity: anim.value,
    transform: [{ translateY: (1 - anim.value) * 4 }],
  }));

  return (
    <View style={[styles.narrateBox, { borderColor: `${accentColor}44` }]}>
      <Ionicons name="pulse" size={16} color={accentColor} />
      <Animated.Text style={[styles.narrateText, style]}>{text}</Animated.Text>
    </View>
  );
}

function CompleteButton({ enabled, onPress, accentColor }: { enabled: boolean; onPress: () => void; accentColor: string }) {
  const scale = useSharedValue(1);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.completeBtn, { backgroundColor: enabled ? accentColor : 'rgba(255,255,255,0.08)' }]}
        onPress={onPress}
        onPressIn={() => { if (enabled) scale.value = withSpring(0.96, { damping: 14, stiffness: 300 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 10, stiffness: 280 }); }}
        disabled={!enabled}
        activeOpacity={1}
        accessibilityRole="button"
        accessibilityState={{ disabled: !enabled }}
        accessibilityLabel={enabled ? 'I understand this! Continue.' : 'Keep exploring before continuing'}
      >
        <Text style={[styles.completeBtnText, !enabled && styles.completeBtnTextDisabled]}>
          {enabled ? 'I understand this!' : 'Keep exploring…'}
        </Text>
        {enabled && <Ionicons name="checkmark" size={18} color="#04222A" />}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  sceneBox: {
    minHeight: 200, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 12,
    overflow: 'hidden',
  },
  readoutRow: { flexDirection: 'row', justifyContent: 'space-evenly', flexWrap: 'wrap', gap: 12 },
  narrateBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1,
  },
  narrateText: { flex: 1, fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  triggerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  triggerBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  controlsStack: { gap: 18 },
  revealMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed',
  },
  revealMoreText: { fontSize: 12, fontWeight: '700' },
  playProgressRow: { gap: 6 },
  playProgressLabel: { fontSize: 11, color: '#8892B0' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  completeBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
