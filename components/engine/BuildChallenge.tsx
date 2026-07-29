import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ParticleBurst from '@/components/engine/primitives/ParticleBurst';
import { playSound } from '@/lib/audio/soundEngine';
import type { BuildChallengeConfig } from '@/data/learningData';

interface Props {
  config: BuildChallengeConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
}

/**
 * Generic "select the parts needed to solve a goal, then submit" challenge —
 * built for "repair the toilet with the fewest parts" but reusable for any
 * build/assembly goal (circuit parts, a food chain, a chemical equation's
 * reactants). Success = selected set exactly matches the required parts;
 * extra unnecessary parts fail it, teaching "minimal correct solution"
 * rather than "throw everything at it."
 *
 * Juice pass: tiles lift and tilt slightly on selection instead of just
 * changing color, a wrong check makes the whole grid shake with more snap,
 * and a correct check triggers a gold glow sweep + particle burst so
 * "solved it" feels like a real win, not a color swap.
 */
export default function BuildChallenge({ config, submitted, onComplete, accentColor }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<null | boolean>(null);
  const [burstTrigger, setBurstTrigger] = useState(0);
  const shake = useSharedValue(0);
  const successGlow = useSharedValue(0);

  const toggle = (id: string) => {
    if (submitted || checked === true) return;
    Haptics.selectionAsync();
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setChecked(null);
  };

  const requiredIds = config.parts.filter(p => p.required).map(p => p.id).sort();
  const selectedIds = [...selected].sort();
  const isCorrect = requiredIds.length === selectedIds.length && requiredIds.every((id, i) => id === selectedIds[i]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: successGlow.value * 0.4,
  }));

  const handleCheck = () => {
    if (submitted || selected.size === 0) return;
    setChecked(isCorrect);
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSound('successChime');
      successGlow.value = withSequence(withTiming(1, { duration: 200 }), withTiming(0.3, { duration: 500 }));
      setBurstTrigger(n => n + 1);
      onComplete(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      playSound('mistakeBuzz');
      shake.value = withSequence(
        withTiming(-10, { duration: 60 }),
        withTiming(10, { duration: 90 }),
        withTiming(-7, { duration: 90 }),
        withTiming(7, { duration: 90 }),
        withSpring(0, { damping: 6, stiffness: 400 }),
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{config.prompt}</Text>

      <View style={styles.gridAnchor}>
        <Animated.View style={[styles.successGlowRing, glowStyle]} pointerEvents="none" />
        <Animated.View style={[styles.partsGrid, shakeStyle]}>
          {config.parts.map(part => (
            <PartTile
              key={part.id}
              label={part.label}
              icon={part.icon}
              selected={selected.has(part.id)}
              wrong={checked === false && selected.has(part.id)}
              disabled={submitted || checked === true}
              accentColor={accentColor}
              onPress={() => toggle(part.id)}
            />
          ))}
        </Animated.View>
        <View style={styles.particleAnchor}>
          <ParticleBurst trigger={burstTrigger} color="#F6C90E" count={14} />
        </View>
      </View>

      {checked !== null && (
        <View style={[styles.resultBox, checked ? styles.resultBoxCorrect : styles.resultBoxWrong]}>
          <Ionicons name={checked ? 'checkmark-circle' : 'close-circle'} size={18} color={checked ? '#2ECC71' : '#FF5370'} />
          <Text style={[styles.resultText, { color: checked ? '#2ECC71' : '#FF5370' }]}>
            {checked ? config.successMessage : config.failureMessage}
          </Text>
        </View>
      )}

      {!submitted && checked !== true && (
        <TouchableOpacity
          style={[styles.checkBtn, { backgroundColor: selected.size > 0 ? accentColor : 'rgba(255,255,255,0.08)' }]}
          onPress={handleCheck}
          disabled={selected.size === 0}
          activeOpacity={0.85}
        >
          <Text style={[styles.checkBtnText, selected.size === 0 && styles.checkBtnTextDisabled]}>Check my repair</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function PartTile({ label, icon, selected, wrong, disabled, accentColor, onPress }: {
  label: string; icon?: string; selected: boolean; wrong: boolean; disabled: boolean; accentColor: string; onPress: () => void;
}) {
  const lift = useSharedValue(0);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * 4 },
      { rotate: `${lift.value * (selected ? 2 : 0)}deg` },
      { scale: 1 + lift.value * 0.04 },
    ],
  }));

  React.useEffect(() => {
    lift.value = withSpring(selected ? 1 : 0, { damping: 10, stiffness: 220 });
  }, [selected]);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} disabled={disabled}>
      <Animated.View
        style={[
          styles.partTile,
          style,
          selected && { borderColor: accentColor, backgroundColor: `${accentColor}1A`, shadowColor: accentColor, shadowOpacity: 0.35, shadowRadius: 8, elevation: 4 },
          wrong && styles.partTileWrong,
        ]}
      >
        {icon && <Ionicons name={icon as any} size={22} color={selected ? accentColor : '#8892B0'} />}
        <Text style={[styles.partLabel, selected && { color: '#FFFFFF' }]}>{label}</Text>
        {selected && <Ionicons name="checkmark-circle" size={16} color={accentColor} style={styles.partCheck} />}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  prompt: { fontSize: 13, color: '#CCCCCC', lineHeight: 19 },
  gridAnchor: { position: 'relative' },
  successGlowRing: {
    ...StyleSheet.absoluteFillObject, borderRadius: 16, backgroundColor: '#F6C90E',
  },
  partsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  partTile: {
    flexBasis: '30%', flexGrow: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', gap: 6, position: 'relative',
  },
  partTileWrong: { borderColor: '#FF5370', backgroundColor: 'rgba(255,83,112,0.12)' },
  partLabel: { fontSize: 11, fontWeight: '600', color: '#8892B0', textAlign: 'center' },
  partCheck: { position: 'absolute', top: 6, right: 6 },
  particleAnchor: { position: 'absolute', top: '50%', left: '50%' },
  resultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  resultBoxCorrect: { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: 'rgba(46,204,113,0.3)' },
  resultBoxWrong: { backgroundColor: 'rgba(255,83,112,0.12)', borderColor: 'rgba(255,83,112,0.3)' },
  resultText: { fontSize: 13, fontWeight: '600', flex: 1 },
  checkBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  checkBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  checkBtnTextDisabled: { color: '#4A5080' },
});
