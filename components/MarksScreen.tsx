import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { ChildSelector } from '@/components/ChildSelector';
import { MonthPillRow } from '@/components/MonthPillRow';
import { EmptyState } from '@/components/EmptyState';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SectionHeader } from '@/components/SectionHeader';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SubjectResultCard } from '@/components/SubjectResultCard';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { useTabBarSpacing } from '@/hooks/useScreenInsets';
import {
  ATTENTION_THRESHOLD,
  REPORT_PERIODS,
  reportAcademicYearKey,
  academicYearOptions,
  filterByMonth,
  filterByPeriod,
  filterByYear,
  gradeColorFor,
  isPeriod,
  latestMonthWithData,
  monthlyMonthCounts,
  pendingForView,
  monthPillStates,
  summarisePeriod,
  type ReportPeriod,
} from '@/lib/reportSelectors';

interface Props {
  /** Pushed from More/deep links: show a back affordance. The tab omits it. */
  showBack?: boolean;
}

/**
 * Marks — the second thing a parent reaches for, and the reason this app exists.
 *
 * One screen holds the whole flow: pick the child (or inherit the one chosen on the
 * dashboard), pick the report period, read the summary, then the subjects. The report
 * calculations are unchanged; this screen only chooses what to show and how to label
 * what is missing.
 */
