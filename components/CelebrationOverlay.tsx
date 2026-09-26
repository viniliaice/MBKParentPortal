import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { withAlpha } from '@/constants/colors';
import { useColors, type Colors } from '@/hooks/useColors';

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
  const styles = useMemo(() => makeStyles(c), [c]);
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
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        {/* the card clips its own corners (overflow: hidden), so the gradient only has to fill it */}
        <LinearGradient colors={c.gradient} style={StyleSheet.absoluteFill} />

        <Text style={styles.emoji}>{badgeIcon}</Text>
        <Text style={styles.title}>Lesson complete!</Text>
        <Text style={styles.badge}>{badgeName}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{pct}%</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: c.primarySoft }]}>
            <Text style={[styles.statValue, { color: c.primary }]}>+{xpGained} XP</Text>
            <Text style={styles.statLabel}>Earned</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{correctCount}/{totalActivities}</Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
        </View>
        {(streak !== undefined || level !== undefined) && (
          <View style={styles.gamificationRow}>
            {level !== undefined && (
              <View style={styles.gamStatBox}>
                <Ionicons name="trophy" size={16} color={c.gold} />
                <Text style={styles.gamStatValue}>Lv.{level}</Text>
              </View>
            )}
            {streak !== undefined && streak > 0 && (
              <View style={styles.gamStatBox}>
                <Ionicons name="flame" size={16} color={c.destructive} />
                <Text style={styles.gamStatValue}>{streak} day streak</Text>
              </View>
            )}
            {dailyBonus !== undefined && dailyBonus > 0 && (
              <View style={[styles.gamStatBox, { backgroundColor: withAlpha(c.accent, 0.16) }]}>
                <Ionicons name="gift" size={16} color={c.accent} />
                <Text style={[styles.gamStatValue, { color: c.accent }]}>+{dailyBonus} daily</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.continueBtn} onPress={onContinue} activeOpacity={0.85} accessibilityRole="button">
          <LinearGradient colors={c.brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientBtn}>
            <Text style={[styles.continueBtnText, { color: c.onBrand }]}>Continue</Text>
            <Ionicons name="arrow-forward" size={18} color={c.onBrand} />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const { width } = Dimensions.get('window');

const makeStyles = (c: Colors) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: c.backdrop, justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  card: { width: width - 48, borderRadius: 28, padding: 32, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: c.border },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: c.foreground, marginBottom: 6 },
  badge: { fontSize: 15, color: c.textSecondary, marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28, width: '100%' },
  statBox: { flex: 1, backgroundColor: c.surfaceMuted, borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800', color: c.foreground },
  statLabel: { fontSize: 11, color: c.textSecondary, marginTop: 2 },
  gamificationRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  gamStatBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  gamStatValue: { fontSize: 13, fontWeight: '700', color: c.foreground },
  continueBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  continueBtnText: { fontSize: 16, fontWeight: '700' },
});
