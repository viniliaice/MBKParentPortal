import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import MarksHud from '@/components/MarksHud';
import ChildrenSelector from '@/components/ChildrenSelector';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useScheme } from '@/context/ThemeContext';
import { useColors } from '@/hooks/useColors';

const REPORT_ACTIONS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'monthly', label: 'Monthly', icon: 'calendar-outline' },
  { key: 'midterm', label: 'Midterm', icon: 'layers-outline' },
  { key: 'final', label: 'Final', icon: 'ribbon-outline' },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const { students, messages, announcements, loading, results } = useApp();
  const { isDark } = useScheme();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(students[0]?.id);

  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const firstName = user?.name.split(' ')[0] ?? 'Parent';

  // Keep the selection valid as data arrives: single-child parents never see a
  // selector; multi-child parents keep the first child chosen by default.
  const safeSelectedId = students.some(s => s.id === selectedId) ? selectedId : students[0]?.id;
  const selected = students.find(s => s.id === safeSelectedId);

  const unread = useMemo(
    () => messages.filter(m => m.isInbox && !m.isRead).length,
    [messages],
  );

  const childResults = useMemo(
    () => (selected ? results.filter(r => r.studentId === selected.id) : []),
    [results, selected],
  );

  const latestAnnouncements = announcements.slice(0, 4);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: c.mutedForeground }]}>{greeting()},</Text>
            <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{firstName} 👋</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push('/(tabs)/messages')}
              activeOpacity={0.7}
              accessibilityLabel="Messages"
            >
              <Ionicons name={unread > 0 ? 'notifications' : 'notifications-outline'} size={20} color={c.foreground} />
              {unread > 0 && (
                <View style={[styles.badge, { backgroundColor: c.destructive }]}>
                  <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push('/appearance')}
              activeOpacity={0.7}
              accessibilityLabel="Appearance"
            >
              <Ionicons name={isDark ? 'moon' : 'sunny'} size={20} color={c.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Children selector */}
        {students.length > 1 && (
          <View style={styles.selectorWrap}>
            <ChildrenSelector
              childrenList={students}
              selectedId={safeSelectedId}
              onSelect={setSelectedId}
            />
          </View>
        )}

        {/* Academic summary */}
        {loading ? (
          <View style={styles.skeletonCard}>
            <View style={[styles.phCard, { backgroundColor: c.card, borderColor: c.border }]} />
          </View>
        ) : selected ? (
          <View style={styles.hudWrap}>
            <MarksHud
              studentName={selected.name}
              className={selected.grade === selected.className ? selected.className : `${selected.className} · ${selected.grade}`}
              results={childResults}
            />
          </View>
        ) : (
          <View style={styles.hudWrap}>
            <View style={[styles.emptyCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="person-outline" size={28} color={c.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: c.foreground }]}>No children on this account yet</Text>
              <Text style={[styles.emptyNote, { color: c.mutedForeground }]}>
                Marks and school messages for your children will appear here.
              </Text>
            </View>
          </View>
        )}

        {/* Report actions */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>Marks & Reports</Text>
        </View>
        <View style={styles.reportRow}>
          {REPORT_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.key}
              style={[styles.reportBtn, { backgroundColor: c.card, borderColor: c.border }]}
              onPress={() => router.push({ pathname: '/results', params: { examType: action.key, studentId: safeSelectedId ?? '' } })}
              activeOpacity={0.8}
            >
              <View style={[styles.reportIcon, { backgroundColor: `${c.primary}1F` }]}>
                <Ionicons name={action.icon} size={22} color={c.primary} />
              </View>
              <Text style={[styles.reportLabel, { color: c.foreground }]}>{action.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={c.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Announcements */}
        <View style={[styles.sectionRow, { marginTop: 24 }]}>
          <Text style={[styles.sectionTitle, { color: c.foreground }]}>
            Announcements{' '}
            {unread > 0 && <Text style={{ color: c.destructive }}>• {unread} unread message{unread === 1 ? '' : 's'}</Text>}
          </Text>
        </View>
        {latestAnnouncements.length > 0 ? (
          <View style={styles.annWrap}>
            {latestAnnouncements.map(ann => (
              <TouchableOpacity
                key={ann.id}
                style={[styles.annCard, { backgroundColor: c.card, borderColor: c.border }]}
                onPress={() => router.push('/(tabs)/messages')}
                activeOpacity={0.8}
              >
                <View style={[styles.annDotGap, { backgroundColor: ann.category === 'urgent' ? c.destructive : c.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.annTitle, { color: c.foreground }]} numberOfLines={1}>{ann.title}</Text>
                  <Text style={[styles.annBody, { color: c.mutedForeground }]} numberOfLines={2}>{ann.body}</Text>
                  <Text style={[styles.annDate, { color: c.mutedForeground }]}>
                    {new Date(ann.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.annWrap}>
            <View style={[styles.annCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="megaphone-outline" size={18} color={c.mutedForeground} />
              <Text style={[styles.annEmpty, { color: c.mutedForeground }]}>
                No announcements yet. Important school notices will appear here.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerActions: { flexDirection: 'row', gap: 8 },
  greeting: { fontSize: 14 },
  name: { fontSize: 24, fontWeight: '800', marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  selectorWrap: { paddingHorizontal: 20, marginBottom: 16 },
  hudWrap: { paddingHorizontal: 20, marginBottom: 20 },
  skeletonCard: { paddingHorizontal: 20, marginBottom: 20 },
  phCard: { height: 210, borderRadius: 20, borderWidth: 1 },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 24, alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyNote: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  sectionRow: { paddingHorizontal: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  reportRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10 },
  reportBtn: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  reportIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  reportLabel: { fontSize: 13, fontWeight: '700' },
  annWrap: { paddingHorizontal: 20, gap: 10 },
  annCard: { borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  annDotGap: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  annTitle: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  annBody: { fontSize: 13, lineHeight: 18 },
  annDate: { fontSize: 11, marginTop: 6 },
  annEmpty: { fontSize: 13, flex: 1 },
});
