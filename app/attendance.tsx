import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { ChildSelector } from '@/components/ChildSelector';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import type { Colors } from '@/hooks/useColors';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function statusTones(c: Colors) {
  return { present: c.accent, absent: c.destructive, late: c.warning } as const;
}

const STATUS_ICON = { present: 'checkmark-circle', absent: 'close-circle', late: 'time' } as const;

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function AttendanceScreen() {
  const { attendance, students, selectedStudent, refresh } = useApp();
  const c = useColors();
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [refreshing, setRefreshing] = useState(false);

  const tones = statusTones(c);
  // The child chosen on the dashboard/marks is the child shown here too.
  const records = useMemo(
    () => attendance
      .filter(a => a.studentId === selectedStudent?.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [attendance, selectedStudent?.id],
  );

  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const pct = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'late'>();
    for (const r of records) map.set(r.date, r.status);
    return map;
  }, [records]);

  const days = getMonthDays(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();

  const prevMonth = () => {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11); }
    else setCalMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0); }
    else setCalMonth(m => m + 1);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Attendance"
          onBack={() => router.back()}
          subtitle={selectedStudent ? `${selectedStudent.name} · ${selectedStudent.grade}` : undefined}
        />

        <ChildSelector />

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
          }
        >
          {students.length === 0 ? (
            <EmptyState
              icon="people-outline"
              title="No children linked yet"
              message="Attendance appears here once the school office links your children to your account."
            />
          ) : records.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="No attendance recorded yet"
              message="Daily attendance for this child will appear here."
            />
          ) : (
            <>
              <Card style={styles.summaryCard}>
                <View style={[styles.summaryCircle, { borderColor: c.border, backgroundColor: c.surfaceMuted }]}>
                  <Text style={[styles.summaryPct, { color: pct >= 80 ? c.accent : c.warning }]}>{pct}%</Text>
                  <Text style={[styles.summaryPctLabel, { color: c.textSecondary }]}>attendance</Text>
                </View>
                <View style={{ flex: 1, gap: 10 }}>
                  {([
                    { status: 'present' as const, count: present },
                    { status: 'absent' as const, count: absent },
                    { status: 'late' as const, count: late },
                  ]).map(({ status, count }) => (
                    <View key={status} style={styles.summaryRow}>
                      <Ionicons name={STATUS_ICON[status]} size={16} color={tones[status]} />
                      <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                      <Text style={[styles.summaryCount, { color: tones[status] }]}>{count}</Text>
                    </View>
                  ))}
                </View>
              </Card>

              <Card style={styles.calendarCard}>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={prevMonth} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Previous month">
                    <Ionicons name="chevron-back" size={20} color={c.textSecondary} />
                  </TouchableOpacity>
                  <Text style={[styles.calMonthLabel, { color: c.foreground }]}>{monthLabel}</Text>
                  <TouchableOpacity onPress={nextMonth} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Next month">
                    <Ionicons name="chevron-forward" size={20} color={c.textSecondary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.calDayHeaders}>
                  {DAYS.map(d => <Text key={d} style={[styles.calDayHeader, { color: c.textDim }]}>{d}</Text>)}
                </View>
                <View style={styles.calGrid}>
                  {days.map((d, i) => {
                    if (d === null) return <View key={`e-${i}`} style={styles.calCell} />;
                    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                    const status = attendanceByDate.get(dateStr);
                    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                    return (
                      <View key={dateStr} style={styles.calCell}>
                        <View
                          style={[
                            styles.calDayCircle,
                            isToday && { borderColor: c.primary, borderWidth: 2 },
                            status === 'present' && { borderColor: c.accent, borderWidth: 1.5 },
                            status === 'absent' && { borderColor: c.destructive, borderWidth: 1.5 },
                            status === 'late' && { borderColor: c.warning, borderWidth: 1.5 },
                          ]}
                        >
                          <Text
                            style={[
                              styles.calDayText,
                              { color: c.textBody },
                              isToday && { color: c.primary, fontWeight: '800' },
                              status === 'present' && { color: c.accent },
                              status === 'absent' && { color: c.destructive },
                              status === 'late' && { color: c.warning },
                            ]}
                          >
                            {d}
                          </Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </Card>

              <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Recent records</Text>
              {records.slice(0, 10).map(rec => (
                <View key={rec.id} style={[styles.recRow, { borderBottomColor: c.border }]}>
                  <View style={[styles.statusIcon, { backgroundColor: c.surfaceMuted }]}>
                    <Ionicons name={STATUS_ICON[rec.status]} size={20} color={tones[rec.status]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recDate, { color: c.foreground }]}>
                      {new Date(rec.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    {rec.note ? <Text style={[styles.recNote, { color: c.textSecondary }]}>{rec.note}</Text> : null}
                  </View>
                  <Text style={[styles.recStatus, { color: tones[rec.status] }]}>{rec.status}</Text>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20 },
  summaryCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  summaryPct: { fontSize: 22, fontWeight: '800' },
  summaryPctLabel: { fontSize: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { flex: 1, fontSize: 13 },
  summaryCount: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 10, marginTop: 4 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  statusIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recDate: { fontSize: 14, fontWeight: '600' },
  recNote: { fontSize: 12, marginTop: 2 },
  recStatus: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  calendarCard: { marginBottom: 20, gap: 4 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calMonthLabel: { fontSize: 16, fontWeight: '700' },
  calDayHeaders: { flexDirection: 'row', marginBottom: 6 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  calDayText: { fontSize: 13, fontWeight: '600' },
});
