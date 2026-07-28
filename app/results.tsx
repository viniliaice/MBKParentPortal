import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Animated, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AuroraBackground from '@/components/AuroraBackground';
import StudentSelector from '@/components/StudentSelector';
import { useApp } from '@/context/AppContext';
import { supabase, type SupabaseAcademicYear } from '@/lib/supabase';
import { getGrade, getGradeColor } from '@/data/mockData';

const EXAM_TABS: { key: string; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'midterm', label: 'Midterm' },
  { key: 'final', label: 'Final' },
];

const ACADEMIC_YEAR_MONTHS = [
  'Sep', 'Oct', 'Nov', 'Dec',
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
];

function getAcademicYear(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = d.getMonth();
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getYearFromDate(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

function getMonthIndex(dateStr: string): number {
  return new Date(dateStr).getMonth();
}

function LoadingSkeleton() {
  const fadeAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [fadeAnim]);

  const BGO = 'rgba(255,255,255,0.06)';

  return (
    <Animated.View style={{ padding: 20, opacity: fadeAnim }}>
      <View style={{ height: 120, borderRadius: 20, backgroundColor: BGO }} />
      <View style={{ height: 12 }} />
      <View style={{ height: 16, width: 120, borderRadius: 4, backgroundColor: BGO }} />
      <View style={{ height: 12 }} />
      {[1, 2, 3].map(i => (
        <View key={i} style={styles.resultCard}>
          <View style={{ height: 16, width: '60%', borderRadius: 4, backgroundColor: BGO }} />
          <View style={{ height: 8 }} />
          <View style={{ height: 6, borderRadius: 3, backgroundColor: BGO }} />
          <View style={{ height: 8 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ height: 12, width: 60, borderRadius: 4, backgroundColor: BGO }} />
            <View style={{ height: 12, width: 40, borderRadius: 4, backgroundColor: BGO }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}

export default function ResultsScreen() {
  const { results, students, loading } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [activeTab, setActiveTab] = useState('monthly');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [academicYearRows, setAcademicYearRows] = useState<SupabaseAcademicYear[]>([]);

  useEffect(() => {
    supabase.from('academic_years').select('*').order('startDate', { ascending: false }).then(({ data }) => {
      if (data) setAcademicYearRows(data as SupabaseAcademicYear[]);
    });
  }, []);

  function yearNameToKey(name: string): string {
    return name.replace('/', '-');
  }

  const currentYearKey = useMemo(() => {
    const cur = academicYearRows.find(r => r.isCurrent);
    return cur ? yearNameToKey(cur.name) : '';
  }, [academicYearRows]);

  const studentResults = useMemo(
    () => results.filter(r => r.studentId === selectedStudent),
    [results, selectedStudent],
  );

  const academicYears = useMemo(() => {
    const years = new Set<string>();
    for (const r of studentResults) {
      if (r.date) years.add(getAcademicYear(r.date));
    }
    for (const r of academicYearRows) {
      years.add(yearNameToKey(r.name));
    }
    return Array.from(years).sort();
  }, [studentResults, academicYearRows]);

  const [selectedYear, setSelectedYear] = useState('');

  useEffect(() => {
    if (!selectedYear && currentYearKey) {
      setSelectedYear(currentYearKey);
    }
  }, [currentYearKey]);

  const yearIndex = academicYears.indexOf(selectedYear);
  const prevYear = yearIndex > 0 ? academicYears[yearIndex - 1] : null;
  const nextYear = yearIndex < academicYears.length - 1 ? academicYears[yearIndex + 1] : null;

  const yearFilteredResults = useMemo(() => {
    if (!selectedYear) return studentResults;
    return studentResults.filter(r => r.date && getAcademicYear(r.date) === selectedYear);
  }, [studentResults, selectedYear]);

  const filteredResults = useMemo(
    () => yearFilteredResults.filter(r => r.examType === activeTab),
    [yearFilteredResults, activeTab],
  );

  const hasResults = useMemo(
    () => EXAM_TABS.map(t => ({
      key: t.key,
      count: yearFilteredResults.filter(r => r.examType === t.key).length,
    })),
    [yearFilteredResults],
  );

  const activeCount = hasResults.find(h => h.key === activeTab)?.count ?? 0;

  const avg = activeCount > 0
    ? Math.round(filteredResults.reduce((s, r) => s + (r.score / r.total) * 100, 0) / activeCount)
    : 0;

  const [selectedMonth, setSelectedMonth] = useState('');

  const monthResultCount = useMemo(() => {
    if (activeTab !== 'monthly') return 0;
    if (!selectedMonth) return filteredResults.length;
    const acadIdx = ACADEMIC_YEAR_MONTHS.indexOf(selectedMonth);
    const calMonth = acadIdx < 4 ? acadIdx + 8 : acadIdx - 4;
    let calYear = parseInt(selectedYear.split('-')[0]);
    if (acadIdx >= 4) calYear = parseInt(selectedYear.split('-')[1]);
    const hasYear = selectedYear !== '';
    return filteredResults.filter(r => {
      if (!r.date) return false;
      return getMonthIndex(r.date) === calMonth && (!hasYear || getYearFromDate(r.date) === calYear);
    }).length;
  }, [filteredResults, activeTab, selectedMonth, selectedYear]);

  const monthCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of yearFilteredResults) {
      if (r.examType === 'monthly' && r.date) {
        const m = getMonthIndex(r.date);
        const acadIdx = m >= 8 ? m - 8 : m + 4;
        const label = ACADEMIC_YEAR_MONTHS[acadIdx];
        map.set(label, (map.get(label) || 0) + 1);
      }
    }
    return map;
  }, [yearFilteredResults]);

  const monthFilteredResults = useMemo(() => {
    if (activeTab !== 'monthly') return filteredResults;
    if (!selectedMonth) return [];
    const acadIdx = ACADEMIC_YEAR_MONTHS.indexOf(selectedMonth);
    const calMonth = acadIdx < 4 ? acadIdx + 8 : acadIdx - 4;
    let calYear = parseInt(selectedYear.split('-')[0]);
    if (acadIdx >= 4) calYear = parseInt(selectedYear.split('-')[1]);
    const hasYear = selectedYear !== '';
    return filteredResults.filter(r => {
      if (!r.date) return false;
      return getMonthIndex(r.date) === calMonth && (!hasYear || getYearFromDate(r.date) === calYear);
    });
  }, [filteredResults, activeTab, selectedMonth, selectedYear]);

  const displayResults = activeTab === 'monthly' ? monthFilteredResults : filteredResults;

  const displayAvg = activeTab === 'monthly' && selectedMonth
    ? (monthResultCount > 0
        ? Math.round(monthFilteredResults.reduce((s, r) => s + (r.score / r.total) * 100, 0) / monthResultCount)
        : 0)
    : activeTab === 'monthly' ? 0 : avg;

  const getMonthLabel = (dateStr: string, monthStr: string) => {
    if (!monthStr) return '';
    try {
      if (dateStr) {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      return new Date(`2025-${monthStr}-01`).toLocaleDateString('en-US', { month: 'short' });
    } catch {
      return '';
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(r => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  const pctStr = (pct: number) => `${pct}%` as const;

  if (!loading && students.length === 0) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { paddingTop: topPad + 12 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Academic Results</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={48} color="#4A5080" />
            <Text style={styles.emptyText}>Unable to load student data.</Text>
            <Text style={{ color: '#4A5080', fontSize: 13, textAlign: 'center', marginTop: 4 }}>Please check your connection and try again.</Text>
          </View>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Academic Results</Text>
          <View style={{ width: 36 }} />
        </View>

        <StudentSelector
          students={students}
          selectedId={selectedStudent}
          fullName
          style={{ marginBottom: 4 }}
          onSelect={id => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setSelectedStudent(id); }}
        />

        {loading ? (
          <LoadingSkeleton />
        ) : (
          <>
        {academicYears.length > 0 && (
          <View style={styles.yearRow}>
            <TouchableOpacity
              onPress={() => { if (prevYear) { setSelectedYear(prevYear); setSelectedMonth(''); } }}
              disabled={!prevYear}
              style={[styles.yearArrow, !prevYear && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-back" size={18} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.yearLabel}>{selectedYear || academicYears[academicYears.length - 1]}</Text>
            <TouchableOpacity
              onPress={() => { if (nextYear) { setSelectedYear(nextYear); setSelectedMonth(''); } }}
              disabled={!nextYear}
              style={[styles.yearArrow, !nextYear && { opacity: 0.3 }]}
            >
              <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {EXAM_TABS.map(tab => {
              const count = hasResults.find(h => h.key === tab.key)?.count ?? 0;
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => { setActiveTab(tab.key); setSelectedMonth(''); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {tab.label}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, isActive && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, isActive && styles.tabBadgeTextActive]}>
                        {count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {activeTab === 'monthly' && ACADEMIC_YEAR_MONTHS.some(m => (monthCountMap.get(m) ?? 0) > 0) && (
          <View style={styles.monthRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthScroll}>
              {ACADEMIC_YEAR_MONTHS.filter(m => (monthCountMap.get(m) ?? 0) > 0).map(m => {
                const count = monthCountMap.get(m) ?? 0;
                const isSelected = selectedMonth === m;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.monthBtn,
                      styles.monthBtnHasData,
                      isSelected && styles.monthBtnActive,
                    ]}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedMonth(isSelected ? '' : m);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.monthLabel,
                      styles.monthLabelHasData,
                      isSelected && styles.monthLabelActive,
                    ]}>{m}</Text>
                    <View style={styles.monthBadge}>
                      <Text style={styles.monthBadgeText}>{count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8892B0" />}
        >
          {displayAvg > 0 && (
            <LinearGradient colors={['#3D5AFE', '#00BCD4']} style={styles.avgCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={styles.avgValue}>{displayAvg}%</Text>
              <Text style={styles.avgGrade}>{getGrade(displayAvg, 100)}</Text>
            </LinearGradient>
          )}

          <Text style={styles.sectionTitle}>
            {displayResults.length > 0
              ? `${EXAM_TABS.find(t => t.key === activeTab)?.label} Results`
              : `No ${activeTab} results`}
          </Text>

          {displayResults.map(result => {
            const pct = Math.round((result.score / result.total) * 100);
            const color = getGradeColor(result.score, result.total);
            const monthLabel = getMonthLabel(result.date, result.month);
            return (
              <View key={result.id} style={styles.resultCard}>
                <View style={{ flex: 1 }}>
                  <View style={styles.resultHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultSubject}>{result.subject}</Text>
                      {monthLabel !== '' && (
                        <Text style={styles.resultMonth}>{monthLabel}</Text>
                      )}
                    </View>
                    <View style={[styles.gradePill, { backgroundColor: `${color}22` }]}>
                      <Text style={[styles.gradeText, { color }]}>{getGrade(result.score, result.total)}</Text>
                    </View>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: pctStr(pct), backgroundColor: color }]} />
                  </View>
                  <View style={styles.resultMeta}>
                    <Text style={styles.resultScore}>{result.score}/{result.total}</Text>
                    <Text style={[styles.resultPct, { color }]}>{pct}%</Text>
                  </View>
                  {result.components && result.components.length > 0 && (
                    <View style={styles.breakdown}>
                      {result.components.map((comp, ci) => {
                        const compColor = getGradeColor(comp.score, comp.total);
                        return (
                          <View key={ci} style={styles.compRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.compName} numberOfLines={1}>{comp.name}</Text>
                              <View style={styles.compBarTrack}>
                                <View style={[styles.compBarFill, { width: pctStr(Math.round((comp.score / comp.total) * 100)), backgroundColor: compColor }]} />
                              </View>
                            </View>
                            <View style={styles.compMeta}>
                              <Text style={styles.compPct}>{Math.round((comp.score / comp.total) * 100)}%</Text>
                              <Text style={styles.compWeight}>×{comp.weight}%</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
          {displayResults.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color="#4A5080" />
              <Text style={styles.emptyText}>
                {activeTab === 'monthly' && !selectedMonth
                  ? 'Select a month above to view results'
                  : activeTab === 'monthly' && selectedMonth
                    ? `No monthly results in ${selectedMonth}${selectedYear ? ` for ${selectedYear}` : ''}`
                    : `No ${EXAM_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} results${selectedYear ? ` for ${selectedYear}` : ''}`
                }
              </Text>
              <Text style={{ color: '#4A5080', fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: 40 }}>
                Results appear here once exams are graded and published by teachers.
              </Text>
            </View>
          )}
        </ScrollView>
          </>
        )}
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  yearRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 20 },
  yearArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  yearLabel: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', minWidth: 90, textAlign: 'center' },
  tabRow: { marginBottom: 8 },
  tabScroll: { paddingHorizontal: 20, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(20,29,58,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 6 },
  tabActive: { backgroundColor: 'rgba(61,90,254,0.15)', borderColor: '#3D5AFE' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#8892B0' },
  tabLabelActive: { color: '#FFFFFF' },
  tabBadge: { borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeActive: { backgroundColor: 'rgba(61,90,254,0.25)' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#8892B0' },
  tabBadgeTextActive: { color: '#3D5AFE' },
  monthRow: { marginBottom: 12 },
  monthScroll: { paddingHorizontal: 20, gap: 8 },
  monthBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(20,29,58,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 6 },
  monthBtnHasData: { backgroundColor: 'rgba(20,29,58,0.9)', borderColor: 'rgba(255,255,255,0.1)' },
  monthBtnActive: { backgroundColor: 'rgba(61,90,254,0.15)', borderColor: '#3D5AFE' },
  monthLabel: { fontSize: 14, fontWeight: '600', color: '#4A5080' },
  monthLabelHasData: { color: '#CCCCDD' },
  monthLabelActive: { color: '#FFFFFF' },
  monthLabelDim: { color: '#2A2F50', fontSize: 13 },
  monthBadge: { borderRadius: 8, backgroundColor: 'rgba(61,90,254,0.2)', paddingHorizontal: 8, paddingVertical: 2 },
  monthBadgeText: { fontSize: 11, fontWeight: '700', color: '#3D5AFE' },
  avgCard: { borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 20 },
  avgLabel: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  avgValue: { fontSize: 48, fontWeight: '900', color: '#FFFFFF' },
  avgGrade: { fontSize: 18, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#8892B0', marginBottom: 12, letterSpacing: 0.5 },
  resultCard: { backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  resultSubject: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  resultMonth: { fontSize: 11, color: '#4A5080', marginTop: 2 },
  gradePill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  gradeText: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 8 },
  progressFill: { height: 6, borderRadius: 3 },
  resultMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  resultScore: { fontSize: 12, color: '#8892B0' },
  resultPct: { fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: '#4A5080', fontSize: 15, textAlign: 'center' },
  breakdown: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 8 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compName: { fontSize: 11, color: '#8892B0', marginBottom: 4 },
  compBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 },
  compBarFill: { height: 4, borderRadius: 2 },
  compMeta: { alignItems: 'flex-end', minWidth: 50 },
  compPct: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  compWeight: { fontSize: 10, color: '#4A5080' },
});
