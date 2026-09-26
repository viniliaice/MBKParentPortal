import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import StudentSelector from '@/components/StudentSelector';
import { supabase, type QuizAttempt, type Quiz } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import { gradeColorForPct } from '@/lib/grading';

type AttemptWithQuiz = QuizAttempt & { quiz_title?: string };

export default function QuizHistoryScreen() {
  const { students } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const [selectedStudent, setSelectedStudent] = useState(students[0]?.id);
  const [attempts, setAttempts] = useState<AttemptWithQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [quizzes, setQuizzes] = useState<Record<string, Quiz>>({});

  useEffect(() => {
    if (!selectedStudent) return;
    (async () => {
      setLoading(true);
      const { data: aData } = await supabase
        .from('quiz_attempts')
        .select('*')
        .eq('studentId', selectedStudent)
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
  }, [selectedStudent]);

  const getPct = (score: number, total: number) =>
    total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Quiz History</Text>
          <View style={{ width: 36 }} />
        </View>

        <StudentSelector students={students} selectedId={selectedStudent} onSelect={setSelectedStudent} />

        {loading ? (
          <View style={styles.center}><ActivityIndicator size="large" color="#3D5AFE" /></View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}>
            {attempts.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="time-outline" size={48} color="#4A5080" />
                <Text style={styles.emptyText}>No quiz history yet</Text>
              </View>
            ) : (
              attempts.map(a => {
                const q = quizzes[a.quizId];
                const title = q?.title || 'Quiz';
                const pct = getPct(a.totalEarned, a.totalPossible);
                const color = gradeColorForPct(pct);
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={styles.attemptCard}
                    onPress={() => router.push({ pathname: '/quizzes/results', params: { id: a.id } })}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.attemptTitle}>{title}</Text>
                      <View style={styles.attemptMeta}>
                        <View style={styles.metaItem}>
                          <Ionicons name="calendar-outline" size={12} color="#8892B0" />
                          <Text style={styles.metaText}>
                            {new Date(a.submittedAt || '').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Ionicons name="document-text-outline" size={12} color="#8892B0" />
                          <Text style={styles.metaText}>{a.totalEarned}/{a.totalPossible}</Text>
                        </View>
                      </View>
                    </View>
                    <View style={[styles.scoreBadge, { backgroundColor: `${color}22` }]}>
                      <Text style={[styles.scoreText, { color }]}>{pct}%</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#8892B0" />
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  attemptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16,
    padding: 16, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  attemptTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  attemptMeta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#8892B0' },
  scoreBadge: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 },
  scoreText: { fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyText: { color: '#4A5080', fontSize: 15 },
});
