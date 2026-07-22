import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import AuroraBackground from '@/components/AuroraBackground';
import { useApp } from '@/context/AppContext';
import { getGrade, getGradeColor } from '@/data/mockData';

const EXAM_TABS: { key: string; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'midterm', label: 'Midterm' },
  { key: 'final', label: 'Final' },
];

export default function ResultsScreen() {
  const { results, students } = useApp();
  const insets = useSafeAreaInsets();
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [activeTab, setActiveTab] = useState('monthly');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const studentResults = results.filter(r => r.studentId === selectedStudent);

  const filteredResults = useMemo(
    () => studentResults.filter(r => r.examType === activeTab),
    [studentResults, activeTab],
  );

  const hasResults = useMemo(
    () => EXAM_TABS.map(t => ({ key: t.key, count: studentResults.filter(r => r.examType === t.key).length })),
    [studentResults],
  );

  const activeCount = hasResults.find(h => h.key === activeTab)?.count ?? 0;

  const avg = activeCount > 0
    ? Math.round(filteredResults.reduce((s, r) => s + (r.score / r.total) * 100, 0) / activeCount)
    : 0;

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

        <View style={styles.studentRow}>
          {students.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[styles.studentBtn, selectedStudent === s.id && { borderColor: s.avatarColor, backgroundColor: `${s.avatarColor}22` }]}
              onPress={() => setSelectedStudent(s.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.studentBtnText, selectedStudent === s.id && { color: s.avatarColor }]}>
                {s.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.tabRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
            {EXAM_TABS.map(tab => {
              const count = hasResults.find(h => h.key === tab.key)?.count ?? 0;
              const isActive = activeTab === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, isActive && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
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

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}>
          {activeCount > 0 && (
            <LinearGradient colors={['#3D5AFE', '#00BCD4']} style={styles.avgCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.avgLabel}>Average Score</Text>
              <Text style={styles.avgValue}>{avg}%</Text>
              <Text style={styles.avgGrade}>{getGrade(avg, 100)}</Text>
            </LinearGradient>
          )}

          <Text style={styles.sectionTitle}>
            {activeCount > 0 ? `${EXAM_TABS.find(t => t.key === activeTab)?.label} Results` : `No ${activeTab} results`}
          </Text>

          {filteredResults.map(result => {
            const pct = Math.round((result.score / result.total) * 100);
            const color = getGradeColor(result.score, result.total);
            const monthLabel = result.month
              ? new Date(`2025-${result.month}-01`).toLocaleDateString('en-US', { month: 'short' })
              : '';
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
                    <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: color }]} />
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
                                <View style={[styles.compBarFill, { width: `${Math.round((comp.score / comp.total) * 100)}%` as any, backgroundColor: compColor }]} />
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
          {activeCount === 0 && (
            <View style={styles.empty}>
              <Ionicons name="document-outline" size={48} color="#4A5080" />
              <Text style={styles.emptyText}>No {EXAM_TABS.find(t => t.key === activeTab)?.label.toLowerCase()} results yet</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  studentRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginBottom: 4 },
  studentBtn: { flex: 1, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  studentBtnText: { fontSize: 14, fontWeight: '700', color: '#8892B0' },
  tabRow: { marginBottom: 16 },
  tabScroll: { paddingHorizontal: 20, gap: 8 },
  tab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(20,29,58,0.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', gap: 6 },
  tabActive: { backgroundColor: 'rgba(61,90,254,0.15)', borderColor: '#3D5AFE' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#8892B0' },
  tabLabelActive: { color: '#FFFFFF' },
  tabBadge: { borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 7, paddingVertical: 2 },
  tabBadgeActive: { backgroundColor: 'rgba(61,90,254,0.25)' },
  tabBadgeText: { fontSize: 11, fontWeight: '700', color: '#8892B0' },
  tabBadgeTextActive: { color: '#3D5AFE' },
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
  emptyText: { color: '#4A5080', fontSize: 15 },
  breakdown: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', gap: 8 },
  compRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compName: { fontSize: 11, color: '#8892B0', marginBottom: 4 },
  compBarTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2 },
  compBarFill: { height: 4, borderRadius: 2 },
  compMeta: { alignItems: 'flex-end', minWidth: 50 },
  compPct: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  compWeight: { fontSize: 10, color: '#4A5080' },
});
