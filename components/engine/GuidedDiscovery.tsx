import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { GuidedDiscoveryConfig } from '@/data/learningData';

interface Props {
  config: GuidedDiscoveryConfig;
  submitted: boolean;
  onComplete: (success: boolean) => void;
  accentColor: string;
}

/**
 * Tap-to-reveal fact cards — the "small explanation" and "real world
 * application" bridge steps in a lesson, kept interactive instead of a wall
 * of prose (per the "museum, not textbook" brief). Reusable for any subject:
 * a Biology lesson's "did you know?" facts about a body system would use
 * the exact same component.
 */
export default function GuidedDiscovery({ config, submitted, onComplete, accentColor }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const reveal = (id: string) => {
    if (revealed.has(id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRevealed(prev => new Set(prev).add(id));
  };

  const allRevealed = revealed.size >= config.facts.length;

  const handleComplete = () => {
    if (submitted || !allRevealed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.intro}>{config.intro}</Text>

      <View style={styles.factsStack}>
        {config.facts.map(fact => (
          <FactCard
            key={fact.id}
            title={fact.title}
            detail={fact.detail}
            icon={fact.icon}
            revealed={revealed.has(fact.id)}
            onPress={() => reveal(fact.id)}
            accentColor={accentColor}
          />
        ))}
      </View>

      {!submitted && (
        <TouchableOpacity
          style={[styles.completeBtn, { backgroundColor: allRevealed ? accentColor : 'rgba(255,255,255,0.08)' }]}
          onPress={handleComplete}
          disabled={!allRevealed}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeBtnText, !allRevealed && styles.completeBtnTextDisabled]}>
            {allRevealed ? 'Continue' : `Tap all ${config.facts.length} cards to continue`}
          </Text>
          {allRevealed && <Ionicons name="arrow-forward" size={18} color="#04222A" />}
        </TouchableOpacity>
      )}
    </View>
  );
}

function FactCard({ title, detail, icon, revealed, onPress, accentColor }: {
  title: string; detail: string; icon?: string; revealed: boolean; onPress: () => void; accentColor: string;
}) {
  const flip = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(revealed ? 1 : 0.98, { damping: 14 }) }],
  }));

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={revealed}>
      <Animated.View
        style={[
          styles.card,
          flip,
          revealed
            ? { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}14` }
            : styles.cardHidden,
        ]}
      >
        <View style={[styles.cardIcon, { backgroundColor: `${accentColor}22` }]}>
          <Ionicons name={(icon ?? (revealed ? 'checkmark-circle' : 'help-circle')) as any} size={20} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {revealed ? (
            <Text style={styles.cardDetail}>{detail}</Text>
          ) : (
            <Text style={styles.cardTapHint}>Tap to reveal</Text>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  intro: { fontSize: 14, color: '#CCCCCC', lineHeight: 21 },
  factsStack: { gap: 10 },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardHidden: {},
  cardIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 2 },
  cardDetail: { fontSize: 13, color: '#CCCCCC', lineHeight: 19 },
  cardTapHint: { fontSize: 12, color: '#5A6781', fontStyle: 'italic' },
  completeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: 14,
  },
  completeBtnText: { color: '#04222A', fontSize: 15, fontWeight: '800' },
  completeBtnTextDisabled: { color: '#4A5080' },
});
