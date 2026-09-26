import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, withDelay } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { playSound } from '@/lib/audio/soundEngine';
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
 *
 * Juice pass: cards slide/fade in staggered on mount (never appear all at
 * once), flip open with a satisfying icon spin + expand instead of a plain
 * scale, and the whole intro text gently fades in first so the screen never
 * pops fully-formed on entry.
 */
export default function GuidedDiscovery({ config, submitted, onComplete, accentColor }: Props) {
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const introAnim = useSharedValue(0);

  useEffect(() => {
    introAnim.value = withTiming(1, { duration: 350 });
  }, []);

  const reveal = (id: string) => {
    if (revealed.has(id)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    playSound('discoveryPing');
    setRevealed(prev => new Set(prev).add(id));
  };

  const allRevealed = revealed.size >= config.facts.length;

  const handleComplete = () => {
    if (submitted || !allRevealed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete(true);
  };

  const introStyle = useAnimatedStyle(() => ({
    opacity: introAnim.value,
    transform: [{ translateY: (1 - introAnim.value) * 6 }],
  }));

  return (
    <View style={styles.container}>
      <Animated.Text style={[styles.intro, introStyle]}>{config.intro}</Animated.Text>

      <View style={styles.factsStack}>
        {config.facts.map((fact, i) => (
          <FactCard
            key={fact.id}
            index={i}
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

function FactCard({ index, title, detail, icon, revealed, onPress, accentColor }: {
  index: number; title: string; detail: string; icon?: string; revealed: boolean; onPress: () => void; accentColor: string;
}) {
  const entrance = useSharedValue(0);
  const reveal = useSharedValue(0);
  const iconSpin = useSharedValue(0);

  useEffect(() => {
    entrance.value = withDelay(index * 90, withSpring(1, { damping: 13, stiffness: 140 }));
  }, []);

  useEffect(() => {
    reveal.value = withSpring(revealed ? 1 : 0, { damping: 12, stiffness: 160 });
    if (revealed) {
      iconSpin.value = withSpring(1, { damping: 8, stiffness: 140 });
    }
  }, [revealed]);

  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 24 }, { scale: 0.92 + entrance.value * 0.08 }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + reveal.value * 0.03 }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${iconSpin.value * 360}deg` }, { scale: 1 + reveal.value * 0.1 }],
  }));

  return (
    <Animated.View style={entranceStyle}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} disabled={revealed}>
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            revealed
              ? { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}14`, shadowColor: accentColor, shadowOpacity: 0.25, shadowRadius: 8, elevation: 3 }
              : styles.cardHidden,
          ]}
        >
          <Animated.View style={[styles.cardIcon, iconStyle, { backgroundColor: `${accentColor}22` }]}>
            <Ionicons name={(icon ?? (revealed ? 'checkmark-circle' : 'help-circle')) as any} size={20} color={accentColor} />
          </Animated.View>
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
    </Animated.View>
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
