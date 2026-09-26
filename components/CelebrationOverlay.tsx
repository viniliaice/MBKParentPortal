import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface Props {
  xpGained: number;
  badgeName: string;
  badgeIcon: string;
  correctCount: number;
  totalActivities: number;
  onContinue: () => void;
  streak?: number;
  level?: number;
  dailyBonus?: number;
}

export default function CelebrationOverlay({ xpGained, badgeName, badgeIcon, correctCount, totalActivities, onContinue, streak, level, dailyBonus }: Props) {
  const c = useColors();
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const pct = Math.round((correctCount / totalActivities) * 100);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { backgroundColor: c.background, borderColor: c.border, transform: [{ scale }] }]}>
        <Text style={styles.emoji}>{badgeIcon}</Text>
        <Text style={[styles.title, { color: c.foreground }]}>Lesson Complete!</Text>
        <Text style={[styles.badge, { color: c.mutedForeground }]}>{badgeName}</Text>

        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: c.muted }]}>
            <Text style={[styles.statValue, { color: c.foreground }]}>{pct}%</Text>
            <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Score</Text>
          </View>
          <View style={[styles.statBox, styles.xpBox, { backgroundColor: `${c.primary}26` }]}>
            <Text style={[styles.statValue, { color: c.primary }]}>+{xpGained} XP</Text>
            <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Earned</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: c.muted }]}>
            <Text style={[styles.statValue, { color: c.foreground }]}>{correctCount}/{totalActivities}</Text>
            <Text style={[styles.statLabel, { color: c.mutedForeground }]}>Correct</Text>
          </View>
        </View>

        {(streak !== undefined || level !== undefined) && (
          <View style={styles.gamificationRow}>
            {level !== undefined && (
              <View style={[styles.gamStatBox, { backgroundColor: c.muted }]}>
                <Ionicons name="trophy" size={16} color={c.gold} />
                <Text style={[styles.gamStatValue, { color: c.gold }]}>Lv.{level}</Text>
              </View>
            )}
            {streak !== undefined && streak > 0 && (
              <View style={[styles.gamStatBox, { backgroundColor: c.muted }]}>
                <Ionicons name="flame" size={16} color={c.destructive} />
                <Text style={[styles.gamStatValue, { color: c.destructive }]}>{streak} day streak</Text>
              </View>
            )}
            {dailyBonus !== undefined && dailyBonus > 0 && (
              <View style={[styles.gamStatBox, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
                <Ionicons name="gift" size={16} color="#2ECC71" />
                <Text style={[styles.gamStatValue, { color: '#2ECC71' }]}>+{dailyBonus} daily</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.85}>
          <LinearGradient colors={[c.primary, c.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientBtn}>
            <Text style={styles.continueBtnText}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11,16,38,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  card: { width: width - 48, borderRadius: 28, padding: 32, alignItems: 'center', borderWidth: 1 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', marginBottom: 6 },
  badge: { fontSize: 15, marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28, width: '100%' },
  statBox: { flex: 1, borderRadius: 14, padding: 14, alignItems: 'center' },
  xpBox: {},
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  gamificationRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  gamStatBox: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  gamStatValue: { fontSize: 13, fontWeight: '700' },
  continueBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
