import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import ChildrenSelector from '@/components/ChildrenSelector';
import TopBar from '@/components/TopBar';
import { EmptyState } from '@/components/StateViews';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const STATUS_COLOR = { present: '#1F9D55', absent: '#E0485F', late: '#C47F0B' } as const;
const STATUS_ICON = { present: 'checkmark-circle', absent: 'close-circle', late: 'time' } as const;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMonthDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

export default function AttendanceScreen() {
  const { attendance, students } = useApp();
  const c = useColors();
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  const safeSelectedStudent = students.some(s => s.id === selectedStudent) ? selectedStudent : students[0]?.id;

  const records = attendance.filter(a => a.studentId === safeSelectedStudent)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const present = records.filter(r => r.status === 'present').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const late = records.filter(r => r.status === 'late').length;
  const pct = records.length > 0 ? Math.round((present / records.length) * 100) : 0;

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, 'present' | 'absent' | 'late'>();
    for (const r of attendance.filter(a => a.studentId === safeSelectedStudent)) {
      map.set(r.date, r.status);
    }
    return map;
  }, [attendance, safeSelectedStudent]);

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

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <TopBar title="Attendance" />

        {students.length > 1 && (
          <View style={styles.studentRow}>
            <ChildrenSelector childrenList={students} selectedId={safeSelectedStudent} onSelect={setSelectedStudent} />
          </View>
        )}

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}>
          <View style={[styles.summaryCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={[styles.summaryCircle, { borderColor: c.border }]}>
              <Text style={[styles.summaryPct, { color: pct >= 80 ? '#1F9D55' : '#C47F0B' }]}>{pct > 0 ? `${pct}%` : '—'}</Text>
              <Text style={[styles.summaryPctLabel, { color: c.mutedForeground }]}>Attendance</Text>
            </View>
            <View style={{ flex: 1, gap: 10 }}>
              {[
                { status: 'present' as const, count: present },
                { status: 'absent' as const, count: absent },
                { status: 'late' as const, count: late },
              ].map(({ status, count }) => (
                <View key={status} style={styles.summaryRow}>
                  <Ionicons name={STATUS_ICON[status]} size={16} color={STATUS_COLOR[status]} />
                  <Text style={[styles.summaryLabel, { color: c.mutedForeground }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
                  <Text style={[styles.summaryCount, { color: STATUS_COLOR[status] }]}>{count}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.calendarCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={prevMonth} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={c.mutedForeground} />
              </TouchableOpacity>
              <Text style={[styles.calMonthLabel, { color: c.foreground }]}>{monthLabel}</Text>
              <TouchableOpacity onPress={nextMonth} activeOpacity={0.7}>
                <Ionicons name="chevron-forward" size={20} color={c.mutedForeground} />
              </TouchableOpacity>
            </View>
            <View style={styles.calDayHeaders}>
              {DAYS.map(d => <Text key={d} style={[styles.calDayHeader, { color: c.mutedForeground }]}>{d}</Text>)}
            </View>
            <View style={styles.calGrid}>
              {days.map((d, i) => {
                if (d === null) return <View key={`e-${i}`} style={styles.calCell} />;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const status = attendanceByDate.get(dateStr);
                const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                return (
                  <View key={dateStr} style={styles.calCell}>
                    <View style={[
                      styles.calDayCircle,
                      isToday && { borderColor: c.primary, borderWidth: 2 },
                      status === 'present' && { backgroundColor: 'rgba(46,204,113,0.25)', borderColor: '#2ECC71' },
                      status === 'absent' && { backgroundColor: 'rgba(255,83,112,0.25)', borderColor: '#FF5370' },
                      status === 'late' && { backgroundColor: 'rgba(245,158,11,0.25)', borderColor: '#F59E0B' },
                    ]}>
                      <Text style={[
                        styles.calDayText,
                        { color: c.foreground },
                        isToday && { color: c.primary, fontWeight: '800' },
                        status === 'present' && { color: '#2ECC71' },
                        status === 'absent' && { color: '#FF5370' },
                        status === 'late' && { color: '#F59E0B' },
                      ]}>{d}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Recent Records</Text>
          {records.slice(0, 10).map(rec => (
            <View key={rec.id} style={[styles.recRow, { borderBottomColor: c.border }]}>
              <View style={[styles.statusIcon, { backgroundColor: `${STATUS_COLOR[rec.status]}22` }]}>
                <Ionicons name={STATUS_ICON[rec.status]} size={20} color={STATUS_COLOR[rec.status]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.recDate, { color: c.foreground }]}>{new Date(rec.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
                {rec.note ? <Text style={[styles.recNote, { color: c.mutedForeground }]}>{rec.note}</Text> : null}
              </View>
              <Text style={[styles.recStatus, { color: STATUS_COLOR[rec.status] }]}>{rec.status}</Text>
            </View>
          ))}
          {records.length === 0 && (
            <EmptyState
              icon="calendar-outline"
              title="No attendance records yet"
              message="Daily attendance appears here once the school records it."
            />
          )}
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  studentRow: { paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { borderRadius: 18, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 20, marginBottom: 20, borderWidth: 1 },
  summaryCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  summaryPct: { fontSize: 22, fontWeight: '800' },
  summaryPctLabel: { fontSize: 9 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryLabel: { flex: 1, fontSize: 13 },
  summaryCount: { fontSize: 16, fontWeight: '700' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  recRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1 },
  statusIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recDate: { fontSize: 14, fontWeight: '600' },
  recNote: { fontSize: 12, marginTop: 2 },
  recStatus: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  calendarCard: { borderRadius: 18, padding: 16, marginBottom: 20, borderWidth: 1 },
  calHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  calMonthLabel: { fontSize: 16, fontWeight: '700' },
  calDayHeaders: { flexDirection: 'row', marginBottom: 8 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calDayCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  calDayText: { fontSize: 13, fontWeight: '600' },
});
