import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
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
 */
export default function BuildChallenge({ config, submitted, onComplete, accentColor }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState<null | boolean>(null);
  const shake = useSharedValue(0);

  const toggle = (id: string) => {
    if (submitted || checked === true) return;
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

  const handleCheck = () => {
    if (submitted || selected.size === 0) return;
    setChecked(isCorrect);
    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onComplete(true);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      shake.value = withSpring(8, { damping: 4, stiffness: 500 }, () => {
        shake.value = withSpring(0, { damping: 6, stiffness: 400 });
      });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{config.prompt}</Text>

      <Animated.View style={[styles.partsGrid, shakeStyle]}>
        {config.parts.map(part => {
          const isSelected = selected.has(part.id);
          return (
            <TouchableOpacity
              key={part.id}
              style={[
                styles.partTile,
                isSelected && { borderColor: accentColor, backgroundColor: `${accentColor}1A` },
                checked === false && isSelected && styles.partTileWrong,
              ]}
              onPress={() => toggle(part.id)}
              activeOpacity={0.8}
              disabled={submitted || checked === true}
            >
              {part.icon && <Ionicons name={part.icon as any} size={22} color={isSelected ? accentColor : '#8892B0'} />}
              <Text style={[styles.partLabel, isSelected && { color: '#FFFFFF' }]}>{part.label}</Text>
              {isSelected && <Ionicons name="checkmark-circle" size={16} color={accentColor} style={styles.partCheck} />}
            </TouchableOpacity>
          );
        })}
      </Animated.View>

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

const styles = StyleSheet.create({
  container: { gap: 16 },
  prompt: { fontSize: 13, color: '#CCCCCC', lineHeight: 19 },
  partsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  partTile: {
    flexBasis: '30%', flexGrow: 1, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', gap: 6, position: 'relative',
  },
  partTileWrong: { borderColor: '#FF5370', backgroundColor: 'rgba(255,83,112,0.12)' },
  partLabel: { fontSize: 11, fontWeight: '600', color: '#8892B0', textAlign: 'center' },
  partCheck: { position: 'absolute', top: 6, right: 6 },
  resultBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  resultBoxCorrect: { backgroundColor: 'rgba(46,204,113,0.12)', borderColor: 'rgba(46,204,113,0.3)' },
  resultBoxWrong: { backgroundColor: 'rgba(255,83,112,0.12)', borderColor: 'rgba(255,83,112,0.3)' },
  resultText: { fontSize: 13, fontWeight: '600', flex: 1 },
  checkBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  checkBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  checkBtnTextDisabled: { color: '#4A5080' },
});
