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
import ChildrenSelector from '@/components/ChildrenSelector';
import { EmptyState } from '@/components/StateViews';
import { supabase, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';

type QuizWithCount = Quiz & { question_count: number };

export default function QuizListScreen() {
  const { students } = useApp();
  const c = useColors();
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [quizzes, setQuizzes] = useState<QuizWithCount[]>([]);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const safeSelectedStudent = students.some(s => s.id === selectedStudent) ? selectedStudent : students[0]?.id;
  const student = students.find(s => s.id === safeSelectedStudent);

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
        for (const cc of countData) {
          countMap.set(cc.quizId, (countMap.get(cc.quizId) || 0) + 1);
        }
      }

      setQuizzes((qData as Quiz[]).map(q => ({
        ...q,
        question_count: countMap.get(q.id) || 0,
      })));
    }

    if (safeSelectedStudent) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quizId')
        .eq('studentId', safeSelectedStudent);
      if (attempts) {
        setAttemptedQuizIds(new Set(attempts.map(a => a.quizId)));
      }
    }

    setLoading(false);
  }, [student, safeSelectedStudent]);

  useEffect(() => {
    setLoading(true);
    fetchQuizzes();
  }, [fetchQuizzes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQuizzes();
    setRefreshing(false);
  };

  const activeStudent = students.find(s => s.id === safeSelectedStudent);

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Quizzes"
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/quizzes/history')}
                style={[styles.headerBtn, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <Ionicons name="time-outline" size={18} color={c.foreground} />
              </TouchableOpacity>
            </View>
          }
        />

        {students.length > 1 && (
          <View style={styles.studentRow}>
            <ChildrenSelector childrenList={students} selectedId={safeSelectedStudent} onSelect={setSelectedStudent} />
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
          >
            {activeStudent && (
              <View style={styles.infoRow}>
                <Ionicons name="school-outline" size={16} color={c.mutedForeground} />
                <Text style={[styles.infoText, { color: c.mutedForeground }]}>{activeStudent.className}</Text>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>
              {quizzes.length > 0 ? `${quizzes.length} Active Quiz${quizzes.length !== 1 ? 'zes' : ''}` : 'No Active Quizzes'}
            </Text>

            {quizzes.map(q => {
              const attempted = attemptedQuizIds.has(q.id);
              return attempted ? (
                <View key={q.id} style={[styles.quizCard, styles.quizCardDone, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, { backgroundColor: 'rgba(46,204,113,0.15)' }]}>
                      <Ionicons name="checkmark-circle" size={14} color="#2ECC71" />
                      <Text style={[styles.quizBadgeText, { color: '#2ECC71' }]}>Completed</Text>
                    </View>
                  </View>
                  <Text style={[styles.quizTitle, { color: c.mutedForeground }]}>{q.title}</Text>
                  <View style={styles.quizMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="document-text-outline" size={13} color={c.mutedForeground} />
                      <Text style={[styles.metaText, { color: c.mutedForeground }]}>{q.question_count} question{q.question_count !== 1 ? 's' : ''}</Text>
                    </View>
                    {q.timeLimit ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="timer-outline" size={13} color={c.mutedForeground} />
                        <Text style={[styles.metaText, { color: c.mutedForeground }]}>{q.timeLimit} min</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color={c.mutedForeground} />
                      <Text style={[styles.metaText, { color: c.mutedForeground }]}>
                        Due {new Date(q.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.viewResultsBtn, { borderColor: `${c.primary}4D` }]}
                    onPress={async () => {
                      try {
                        const { data } = await supabase
                          .from('quiz_attempts')
                          .select('id')
                          .eq('quizId', q.id)
                          .eq('studentId', safeSelectedStudent)
                          .maybeSingle();
                        if (data) router.push({ pathname: '/quizzes/results', params: { id: data.id } });
                      } catch (e) {
                        console.error('View Results error', e);
                      }
                    }}
                  >
                    <Text style={[styles.viewResultsText, { color: c.primary }]}>View Results</Text>
                    <Ionicons name="chevron-forward" size={14} color={c.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.quizCard, { backgroundColor: c.card, borderColor: c.border }]}
                  onPress={() => router.push({ pathname: '/quizzes/[id]', params: { id: q.id, studentId: safeSelectedStudent } })}
                  activeOpacity={0.8}
                >
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, { backgroundColor: `${c.primary}26` }]}>
                      <Ionicons name="pencil" size={14} color={c.primary} />
                      <Text style={[styles.quizBadgeText, { color: c.primary }]}>Take Quiz</Text>
                    </View>
                  </View>
                  <Text style={[styles.quizTitle, { color: c.foreground }]}>{q.title}</Text>
                  <View style={styles.quizMeta}>
                    <View style={styles.metaItem}>
                      <Ionicons name="document-text-outline" size={13} color={c.mutedForeground} />
                      <Text style={[styles.metaText, { color: c.mutedForeground }]}>{q.question_count} question{q.question_count !== 1 ? 's' : ''}</Text>
                    </View>
                    {q.timeLimit ? (
                      <View style={styles.metaItem}>
                        <Ionicons name="timer-outline" size={13} color={c.mutedForeground} />
                        <Text style={[styles.metaText, { color: c.mutedForeground }]}>{q.timeLimit} min</Text>
                      </View>
                    ) : null}
                    <View style={styles.metaItem}>
                      <Ionicons name="calendar-outline" size={13} color={c.mutedForeground} />
                      <Text style={[styles.metaText, { color: c.mutedForeground }]}>
                        Due {new Date(q.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                  <LinearGradient colors={[c.primary, c.secondary]} style={styles.startBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.startBtnText}>Start Quiz</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {quizzes.length === 0 && (
              <EmptyState
                icon="document-outline"
                title="No active quizzes right now"
                message="Class quizzes appear here while they are open."
              />
            )}
          </ScrollView>
        )}
      </View>
    </AuroraBackground>
  );
}

function ScreenHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  return (
    <View style={[styles.headerRow, { paddingTop: topPad + 12 }]}>
      <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}>
        <Ionicons name="arrow-back" size={22} color={c.foreground} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  studentRow: { paddingHorizontal: 20, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, paddingHorizontal: 4 },
  infoText: { fontSize: 13, fontWeight: '500' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5, paddingHorizontal: 4 },
  quizCard: { borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1 },
  quizCardDone: { opacity: 0.55 },
  quizCardTop: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10 },
  quizBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  quizBadgeText: { fontSize: 11, fontWeight: '700' },
  quizTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  quizMeta: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  startBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  viewResultsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 14, borderWidth: 1 },
  viewResultsText: { fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