export function MarksScreen({ showBack = false }: Props) {
  const c = useColors();
  const tabSpacing = useTabBarSpacing();
  const params = useLocalSearchParams<{ period?: string; student?: string; month?: string; year?: string }>();
  const {
    students, selectedStudent, setSelectedStudentId, results, pendingReports,
    academicYears, loading, error, refresh,
  } = useApp();

  const [period, setPeriod] = useState<ReportPeriod>(isPeriod(params.period) ? params.period : 'monthly');
  const [year, setYear] = useState(params.year ?? '');
  const [month, setMonth] = useState(params.month ?? '');
  const [refreshing, setRefreshing] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // A dashboard tile (or a notification) can land here on a specific period / child.
  useEffect(() => {
    if (isPeriod(params.period)) setPeriod(params.period);
  }, [params.period]);

  // A month pill on the dashboard opens that child's report for that month.
  useEffect(() => {
    if (params.month) setMonth(params.month);
  }, [params.month]);

  useEffect(() => {
    if (params.year) setYear(params.year);
  }, [params.year]);

  useEffect(() => {
    if (params.student && students.some(s => s.id === params.student)) {
      setSelectedStudentId(params.student);
    }
  }, [params.student, students, setSelectedStudentId]);

  const child = selectedStudent;
  const childId = child?.id ?? '';

  const childResults = useMemo(() => results.filter(r => r.studentId === childId), [results, childId]);

  const yearKeys = useMemo(
    () => academicYearOptions(childResults.map(r => reportAcademicYearKey(r)), academicYears.map(y => y.name)),
    [childResults, academicYears],
  );

  const currentYearKey = useMemo(() => {
    const current = academicYears.find(y => y.isCurrent);
    return current ? current.name.replace('/', '-') : '';
  }, [academicYears]);

  /** The academic years that actually carry results for the period on screen. */
  const yearsWithPeriodResults = useMemo(() => {
    const set = new Set<string>();
    for (const result of childResults) {
      if (result.examType !== period || !result.date) continue;
      const key = reportAcademicYearKey(result);
      if (key) set.add(key);
    }
    return set;
  }, [childResults, period]);

  /**
   * Default to the school's current academic year — but only while it has results for
   * the period being viewed. A parent who taps "Final" on Home follows a card that
   * showed a final average, so landing on the current year's empty final (the exam has
   * not been sat yet) would contradict the screen they came from.
   */
  useEffect(() => {
    if (year && yearKeys.includes(year) && (yearsWithPeriodResults.size === 0 || yearsWithPeriodResults.has(year))) return;
    if (yearKeys.length === 0) { setYear(''); return; }
    const newestWithResults = Array.from(yearsWithPeriodResults).sort().pop();
    if (newestWithResults && !yearsWithPeriodResults.has(year)) { setYear(newestWithResults); return; }
    const preferred = currentYearKey && yearKeys.includes(currentYearKey)
      ? currentYearKey
      : yearKeys[yearKeys.length - 1];
    setYear(preferred);
  }, [year, yearKeys, currentYearKey, yearsWithPeriodResults]);

  const yearResults = useMemo(() => filterByYear(childResults, year), [childResults, year]);
  const periodResults = useMemo(() => filterByPeriod(yearResults, period), [yearResults, period]);
  const monthCounts = useMemo(() => monthlyMonthCounts(periodResults), [periodResults]);

  // Open on the newest month that actually has marks — no empty screen to hunt through.
  useEffect(() => {
    if (period !== 'monthly') return;
    if (month && (monthCounts.get(month) ?? 0) > 0) return;
    setMonth(latestMonthWithData(periodResults) ?? '');
  }, [period, month, monthCounts, periodResults]);

  const displayResults = useMemo(
    () => (period === 'monthly' ? filterByMonth(periodResults, month, year) : periodResults),
    [period, periodResults, month, year],
  );

  const summary = useMemo(() => summarisePeriod(displayResults), [displayResults]);

  const pendingInView = useMemo(
    () => pendingForView(
      pendingReports.filter(p => p.studentId === childId),
      period,
      { month, yearKey: year },
    ),
    [pendingReports, childId, period, month, year],
  );

  const yearIndex = yearKeys.indexOf(year);
  const prevYear = yearIndex > 0 ? yearKeys[yearIndex - 1] : null;
  const nextYear = yearIndex >= 0 && yearIndex < yearKeys.length - 1 ? yearKeys[yearIndex + 1] : null;

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

  const periodCounts = useMemo(
    () => REPORT_PERIODS.map(p => ({
      key: p.key,
      label: p.label,
      count: filterByPeriod(yearResults, p.key).length,
    })),
    [yearResults],
  );

  /**
   * The months of the year on screen that carry marks, as pills. Pinned to `year` rather
   * than left to pick the newest year, because here they are the control — they have to
   * follow the year the parent has chosen, not lead it.
   */
  const monthPills = useMemo(
    () => monthPillStates(childResults, childId, { yearKey: year, fallbackYearKey: currentYearKey }),
    [childResults, childId, year, currentYearKey],
  );

  const averageTone = { success: c.accent, warning: c.warning, danger: c.destructive };
  const hasMonthlyData = monthCounts.size > 0;

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpacing + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />
        }
      >
        <ScreenHeader
          title="Marks"
          size={showBack ? 'screen' : 'tab'}
          subtitle={child ? `${child.name} · ${child.grade}` : undefined}
          onBack={showBack ? () => router.back() : undefined}
        />

        <ChildSelector dense />

        {loading && students.length === 0 ? (
          <View style={{ marginTop: 16 }}>
            <LoadingState blocks={3} />
          </View>
        ) : error && students.length === 0 ? (
          <View style={{ marginTop: 16 }}>
            <ErrorState message={error} onRetry={onRetry} retrying={retrying} />
          </View>
        ) : students.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No children linked yet"
            message="Marks appear here once the school office links your children to your account."
          />
        ) : (
          <>
            {yearKeys.length > 1 ? (
              <View style={styles.yearRow}>
                <TouchableOpacity
                  onPress={() => prevYear && setYear(prevYear)}
                  disabled={!prevYear}
                  style={[styles.yearArrow, { backgroundColor: c.surfaceMuted, opacity: prevYear ? 1 : 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous academic year"
                >
                  <Ionicons name="chevron-back" size={16} color={c.foreground} />
                </TouchableOpacity>
                <Text style={[styles.yearLabel, { color: c.foreground }]}>
                  {year ? `Academic year ${year}` : 'All results'}
                </Text>
                <TouchableOpacity
                  onPress={() => nextYear && setYear(nextYear)}
                  disabled={!nextYear}
                  style={[styles.yearArrow, { backgroundColor: c.surfaceMuted, opacity: nextYear ? 1 : 0.4 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Next academic year"
                >
                  <Ionicons name="chevron-forward" size={16} color={c.foreground} />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Pills rather than equal thirds: with a two-digit subject count the three
                periods do not fit a small phone, and the labels truncate. */}
            <SegmentedControl
              scrollable
              options={periodCounts.map(p => ({ key: p.key, label: p.label, count: p.count }))}
              value={period}
              onChange={key => { setPeriod(key); setMonth(''); }}
            />

            {/* The month control: one pill per month this child has marks for, the open
                month filled. Bigger than the dashboard's — here it is what gets tapped. */}
            {period === 'monthly' ? (
              <View style={styles.monthRow}>
                <MonthPillRow
                  months={monthPills.months}
                  onSelect={pill => setMonth(pill.academicMonth)}
                  size="roomy"
                  selectable
                  activeMonth={month}
                  activeYearKey={year}
                />
              </View>
            ) : null}

            {displayResults.length > 0 ? (
              <View style={styles.summaryWrap}>
                <Card style={styles.summaryCard}>
                  <View style={styles.summaryTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryLabel, { color: c.textSecondary }]}>
                        {period === 'monthly'
                          ? `${month} average`
                          : period === 'midterm' ? 'Midterm average' : 'Final average'}
                      </Text>
                      <Text
                        style={[styles.summaryValue, { color: gradeColorFor(summary.averagePct, 100, averageTone) }]}
                      >
                        {summary.averagePct}%
                      </Text>
                      <Text style={[styles.summaryMeta, { color: c.textSecondary }]}>
                        {summary.count} subject{summary.count === 1 ? '' : 's'} · grade {summary.grade}
                      </Text>
                    </View>
                    {summary.strongest ? (
                      <View style={[styles.strongBox, { backgroundColor: c.primarySoft }]}>
                        <Ionicons name="trending-up" size={15} color={c.primary} />
                        <Text style={[styles.strongLabel, { color: c.primary }]}>Strongest</Text>
                        <Text style={[styles.strongSubject, { color: c.primary }]} numberOfLines={2}>
                          {summary.strongest.subject}
                        </Text>
                        <Text style={[styles.strongPct, { color: c.primary }]}>{summary.strongest.pct}%</Text>
                      </View>
                    ) : null}
                  </View>

                  {summary.attention.length > 0 ? (
                    <View style={[styles.attentionBlock, { borderTopColor: c.border }]}>
                      <Text style={[styles.blockTitle, { color: c.warning }]}>Needs attention</Text>
                      {summary.attention.map(item => (
                        <View key={item.subject} style={styles.attentionRow}>
                          <Ionicons name="alert-circle-outline" size={15} color={c.warning} />
                          <Text style={[styles.attentionSubject, { color: c.textBody }]} numberOfLines={1}>{item.subject}</Text>
                          <Text style={[styles.attentionPct, { color: c.warning }]}>{item.pct}%</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={[styles.attentionBlock, { borderTopColor: c.border }]}>
                      <View style={styles.attentionRow}>
                        <Ionicons name="checkmark-circle-outline" size={15} color={c.accent} />
                        <Text style={[styles.attentionSubject, { color: c.accent }]}>
                          Every subject is at or above {ATTENTION_THRESHOLD}%
                        </Text>
                      </View>
                    </View>
                  )}

                  {pendingInView.length > 0 ? (
                    <View style={[styles.attentionBlock, { borderTopColor: c.border }]}>
                      <Text style={[styles.blockTitle, { color: c.textSecondary }]}>Not published yet</Text>
                      {pendingInView.map(item => (
                        <View key={item.id} style={styles.attentionRow}>
                          <Ionicons name="time-outline" size={15} color={c.textDim} />
                          <Text style={[styles.attentionSubject, { color: c.textSecondary }]} numberOfLines={2}>
                            {item.subject} — waiting for {item.missing.join(' and ')}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Card>
              </View>
            ) : null}

            <SectionHeader
              title={
                period === 'monthly'
                  ? month ? `${month} subjects` : 'Subjects'
                  : period === 'midterm' ? 'Midterm subjects' : 'Final subjects'
              }
              style={{ marginTop: 18 }}
            />

            {displayResults.length > 0 ? (
              <View style={styles.results}>
                {displayResults.map(result => (
                  <SubjectResultCard key={result.id} result={result} />
                ))}
              </View>
            ) : (
              <EmptyState
                icon="document-text-outline"
                title={
                  childResults.length === 0
                    ? 'No marks published yet'
                    : period === 'monthly'
                      ? hasMonthlyData ? 'No monthly report for this month' : 'No monthly reports yet'
                      : `No ${period} report yet`
                }
                message={
                  childResults.length === 0
                    ? 'Marks appear here as soon as teachers publish them.'
                    : 'This report is not available yet. It will appear here once the school publishes it.'
                }
              />
            )}

            {displayResults.length === 0 && pendingInView.length > 0 ? (
              <View style={styles.results}>
                <Card>
                  <Text style={[styles.blockTitle, { color: c.textSecondary }]}>Being published</Text>
                  {pendingInView.map(item => (
                    <View key={item.id} style={styles.attentionRow}>
                      <Ionicons name="time-outline" size={15} color={c.textDim} />
                      <Text style={[styles.attentionSubject, { color: c.textSecondary }]} numberOfLines={2}>
                        {item.subject} — waiting for {item.missing.join(' and ')}
                      </Text>
                    </View>
                  ))}
                </Card>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8 },
  yearArrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 13.5, fontWeight: '700', minWidth: 150, textAlign: 'center' },
  monthRow: { paddingHorizontal: 20, marginTop: 14 },
  summaryWrap: { paddingHorizontal: 20, marginTop: 14 },
  summaryCard: { gap: 12 },
  summaryTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryLabel: { fontSize: 12.5 },
  summaryValue: { fontSize: 38, fontWeight: '900', marginVertical: 2 },
  summaryMeta: { fontSize: 12.5 },
  strongBox: { borderRadius: 14, padding: 12, alignItems: 'flex-start', gap: 2, maxWidth: 128 },
  strongLabel: { fontSize: 11, fontWeight: '700' },
  strongSubject: { fontSize: 13, fontWeight: '700' },
  strongPct: { fontSize: 14, fontWeight: '800' },
  attentionBlock: { borderTopWidth: 1, paddingTop: 10, gap: 8 },
  blockTitle: { fontSize: 11.5, fontWeight: '800', letterSpacing: 0.4 },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attentionSubject: { fontSize: 12.5, flex: 1, lineHeight: 17 },
  attentionPct: { fontSize: 12.5, fontWeight: '800' },
  results: { paddingHorizontal: 20 },
});
