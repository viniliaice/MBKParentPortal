import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { ChildSelector } from '@/components/ChildSelector';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { useColors, type Colors } from '@/hooks/useColors';

type QuizWithCount = Quiz & { question_count: number };

export default function QuizListScreen() {
  const { students, selectedStudent, selectedStudentId } = useApp();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [quizzes, setQuizzes] = useState<QuizWithCount[]>([]);
  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const student = selectedStudent;

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
        for (const row of countData) {
          countMap.set(row.quizId, (countMap.get(row.quizId) || 0) + 1);
        }
      }

      setQuizzes((qData as Quiz[]).map(q => ({
        ...q,
        question_count: countMap.get(q.id) || 0,
      })));
    }

    if (student.id) {
      const { data: attempts } = await supabase
        .from('quiz_attempts')
        .select('quizId')
        .eq('studentId', student.id);
      if (attempts) {
        setAttemptedQuizIds(new Set(attempts.map(a => a.quizId)));
      }
    }

    setLoading(false);
  }, [student]);

  useEffect(() => {
    setLoading(true);
    fetchQuizzes();
  }, [fetchQuizzes]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchQuizzes();
    setRefreshing(false);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Quizzes"
          onBack={() => router.back()}
          subtitle={student ? `${student.name} · ${student.className}` : undefined}
          right={
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/learning')}
                style={[styles.iconBtn, { backgroundColor: c.surfaceMuted }]}
                accessibilityRole="button"
                accessibilityLabel="Open learning practice"
              >
                <Ionicons name="school-outline" size={18} color={c.warning} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/quizzes/history')}
                style={[styles.iconBtn, { backgroundColor: c.surfaceMuted }]}
                accessibilityRole="button"
                accessibilityLabel="Quiz history"
              >
                <Ionicons name="time-outline" size={18} color={c.textSecondary} />
              </TouchableOpacity>
            </View>
          }
        />

        <ChildSelector dense style={{ marginBottom: 12 }} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : students.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No children linked yet"
            message="Quizzes appear here once the school office links your children to your account."
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} colors={[c.primary]} />}
          >
            <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>
              {quizzes.length > 0 ? `${quizzes.length} active quiz${quizzes.length !== 1 ? 'zes' : ''}` : 'No active quizzes'}
            </Text>

            {quizzes.map(q => {
              const attempted = attemptedQuizIds.has(q.id);
              return attempted ? (
                <Card key={q.id} style={[styles.quizCard, { opacity: 0.65 }]}>
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, { backgroundColor: c.surfaceMuted }]}>
                      <Ionicons name="checkmark-circle" size={14} color={c.accent} />
                      <Text style={[styles.quizBadgeText, { color: c.accent }]}>Completed</Text>
                    </View>
                  </View>
                  <Text style={[styles.quizTitle, { color: c.textSecondary }]}>{q.title}</Text>
                  <QuizMeta quiz={q} />
                  <TouchableOpacity
                    style={[styles.viewResultsBtn, { backgroundColor: c.primarySoft }]}
                    onPress={async () => {
                      try {
                        const { data } = await supabase
                          .from('quiz_attempts')
                          .select('id')
                          .eq('quizId', q.id)
                          .eq('studentId', selectedStudentId)
                          .maybeSingle();
                        if (data) router.push({ pathname: '/quizzes/results', params: { id: data.id } });
                      } catch {
                        // A missing attempt simply means the button does nothing yet.
                      }
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.viewResultsText, { color: c.primary }]}>View results</Text>
                    <Ionicons name="chevron-forward" size={14} color={c.primary} />
                  </TouchableOpacity>
                </Card>
              ) : (
                <TouchableOpacity
                  key={q.id}
                  style={[styles.quizCard, { backgroundColor: c.surface, borderColor: c.border }]}
                  onPress={() => router.push({ pathname: '/quizzes/[id]', params: { id: q.id, studentId: selectedStudentId ?? '' } })}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <View style={styles.quizCardTop}>
                    <View style={[styles.quizBadge, { backgroundColor: c.primarySoft }]}>
                      <Ionicons name="pencil" size={14} color={c.primary} />
                      <Text style={[styles.quizBadgeText, { color: c.primary }]}>Take quiz</Text>
                    </View>
                  </View>
                  <Text style={[styles.quizTitle, { color: c.foreground }]}>{q.title}</Text>
                  <QuizMeta quiz={q} />
                  <LinearGradient colors={c.brandGradient} style={styles.startBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={[styles.startBtnText, { color: c.onBrand }]}>Start quiz</Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

            {quizzes.length === 0 ? (
              <EmptyState
                icon="document-outline"
                title="No active quizzes right now"
                message="Quizzes set for this class will appear here while they are open."
              />
            ) : null}
          </ScrollView>
        )}
      </View>
    </AuroraBackground>
  );
}

function QuizMeta({ quiz }: { quiz: QuizWithCount }) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.quizMeta}>
      <View style={styles.metaItem}>
        <Ionicons name="document-text-outline" size={13} color={c.textSecondary} />
        <Text style={[styles.metaText, { color: c.textSecondary }]}>
          {quiz.question_count} question{quiz.question_count !== 1 ? 's' : ''}
        </Text>
      </View>
      {quiz.timeLimit ? (
        <View style={styles.metaItem}>
          <Ionicons name="timer-outline" size={13} color={c.textSecondary} />
          <Text style={[styles.metaText, { color: c.textSecondary }]}>{quiz.timeLimit} min</Text>
        </View>
      ) : null}
      <View style={styles.metaItem}>
        <Ionicons name="calendar-outline" size={13} color={c.textSecondary} />
        <Text style={[styles.metaText, { color: c.textSecondary }]}>
          Due {new Date(quiz.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  quizCard: { borderRadius: 20, padding: 20, marginBottom: 14, borderWidth: 1 },
  quizCardTop: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10 },
  quizBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  quizBadgeText: { fontSize: 11, fontWeight: '700' },
  quizTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  quizMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 16 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12 },
  startBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  startBtnText: { fontSize: 15, fontWeight: '700' },
  viewResultsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 14, borderRadius: 14 },
  viewResultsText: { fontSize: 14, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
