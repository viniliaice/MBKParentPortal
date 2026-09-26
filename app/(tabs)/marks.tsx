import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import ChildrenSelector from '@/components/ChildrenSelector';
import { EmptyState, LoadingView } from '@/components/StateViews';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

const EXAM_TABS = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'midterm', label: 'Midterm' },
  { key: 'final', label: 'Final' },
] as const;

type ExamType = 'monthly' | 'midterm' | 'final';
/**
 * Marks tab — the primary academic surface. Period (monthly/midterm/final) is
 * the only dimension beyond the child; academic years live in the deeper
 * reports screen, so parents never hunt through menus for their child's marks.
 */
export default function MarksScreen() {
  const { students, results, loading } = useApp();
  const params = useLocalSearchParams<{ examType?: string }>();
  const [selectedId, setSelectedId] = useState<string | undefined>(students[0]?.id);
  const [tab, setTab] = useState<ExamType>('monthly');

  useEffect(() => {
    if (params.examType && EXAM_TABS.some(t => t.key === params.examType)) {
      setTab(params.examType as ExamType);
    }
  }, [params.examType]);

  const safeSelectedId = students.some(s => s.id === selectedId) ? selectedId : students[0]?.id;
  const selected = students.find(s => s.id === safeSelectedId);

  if (loading) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1 }}>
          <ScreenHeader title="Marks & Reports" />
          <LoadingView />
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Marks & Reports" />

        {students.length > 1 && (
          <View style={styles.selectorWrap}>
            <ChildrenSelector childrenList={students} selectedId={safeSelectedId} onSelect={setSelectedId} />
          </View>
        )}

        <View style={styles.tabRow}>
          {EXAM_TABS.map(t => (
            <TabPill key={t.key} label={t.label} active={tab === t.key} onPress={() => setTab(t.key)} />
          ))}
        </View>

        <MarksList examType={tab} student={selected} />
      </View>
    </AuroraBackground>
  );
}

function ScreenHeader({ title }: { title: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[styles.header, { paddingTop: topPad + 12 }]}>
      <Text style={[styles.headerTitle, { color: c.foreground }]}>{title}</Text>
    </View>
  );
}

function TabPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      style={[
        styles.tabPill,
        { backgroundColor: active ? c.primary : c.card, borderColor: active ? c.primary : c.border },
      ]}
    >
      <Text style={[styles.tabPillText, { color: active ? '#FFFFFF' : c.foreground }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MarksList({ examType, student }: { examType: ExamType; student: { id: string; name: string; className: string; grade: string } | undefined }) {
  const { results, students } = useApp();
  const c = useColors();

  if (!student) {
    return (
      <EmptyState
        icon="people-outline"
        title="No children on this account yet"
        message="Your children's marks will appear here once your account is linked."
      />
    );
  }

  const thisStudent = students.find(s => s.id === student.id);
  const rows = results.filter(r => r.studentId === student.id && r.examType === examType);

  const avg = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.score / r.total) * 100, 0) / rows.length)
    : 0;

  const periodLabel = EXAM_TABS.find(t => t.key === examType)?.label ?? examType;

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 140 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.summaryWrap}>
        <View style={[styles.summaryCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.summaryName, { color: c.foreground }]} numberOfLines={1}>{student.name}</Text>
            <Text style={[styles.summaryClass, { color: c.mutedForeground }]} numberOfLines={1}>
              {thisStudent?.className ?? student.className}{' '}
              {thisStudent && thisStudent.grade !== thisStudent.className ? `· ${thisStudent.grade}` : ''}
            </Text>
            <Text style={[styles.summaryPeriod, { color: c.mutedForeground }]}>
              {periodLabel} {periodLabel === 'Monthly' ? 'reports' : 'results'}
            </Text>
          </View>
          <View style={styles.summaryRight}>
            <Text style={[styles.summaryAvgValue, { color: c.foreground }]}>{avg > 0 ? `${avg}%` : '—'}</Text>
            <Text style={[styles.summaryAvgLabel, { color: c.mutedForeground }]}>
              {rows.length > 0 ? `Across ${rows.length} subject${rows.length === 1 ? '' : 's'}` : 'No marks yet'}
            </Text>
          </View>
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={{ paddingHorizontal: 20 }}>
          <EmptyState
            icon="document-text-outline"
            title={`No ${periodLabel.toLowerCase()} marks yet`}
            message="Results appear here once teachers publish them. Nothing is missing because nothing has been entered for this period."
          />
        </View>
      ) : (
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          {rows.map(r => {
            const pct = Math.round((r.score / r.total) * 100);
            return (
              <View key={r.id} style={[styles.resultCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={styles.resultRow}>
                  <Text style={[styles.resultSubject, { color: c.foreground }]}>{r.subject}</Text>
                  <View style={[styles.gradePill, { backgroundColor: `${pctColor(pct)}22` }]}>
                    <Text style={[styles.gradeText, { color: pctColor(pct) }]}>
                      {gradeLetter(pct)} · {pct}%
                    </Text>
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: c.border }]}>
                  <View style={[styles.fill, { width: `${Math.min(pct, 100)}%`, backgroundColor: pctColor(pct) }]} />
                </View>
                <Text style={[styles.componentNote, { color: c.mutedForeground }]} numberOfLines={2}>
                  {componentNote(r.components, c.mutedForeground as string)}
                </Text>
              </View>
            );
          })}
          {examType === 'monthly' && (
            <Text style={[styles.method, { color: c.mutedForeground }]}>
              Monthly marks combine Continuous Assessment (homework, classwork and attendance — 40%) with the monthly quiz (60%).
            </Text>
          )}
          {(examType === 'midterm' || examType === 'final') && (
            <Text style={[styles.method, { color: c.mutedForeground }]}>
              {periodLabel} marks combine Continuous Assessment (40%) with the {periodLabel.toLowerCase()} exam (60%).
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function componentNote(components: { name: string; score: number; total: number; weight: number }[] | undefined | null, fallback: string): string {
  if (!components || components.length === 0) return '';
  return components
    .filter(comp => comp.weight > 0)
    .map(comp => `${comp.name.replace(/ \(.*\)/, '')} ${Math.round((comp.score / comp.total) * 100)}% (${comp.weight}%)`)
    .join(' · ');
}

function pctColor(pct: number) {
  if (pct >= 80) return '#1F9D55';
  if (pct >= 50) return '#C47F0B';
  return '#E0485F';
}

function gradeLetter(pct: number): string {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  selectorWrap: { paddingHorizontal: 20, marginBottom: 12 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  tabPill: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  tabPillText: { fontSize: 14, fontWeight: '700' },
  summaryWrap: { paddingHorizontal: 20, marginBottom: 16 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, padding: 16, gap: 12 },
  summaryName: { fontSize: 18, fontWeight: '800' },
  summaryClass: { fontSize: 13, marginTop: 2 },
  summaryPeriod: { fontSize: 12, marginTop: 4 },
  summaryRight: { alignItems: 'flex-end' },
  summaryAvgValue: { fontSize: 30, fontWeight: '900' },
  summaryAvgLabel: { fontSize: 11 },
  resultCard: { borderRadius: 16, borderWidth: 1, padding: 16 },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  resultSubject: { fontSize: 15, fontWeight: '700', flex: 1 },
  gradePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gradeText: { fontSize: 13, fontWeight: '800' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  fill: { height: 6, borderRadius: 3 },
  componentNote: { fontSize: 12, lineHeight: 17 },
  method: { fontSize: 12, lineHeight: 18, marginTop: 4 },
});
