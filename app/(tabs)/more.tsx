import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

const MENU_ITEMS = [
  { label: 'Homework', icon: 'book-outline' as const, route: '/homework', color: '#3D5AFE', desc: 'View pending & submitted tasks' },
  { label: 'Quizzes', icon: 'help-circle-outline' as const, route: '/quizzes', color: '#F59E0B', desc: 'Take quizzes and view results' },
  { label: 'Attendance', icon: 'calendar-outline' as const, route: '/attendance', color: '#00BCD4', desc: 'Check daily attendance records' },
  { label: 'Academic Results', icon: 'bar-chart-outline' as const, route: '/results', color: '#2ECC71', desc: 'Exam scores and grades' },
];

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { getTotalXP, lessonProgress, gamification } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const completedLessons = Object.values(lessonProgress).filter(p => p.completed).length;
  const totalXP = getTotalXP();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/login'); } },
    ]);
  };

  return (
    <AuroraBackground>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <Text style={styles.headerTitle}>More</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileInitial}>{user?.name[0]}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{user?.name}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="star" size={20} color="#F6C90E" style={{ marginBottom: 6 }} />
            <Text style={[styles.statValue, { color: '#F6C90E' }]}>{totalXP}</Text>
            <Text style={styles.statLabel}>Total XP</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={20} color="#2ECC71" style={{ marginBottom: 6 }} />
            <Text style={[styles.statValue, { color: '#2ECC71' }]}>{completedLessons}</Text>
            <Text style={styles.statLabel}>Lessons Done</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="trophy" size={20} color="#3D5AFE" style={{ marginBottom: 6 }} />
            <Text style={[styles.statValue, { color: '#3D5AFE' }]}>{gamification.level}</Text>
            <Text style={styles.statLabel}>Level</Text>
          </View>
        </View>
        {gamification.currentStreak > 0 && (
          <View style={styles.streakCard}>
            <Ionicons name="flame" size={22} color="#FF5370" />
            <Text style={styles.streakValue}>{gamification.currentStreak}-day streak</Text>
            <Text style={styles.streakLabel}>Best: {gamification.longestStreak} days</Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>Academic Records</Text>
        {MENU_ITEMS.map(item => (
          <TouchableOpacity key={item.label} style={styles.menuItem} onPress={() => router.push(item.route as any)} activeOpacity={0.8}>
            <View style={[styles.menuIcon, { backgroundColor: `${item.color}22` }]}>
              <Ionicons name={item.icon} size={22} color={item.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuDesc}>{item.desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8892B0" />
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={[styles.menuItem, styles.logoutItem]} onPress={handleLogout} activeOpacity={0.8}>
          <View style={[styles.menuIcon, { backgroundColor: 'rgba(255,83,112,0.15)' }]}>
            <Ionicons name="log-out-outline" size={22} color="#FF5370" />
          </View>
          <Text style={[styles.menuLabel, { color: '#FF5370' }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  profileCard: { marginHorizontal: 20, marginBottom: 16, backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  profileAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(61,90,254,0.3)', alignItems: 'center', justifyContent: 'center' },
  profileInitial: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  profileEmail: { fontSize: 13, color: '#8892B0', marginTop: 2 },
  statsRow: { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 20 },
  statCard: { flex: 1, backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 10, color: '#8892B0', marginTop: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#8892B0', letterSpacing: 1, paddingHorizontal: 20, marginBottom: 10, marginTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  logoutItem: { borderBottomWidth: 0 },
  streakCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: 'rgba(255,83,112,0.08)', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: 'rgba(255,83,112,0.2)' },
  streakValue: { fontSize: 16, fontWeight: '800', color: '#FF5370', flex: 1 },
  streakLabel: { fontSize: 12, color: '#8892B0' },
  menuIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  menuDesc: { fontSize: 12, color: '#8892B0', marginTop: 2 },
});
