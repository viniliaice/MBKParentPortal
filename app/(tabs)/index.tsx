import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

const QUICK_ACTIONS = [
  { label: 'Homework', icon: 'book-outline' as const, route: '/homework', color: '#3D5AFE' },
  { label: 'Attendance', icon: 'calendar-outline' as const, route: '/attendance', color: '#00BCD4' },
  { label: 'Results', icon: 'bar-chart-outline' as const, route: '/results', color: '#2ECC71' },
  { label: 'Learning', icon: 'school-outline' as const, route: '/(tabs)/learning', color: '#F59E0B' },
];

export default function DashboardScreen() {
  const { user } = useAuth();
  const { students, announcements, homework, unreadCount } = useApp();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const pendingHomework = homework.filter(h => h.status === 'pending').length;

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  const firstName = user?.name.split(' ')[0] ?? 'Parent';

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AFE" />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View>
            <Text style={styles.greeting}>Good morning,</Text>
            <Text style={styles.name}>{firstName} 👋</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push('/(tabs)/messages')} activeOpacity={0.7}>
            <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
            {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
          <SummaryCard label="Pending Homework" value={pendingHomework.toString()} icon="document-text-outline" color="#3D5AFE" />
          <SummaryCard label="Unread Messages" value={unreadCount.toString()} icon="mail-outline" color="#00BCD4" />
          <SummaryCard label="Children" value={students.length.toString()} icon="people-outline" color="#2ECC71" />
        </ScrollView>

        <SectionTitle title="Your Children" />
        {students.map(student => (
          <TouchableOpacity key={student.id} style={styles.studentCard} activeOpacity={0.8}>
            <LinearGradient colors={[student.avatarColor, `${student.avatarColor}88`]} style={styles.studentAvatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.studentInitial}>{student.name[0]}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentClass}>{student.className} · {student.grade}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#8892B0" />
          </TouchableOpacity>
        ))}

        <SectionTitle title="Quick Access" />
        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity key={action.label} style={styles.quickBtn} onPress={() => router.push(action.route as any)} activeOpacity={0.8}>
              <View style={[styles.quickIcon, { backgroundColor: `${action.color}22` }]}>
                <Ionicons name={action.icon} size={22} color={action.color} />
              </View>
              <Text style={styles.quickLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle title="Announcements" />
        {announcements.slice(0, 3).map(ann => (
          <View key={ann.id} style={styles.annCard}>
            <View style={[styles.annDot, { backgroundColor: ann.category === 'urgent' ? '#FF5370' : ann.category === 'event' ? '#3D5AFE' : '#00BCD4' }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.annTitle}>{ann.title}</Text>
              <Text style={styles.annBody} numberOfLines={2}>{ann.body}</Text>
              <Text style={styles.annDate}>{new Date(ann.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </AuroraBackground>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={[styles.summaryCard, { borderColor: `${color}33` }]}>
      <Ionicons name={icon} size={20} color={color} style={{ marginBottom: 8 }} />
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  greeting: { fontSize: 14, color: '#8892B0' },
  name: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },
  notifBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 0, right: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF5370', alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  summaryRow: { paddingHorizontal: 20, gap: 12, paddingBottom: 4 },
  summaryCard: { backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 16, width: 130, borderWidth: 1 },
  summaryValue: { fontSize: 26, fontWeight: '800' },
  summaryLabel: { fontSize: 11, color: '#8892B0', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', paddingHorizontal: 20, marginTop: 24, marginBottom: 12 },
  studentCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  studentAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  studentInitial: { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  studentName: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  studentClass: { fontSize: 13, color: '#8892B0', marginTop: 2 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 12 },
  quickBtn: { width: '47%', backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 16, alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  annCard: { marginHorizontal: 20, marginBottom: 10, backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  annDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  annTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  annBody: { fontSize: 13, color: '#8892B0', lineHeight: 18 },
  annDate: { fontSize: 11, color: '#4A5080', marginTop: 6 },
});
