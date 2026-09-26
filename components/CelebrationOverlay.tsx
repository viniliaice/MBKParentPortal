import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleContinue = () => {
    if (isExiting) return;
    setIsExiting(true);
    Animated.parallel([
      Animated.timing(scale, { toValue: 0.9, duration: 180, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => onContinue());
  };

  const pct = Math.round((correctCount / totalActivities) * 100);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <LinearGradient colors={['#1A2A5C', '#141D3A']} style={StyleSheet.absoluteFill} borderRadius={28} />

        <Text style={styles.emoji}>{badgeIcon}</Text>
        <Text style={styles.title}>Lesson Complete!</Text>
        <Text style={styles.badge}>{badgeName}</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{pct}%</Text>
            <Text style={styles.statLabel}>Score</Text>
          </View>
          <View style={[styles.statBox, styles.xpBox]}>
            <Text style={[styles.statValue, styles.xpValue]}>+{xpGained} XP</Text>
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
                <Ionicons name="trophy" size={16} color="#F6C90E" />
                <Text style={styles.gamStatValue}>Lv.{level}</Text>
              </View>
            )}
            {streak !== undefined && streak > 0 && (
              <View style={styles.gamStatBox}>
                <Ionicons name="flame" size={16} color="#FF5370" />
                <Text style={styles.gamStatValue}>{streak} day streak</Text>
              </View>
            )}
            {dailyBonus !== undefined && dailyBonus > 0 && (
              <View style={[styles.gamStatBox, styles.dailyBox]}>
                <Ionicons name="gift" size={16} color="#2ECC71" />
                <Text style={[styles.gamStatValue, { color: '#2ECC71' }]}>+{dailyBonus} daily</Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85} disabled={isExiting}>
          <LinearGradient colors={['#3D5AFE', '#00BCD4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.gradientBtn}>
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
  card: { width: width - 48, borderRadius: 28, padding: 32, alignItems: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  badge: { fontSize: 15, color: '#8892B0', marginBottom: 24 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 28, width: '100%' },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, alignItems: 'center' },
  xpBox: { backgroundColor: 'rgba(61,90,254,0.15)' },
  statValue: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  xpValue: { color: '#3D5AFE' },
  statLabel: { fontSize: 11, color: '#8892B0', marginTop: 2 },
  gamificationRow: { flexDirection: 'row', gap: 8, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' },
  gamStatBox: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  gamStatValue: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  dailyBox: { backgroundColor: 'rgba(46,204,113,0.15)' },
  continueBtn: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  gradientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16 },
  continueBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
