import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { ChildSelector } from '@/components/ChildSelector';
import { EmptyState } from '@/components/EmptyState';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase, type QuizAttempt, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { useColors, type Colors } from '@/hooks/useColors';

type AttemptWithQuiz = QuizAttempt & { quiz_title?: string };

export default function QuizHistoryScreen() {
  const { students, selectedStudentId } = useApp();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [attempts, setAttempts] = useState<AttemptWithQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});

  useEffect(() => {
    if (!selectedStudentId) return;
    (async () => {
      setLoading(true);
      const { data: aData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('studentId', selectedStudentId)
        .order('submittedAt', { ascending: false });
      if (aData) {
        const quizIds = [...new Set((aData as QuizAttempt[]).map(a => a.quizId))];
        const qMap: Record<string, Quiz> = {};
        if (quizIds.length > 0) {
          const { data: qData } = await supabase
            .from('quizzes')
            .select('*')
            .in('id', quizIds);
          if (qData) {
            (qData as Quiz[]).forEach(q => { qMap[q.id] = q; });
            setQuizzes(qMap);
          }
        }
        setAttempts((aData as QuizAttempt[]).map(a => ({
          ...a,
          quiz_title: qMap[a.quizId]?.title || 'Quiz',
        })));
      }
      setLoading(false);
    })();
  }, [selectedStudentId]);

  const getPct = (score: number, total: number) =>
    total > 0 ? Math.round((score / total) * 100) : 0;

  const gradeColor = (p: number) => (p >= 80 ? c.accent : p >= 60 ? c.warning : c.destructive);

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Quiz history" onBack={() => router.back()} />

        <ChildSelector dense style={{ marginBottom: 12 }} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : students.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="No children linked yet"
            message="Quiz results appear here once the school office links your children to your account."
          />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
            {attempts.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="No quiz history yet"
                message="Quizzes your child has taken will be listed here."
              />
            ) : (
              attempts.map(a => {
                const q = quizzes[a.quizId];
                const title = q?.title || 'Quiz';
                const pct = getPct(a.totalEarned, a.totalPossible);
                const color = gradeColor(pct);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.attemptCard, { backgroundColor: c.surface, borderColor: c.border }]}
                    onPress={() => router.push({ pathname: '/quizzes/results', params: { id: a.id } })}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.attemptTitle, { color: c.foreground }]}>{title}</Text>
                      <View style={styles.attemptMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={12} color={c.textSecondary} />
                          <Text style={[styles.metaText, { color: c.textSecondary }]}>
                            {new Date(a.submittedAt || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="document-text-outline" size={12} color={c.textSecondary} />
                          <Text style={[styles.metaText, { color: c.textSecondary }]}>{a.totalEarned}/{a.totalPossible}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: c.surfaceMuted }]}>
                      <Text style={[styles.scoreText, { color }]}>{pct}%</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.textSecondary} />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </AuroraBackground>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  attemptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1,
  },
  attemptTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  attemptMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 14, fontWeight: '800' },
});
