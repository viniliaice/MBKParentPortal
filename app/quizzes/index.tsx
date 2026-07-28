import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import StudentSelector from '@/components/StudentSelector';
import { supabase, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

type QuizWithCount = Quiz & { question_count: number };

export default function QuizListScreen() {
  const { students } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [quizzes, setQuizzes] = useState<QuizWithCount[]>([]);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const student = students.find(s => s.id === selectedStudent);

  const fetchQuizzes = useCallback(async () => {
    if (!student) return;
    const now = new Date().toISOString();
    const { data: qData } = await supabase
      .from('quizzes')
      .select('*')
      .eq('className', student.className)
      .eq('status', 'active')
      .lte('openDate', now)
      .gte('dueDate', now);

    if (qData) {
      const quizIds = (qData as Quiz[]).map(q => q.id);
      const { data: countData } = quizIds.length > 0
        ? await supabase.from('quiz_questions').select('quizId').in('quizId', quizIds)
        : { data: null };

      const countMap = new Map<string, number>();
      if (countData) {
        for (const c of countData) {
          countMap.set(c.quizId, (countMap.get(c.quizId) || 0) + 1);
        }
      }

      setQuizzes((qData as Quiz[]).map(q => ({
        ...q,
        question_count: countMap.get(q.id) || 0,
      })));
    }

    if (selectedStudent) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quizId')
        .eq('studentId', selectedStudent);
      if (attempts) {
        setAttemptedQuizIds(new Set(attempts.map(a => a.quizId)));
      }
    }

    setLoading(false);
  }, [student, selectedStudent]);

  useEffect(() => {
    setLoading(true);
    fetchQuizzes();
  }, [fetchQuizzes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQuizzes();
    setRefreshing(false);
  };

  const activeStudent = students.find(s => s.id === selectedStudent);

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quizzes</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={() => router.push('/(tabs)/learning')} style={styles.studyBtn}>
              <Ionicons name="school-outline" size={18} color="#F59E0B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/quizzes/history')} style={styles.historyBtn}>
              <Ionicons name="time-outline" size={18} color="#8892B0" />
            </TouchableOpacity>
          </View>
        </View>

        <StudentSelector students={students} selectedId={selectedStudent} onSelect={setSelectedStudent} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#3D5AFE" /></View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AFE" />}
          >
            {activeStudent && (
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={16} color="#8892B0" />
                <Text style={styles.infoText}>{activeStudent.className}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>
              {quizzes.length > 0 ? `${quizzes.length} Active Quiz${quizzes.length !== 1 ? 'zes' : ''}` : 'No Active Quizzes'}
            </Text>

            {quizzes.map(q => {
              const attempted = attemptedQuizIds.has(q.id);
              return attempted ? (
                <View key={q.id} style={[styles.quizCard, styles.quizCardDone]}>
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, styles.quizBadgeDone]}>
                      <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
                      <Text style={[styles.quizBadgeText, { color: '#2ECC71' }]}>Completed</Text>
                    </View>
                  </View>
                  <Text style={[styles.quizTitle, styles.textMuted]}>{q.title}</Text>
                  <View style={styles.quizMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="document-text-outline" size={13} color="#8892B0" />
                      <Text style={styles.metaText}>{q.question_count} question{q.question_count !== 1 ? 's' : ''}</Text>
                    </View>
                    {q.timeLimit ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="timer-outline" size={13} color="#8892B0" />
                        <Text style={styles.metaText}>{q.timeLimit} min</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color="#8892B0" />
                      <Text style={styles.metaText}>
                        Due {new Date(q.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.viewResultsBtn}
                    onPress={async () => {
                      try {
                        const { data } = await supabase
                          .from('quiz_attempts')
                          .select('id')
                          .eq('quizId', q.id)
                          .eq('studentId', selectedStudent)
                          .maybeSingle();
                        if (data) router.push({ pathname: '/quizzes/results', params: { id: data.id } });
                      } catch (e) {
                        console.error('View Results error', e);
                      }
                    }}
                  >
                    <Text style={styles.viewResultsText}>View Results</Text>
                    <Ionicons name="chevron-forward" size={14} color="#3D5AFE" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  key={q.id}
                  style={styles.quizCard}
                  onPress={() => router.push({ pathname: '/quizzes/[id]', params: { id: q.id, studentId: selectedStudent } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, styles.quizBadgeActive]}>
                      <Ionicons name="pencil" size={14} color="#3D5AFE" />
                      <Text style={[styles.quizBadgeText, { color: '#3D5AFE' }]}>Take Quiz</Text>
                    </View>
                  </View>
                  <Text style={styles.quizTitle}>{q.title}</Text>
                  <View style={styles.quizMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="document-text-outline" size={13} color="#8892B0" />
                      <Text style={styles.metaText}>{q.question_count} question{q.question_count !== 1 ? 's' : ''}</Text>
                    </View>
                    {q.timeLimit ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="timer-outline" size={13} color="#8892B0" />
                        <Text style={styles.metaText}>{q.timeLimit} min</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color="#8892B0" />
                      <Text style={styles.metaText}>
                        Due {new Date(q.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <LinearGradient colors={['#3D5AFE', '#00BCD4']} style={styles.startBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.startBtnText}>Start Quiz</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {quizzes.length === 0 && (
              <View style={styles.empty}>
                <Ionicons name="document-outline" size={48} color="#4A5080" />
                <Text style={styles.emptyText}>No active quizzes right now</Text>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  historyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  studyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(245,158,11,0.12)', alignItems: 'center', justifyContent: 'center' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  infoText: { fontSize: 13, color: '#8892B0', fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#8892B0', marginBottom: 12, letterSpacing: 0.5, paddingHorizontal: 4 },
  quizCard: { backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  quizCardDone: { opacity: 0.55 },
  textMuted: { color: '#8892B0' },
  quizCardTop: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10 },
  quizBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  quizBadgeActive: { backgroundColor: 'rgba(61,90,254,0.15)' },
  quizBadgeDone: { backgroundColor: 'rgba(46,204,113,0.15)' },
  quizBadgeText: { fontSize: 11, fontWeight: '700' },
  quizTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF', marginBottom: 12 },
  quizMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8892B0' },
  startBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' as const },
  startBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  viewResultsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(61,90,254,0.3)' },
  viewResultsText: { color: '#3D5AFE', fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { color: '#4A5080', fontSize: 15 },
});
