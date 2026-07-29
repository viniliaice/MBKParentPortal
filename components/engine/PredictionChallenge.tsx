import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { playSound } from '@/lib/audio/soundEngine';
import type { PredictionChallengeConfig } from '@/data/learningData';

interface Props {
  config: PredictionChallengeConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
  /** resolved from config.sceneKey by the caller, shown only after the guess is locked in */
  renderScene?: () => React.ReactNode;
}

/**
 * Predict-observe-explain: commit to a guess *before* seeing the outcome,
 * then compare against what actually happens. This is a stronger retention
 * technique than passively watching a demo — the wrong-prediction moment is
 * where real learning happens. Fully generic; correctness is just an id
 * match against config.correctOptionId.
 */
export default function PredictionChallenge({ config, submitted, onComplete, accentColor, renderScene }: Props) {
  const [guess, setGuess] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const lockIn = (id: string) => {
    if (revealed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const correct = id === config.correctOptionId;
    playSound(correct ? 'discoveryPing' : 'mistakeBuzz');
    setGuess(id);
    setRevealed(true);
  };

  const wasCorrect = guess === config.correctOptionId;

  const handleComplete = () => {
    if (submitted || !revealed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    playSound('successChime');
    onComplete(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.prompt}>{config.prompt}</Text>

      <View style={styles.optionsStack}>
        {config.options.map(opt => {
          const isSelected = guess === opt.id;
          const isCorrectOpt = opt.id === config.correctOptionId;
          let borderColor = 'rgba(255,255,255,0.12)';
          let bg = 'rgba(255,255,255,0.05)';
          if (revealed && isCorrectOpt) { borderColor = '#2ECC71'; bg = 'rgba(46,204,113,0.14)'; }
          else if (revealed && isSelected && !isCorrectOpt) { borderColor = '#FF5370'; bg = 'rgba(255,83,112,0.14)'; }
          else if (!revealed && isSelected) { borderColor = accentColor; bg = `${accentColor}1A`; }
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.option, { borderColor, backgroundColor: bg }]}
              onPress={() => lockIn(opt.id)}
              disabled={revealed}
              activeOpacity={0.8}
            >
              <Text style={styles.optionText}>{opt.label}</Text>
              {revealed && isCorrectOpt && <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />}
              {revealed && isSelected && !isCorrectOpt && <Ionicons name="close-circle" size={18} color="#FF5370" />}
            </TouchableOpacity>
          );
        })}
      </View>

      {revealed && renderScene && (
        <View style={styles.sceneBox}>{renderScene()}</View>
      )}

      {revealed && (
        <View style={[styles.explainBox, { borderColor: wasCorrect ? 'rgba(46,204,113,0.3)' : `${accentColor}44` }]}>
          <Ionicons name={wasCorrect ? 'checkmark-circle' : 'bulb'} size={16} color={wasCorrect ? '#2ECC71' : accentColor} />
          <Text style={styles.explainText}>{config.explanation}</Text>
        </View>
      )}

      {!submitted && revealed && (
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: accentColor }]}
          onPress={handleComplete}
          activeOpacity={0.85}
        >
          <Text style={styles.completeBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color="#04222A" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 14 },
  prompt: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', lineHeight: 21 },
  optionsStack: { gap: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  optionText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', flex: 1 },
  sceneBox: {
    minHeight: 120, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', padding: 14,
  },
  explainBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, borderWidth: 1,
  },
  explainText: { flex: 1, fontSize: 13.5, color: '#E5F9FF', lineHeight: 20 },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  completeBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
});
