import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import ChildrenSelector from '@/components/ChildrenSelector';
import TopBar from '@/components/TopBar';
import { EmptyState } from '@/components/StateViews';
import { useColors } from '@/hooks/useColors';
import { supabase, type QuizAttempt, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';

type AttemptWithQuiz = QuizAttempt & { quiz_title?: string };

export default function QuizHistoryScreen() {
  const { students } = useApp();
  const c = useColors();
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [attempts, setAttempts] = useState<AttemptWithQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});

  const safeSelectedStudent = students.some(s => s.id === selectedStudent) ? selectedStudent : students[0]?.id;

  useEffect(() => {
    if (!safeSelectedStudent) return;
    (async () => {
      setLoading(true);
      const { data: aData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('studentId', safeSelectedStudent)
        .order('submittedAt', { ascending: false });
      if (aData) {
        const quizIds = [...new Set((aData as QuizAttempt[]).map(a => a.quizId))];
        let qMap: Record<string, Quiz> = {};
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
  }, [safeSelectedStudent]);

  const getPct = (score: number, total: number) =>
    total > 0 ? Math.round((score / total) * 100) : 0;

  const getGradeColor = (p: number) => {
    if (p >= 80) return '#2ECC71';
    if (p >= 60) return '#F59E0B';
    return '#FF5370';
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <TopBar title="Quiz History" />

        {students.length > 1 && (
          <View style={styles.studentRow}>
            <ChildrenSelector childrenList={students} selectedId={safeSelectedStudent} onSelect={setSelectedStudent} />
          </View>
        )}

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}>
            {attempts.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title="No quiz history yet"
                message="Completed quizzes appear here."
              />
            ) : (
              attempts.map(a => {
                const q = quizzes[a.quizId];
                const title = q?.title || 'Quiz';
                const pct = getPct(a.totalEarned, a.totalPossible);
                const color = getGradeColor(pct);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.attemptCard, { backgroundColor: c.card, borderColor: c.border }]}
                    onPress={() => router.push({ pathname: '/quizzes/results', params: { id: a.id } })}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.attemptTitle, { color: c.foreground }]}>{title}</Text>
                      <View style={styles.attemptMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={12} color={c.mutedForeground} />
                          <Text style={[styles.metaText, { color: c.mutedForeground }]}>
                            {new Date(a.submittedAt || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="document-text-outline" size={12} color={c.mutedForeground} />
                          <Text style={[styles.metaText, { color: c.mutedForeground }]}>{a.totalEarned}/{a.totalPossible}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: `${color}22` }]}>
                      <Text style={[styles.scoreText, { color }]}>{pct}%</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.mutedForeground} />
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

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  studentRow: { paddingHorizontal: 20, marginBottom: 12 },
  attemptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16,
    padding: 16, marginBottom: 10, borderWidth: 1,
  },
  attemptTitle: { fontSize: 15, fontWeight: '700', marginBottom: 6 },
  attemptMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 14, fontWeight: '800' },
});
