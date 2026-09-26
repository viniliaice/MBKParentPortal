import React, { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { Avatar } from '@/components/Avatar';
import { AnnouncementCard } from '@/components/AnnouncementCard';
import { Card } from '@/components/Card';
import { ChildSelector } from '@/components/ChildSelector';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { MessageDetailModal } from '@/components/MessageDetailModal';
import { MessageRow } from '@/components/MessageRow';
import { ReportPeriodCard } from '@/components/ReportPeriodCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useColors } from '@/hooks/useColors';
import { useTabBarSpacing, useTopPadding } from '@/hooks/useScreenInsets';
import type { AppMessage } from '@/data/mockData';
import {
  REPORT_PERIODS,
  gradeColorFor,
  latestPeriodSummary,
  summariseChild,
  type ReportPeriod,
} from '@/lib/reportSelectors';

const PERIOD_ICONS: Record<ReportPeriod, React.ComponentProps<typeof Ionicons>['name']> = {
  monthly: 'calendar-outline',
  midterm: 'reader-outline',
  final: 'trophy-outline',
};

function greetingFor(date: Date): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Home answers one question first: how is my child doing?
 *
 * The composition is deliberate — child, then their marks, then what the school has
 * sent, then everything else. Nothing academic is more than one tap away, and the
 * child shown here is the same child every other screen shows.
 */
export default function HomeScreen() {
  const { user } = useAuth();
  const {
    students, selectedStudent, results, pendingReports, announcements, messages,
    attendance, homework, unreadCount, newAnnouncementsCount, loading, error, refresh,
  } = useApp();
  const c = useColors();
  const topPad = useTopPadding();
  const tabSpacing = useTabBarSpacing();

  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [openMessage, setOpenMessage] = useState<AppMessage | null>(null);

  const child = selectedStudent;
  const childId = child?.id ?? '';

  const academics = useMemo(
    () => summariseChild(results, pendingReports, childId),
    [results, pendingReports, childId],
  );

  const childResults = useMemo(
    () => results.filter(r => r.studentId === childId),
    [results, childId],
  );

  const periodCards = useMemo(
    () => REPORT_PERIODS.map(period => ({
      period: period.key,
      label: period.label,
      summary: latestPeriodSummary(childResults, period.key),
    })),
    [childResults],
  );

  const childAttendance = useMemo(() => {
    const records = attendance.filter(a => a.studentId === childId);
    if (records.length === 0) return null;
    const present = records.filter(r => r.status === 'present').length;
    return { pct: Math.round((present / records.length) * 100), count: records.length };
  }, [attendance, childId]);

  const pendingHomework = useMemo(
    () => homework.filter(h => h.studentId === childId && h.status === 'pending').length,
    [homework, childId],
  );

  const unreadMessages = useMemo(
    () => messages.filter(m => m.isInbox && !m.isRead).slice(0, 2),
    [messages],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const onRetry = useCallback(async () => {
    setRetrying(true);
    await refresh();
    setRetrying(false);
  }, [refresh]);

  const openMarks = (period: ReportPeriod) => {
    router.push({ pathname: '/(tabs)/marks', params: { period } });
  };

  const greeting = greetingFor(new Date());
  const firstName = user?.name.split(' ')[0] ?? 'Parent';
  const attention = academics.attention.slice(0, 2);
  // Only what is missing from the report this card is actually about: a midterm the
  // school has not held yet is not something to tell a parent about in September.
  const pendingForPeriod = academics.latestPending;

  if (loading && students.length === 0) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1, paddingTop: topPad + 16 }}>
          <LoadingState blocks={3} />
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpacing + 12 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        }
      >
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: c.textSecondary }]}>{greeting},</Text>
            <Text style={[styles.name, { color: c.foreground }]} numberOfLines={1}>{firstName}</Text>
          </View>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/messages')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={unreadCount > 0 ? `Messages, ${unreadCount} unread` : 'Messages'}
          >
            <Ionicons name="notifications-outline" size={20} color={c.foreground} />
            {unreadCount > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.destructive, borderColor: c.background }]}>
                <Text style={[styles.badgeText, { color: c.destructiveForeground }]}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.surface, borderColor: c.border }]}
            onPress={() => router.push('/(tabs)/more')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Your profile and settings"
          >
            {user ? <Avatar name={user.name} color={c.primary} size={26} /> : <Ionicons name="person-outline" size={20} color={c.foreground} />}
          </TouchableOpacity>
        </View>

        {/* Each child card carries its own twelve-month strip: which months of their
            school year have marks published. */}
        <ChildSelector showMonths style={{ paddingBottom: 4 }} />

        {error && students.length === 0 ? (
          <View style={{ marginTop: 16 }}>
            <ErrorState message={error} onRetry={onRetry} retrying={retrying} />
          </View>
        ) : students.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No children linked yet"
            message="Your children will appear here once the school office links them to your account."
          />
        ) : child ? (
          <>
            <View style={styles.heroWrap}>
              <Card style={styles.hero}>
                <View style={styles.heroTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.heroName, { color: c.foreground }]} numberOfLines={2}>{child.name}</Text>
                    <Text style={[styles.heroClass, { color: c.textSecondary }]} numberOfLines={1}>{child.grade}</Text>
                  </View>
                  {academics.hasAnyResult ? (
                    <View style={styles.heroScoreBlock}>
                      <Text
                        style={[
                          styles.heroScore,
                          { color: gradeColorFor(academics.averagePct, 100, { success: c.accent, warning: c.warning, danger: c.destructive }) },
                        ]}
                      >
                        {academics.averagePct}%
                      </Text>
                      <Text style={[styles.heroScoreLabel, { color: c.textDim }]}>
                        {academics.period === 'monthly' ? 'this month' : 'overall'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {academics.hasAnyResult ? (
                  <>
                    <View style={[styles.heroDivider, { backgroundColor: c.border }]} />
                    <View style={styles.heroMetaRow}>
                      <Ionicons name="document-text-outline" size={15} color={c.primary} />
                      <Text style={[styles.heroMeta, { color: c.textBody }]} numberOfLines={2}>
                        Latest: <Text style={{ fontWeight: '700', color: c.foreground }}>{academics.label}</Text>
                        {academics.subjectCount > 0 ? ` · ${academics.subjectCount} subject${academics.subjectCount === 1 ? '' : 's'}` : ''}
                      </Text>
                    </View>

                    {academics.latestAssessment ? (
                      <View style={styles.heroMetaRow}>
                        <Ionicons name="bookmark-outline" size={15} color={c.textDim} />
                        <Text style={[styles.heroMeta, { color: c.textSecondary }]} numberOfLines={2}>
                          Most recent mark: {academics.latestAssessment.subject} {academics.latestAssessment.pct}%
                        </Text>
                      </View>
                    ) : null}

                    {attention.length > 0 ? (
                      <View style={styles.attentionRow}>
                        {attention.map(item => (
                          <View key={item.subject} style={[styles.attentionChip, { backgroundColor: c.surface, borderColor: c.warning }]}>
                            <Ionicons name="alert-circle-outline" size={13} color={c.warning} />
                            <Text style={[styles.attentionText, { color: c.warning }]} numberOfLines={1}>
                              {item.subject} {item.pct}%
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <View style={styles.heroMetaRow}>
                        <Ionicons name="checkmark-circle-outline" size={15} color={c.accent} />
                        <Text style={[styles.heroMeta, { color: c.accent }]}>No subject needs attention right now</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <View style={{ marginTop: 4 }}>
                    <Text style={[styles.heroMeta, { color: c.textSecondary }]}>
                      No marks have been published yet. They appear here as soon as teachers publish them.
                    </Text>
                  </View>
                )}

                {pendingForPeriod.length > 0 ? (
                  <View style={[styles.pendingNote, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
                    <Ionicons name="time-outline" size={14} color={c.textSecondary} />
                    <Text style={[styles.pendingText, { color: c.textSecondary }]} numberOfLines={2}>
                      {pendingForPeriod.length} result{pendingForPeriod.length === 1 ? '' : 's'} still being published
                      {' '}({pendingForPeriod.slice(0, 2).map(p => p.subject).join(', ')}{pendingForPeriod.length > 2 ? ', …' : ''})
                    </Text>
                  </View>
                ) : null}

                {childAttendance ? (
                  <TouchableOpacity
                    style={[styles.attendanceRow, { borderTopColor: c.border }]}
                    onPress={() => router.push('/attendance')}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                  >
                    <Ionicons name="calendar-outline" size={15} color={c.secondary} />
                    <Text style={[styles.heroMeta, { color: c.textSecondary, flex: 1 }]}>
                      Attendance <Text style={{ color: c.foreground, fontWeight: '700' }}>{childAttendance.pct}%</Text> ({childAttendance.count} days)
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color={c.textDim} />
                  </TouchableOpacity>
                ) : null}
              </Card>
            </View>

            <SectionHeader title="Reports" actionLabel="All marks" onAction={() => router.push('/(tabs)/marks')} />
            <View style={styles.periodRow}>
              {periodCards.map(card => (
                <ReportPeriodCard
                  key={card.period}
                  label={card.label}
                  icon={PERIOD_ICONS[card.period]}
                  hasResults={!!card.summary}
                  detail={
                    card.summary
                      ? `${card.summary.count} subject${card.summary.count === 1 ? '' : 's'} · ${card.summary.averagePct}%`
                      : 'Not published yet'
                  }
                  onPress={() => openMarks(card.period)}
                />
              ))}
            </View>

            <SectionHeader
              title="From the school"
              actionLabel="Open messages"
              onAction={() => router.push('/(tabs)/messages')}
            />
            {unreadMessages.length > 0 ? (
              unreadMessages.map(message => (
                <MessageRow key={message.id} message={message} onPress={() => setOpenMessage(message)} />
              ))
            ) : announcements.length > 0 ? (
              announcements.slice(0, 2).map(announcement => (
                <AnnouncementCard
                  key={announcement.id}
                  announcement={announcement}
                  numberOfLines={2}
                  style={styles.previewCard}
                />
              ))
            ) : (
              <Card style={styles.previewCard}>
                <Text style={[styles.heroMeta, { color: c.textSecondary }]}>
                  No messages or announcements yet. The school's notices will appear here.
                </Text>
              </Card>
            )}

            {newAnnouncementsCount > 0 && unreadMessages.length > 0 && announcements.length > 0 ? (
              <AnnouncementCard announcement={announcements[0]} numberOfLines={2} style={styles.previewCard} />
            ) : null}

            <SectionHeader title="More for your child" />
            <View style={styles.tileRow}>
              <SecondaryTile
                icon="book-outline"
                label="Homework"
                detail={pendingHomework > 0 ? `${pendingHomework} due` : 'All clear'}
                onPress={() => router.push('/homework')}
              />
              <SecondaryTile
                icon="calendar-outline"
                label="Attendance"
                detail={childAttendance ? `${childAttendance.pct}%` : 'No records'}
                onPress={() => router.push('/attendance')}
              />
              <SecondaryTile
                icon="school-outline"
                label="Learning"
                detail="Practice"
                onPress={() => router.push('/(tabs)/learning')}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <MessageDetailModal message={openMessage} onClose={() => setOpenMessage(null)} />
    </AuroraBackground>
  );
}

function SecondaryTile({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  detail: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <TouchableOpacity
      style={[styles.tile, { backgroundColor: c.surface, borderColor: c.border }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${detail}`}
    >
      <Ionicons name={icon} size={19} color={c.textSecondary} />
      <Text style={[styles.tileLabel, { color: c.foreground }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.tileDetail, { color: c.textDim }]} numberOfLines={1}>{detail}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingBottom: 14 },
  greeting: { fontSize: 13.5 },
  name: { fontSize: 23, fontWeight: '800', marginTop: 1 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '800' },
  heroWrap: { paddingHorizontal: 20, marginTop: 14 },
  hero: { gap: 10 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  heroName: { fontSize: 18, fontWeight: '800' },
  heroClass: { fontSize: 13, marginTop: 2 },
  heroScoreBlock: { alignItems: 'flex-end' },
  heroScore: { fontSize: 30, fontWeight: '900' },
  heroScoreLabel: { fontSize: 11 },
  heroDivider: { height: 1, marginVertical: 2 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroMeta: { fontSize: 13, lineHeight: 18, flex: 1 },
  attentionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  attentionText: { fontSize: 12, fontWeight: '700' },
  pendingNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  pendingText: { fontSize: 12, flex: 1, lineHeight: 16 },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  periodRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  previewCard: { marginHorizontal: 20, marginBottom: 10 },
  tileRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  tile: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 13, gap: 5 },
  tileLabel: { fontSize: 13.5, fontWeight: '700' },
  tileDetail: { fontSize: 11.5 },
});
