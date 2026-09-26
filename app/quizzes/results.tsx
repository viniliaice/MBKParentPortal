import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import AuroraBackground from '@/components/AuroraBackground';
import { useColors } from '@/hooks/useColors';
import { supabase, type QuizAttempt, type Quiz, type QuizQuestion, type QuizAnswer } from '@/lib/supabase';

export default function QuizResultsScreen() {
  const { id: attemptId } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => {
    return () => { Speech.stop(); };
  }, []);

  const speakQuestion = useCallback((questionId: string, text: string) => {
    if (speakingId === questionId) {
      Speech.stop();
      setSpeakingId(null);
      return;
    }
    Speech.stop();
    setSpeakingId(questionId);
    Speech.speak(text, {
      onDone: () => setSpeakingId(null),
      onStopped: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  }, [speakingId]);

  useEffect(() => {
    (async () => {
      try {
        const { data: aData } = await supabase
          .from('quiz_attempts')
          .select('*')
          .eq('id', attemptId)
          .maybeSingle();
        if (aData) {
          setAttempt(aData as QuizAttempt);
          const { data: qData } = await supabase
            .from('quizzes')
            .select('*')
            .eq('id', aData.quizId)
            .maybeSingle();
          if (qData) setQuiz(qData as Quiz);

          const { data: qqData } = await supabase
            .from('quiz_questions')
            .select('*')
            .eq('quizId', aData.quizId)
            .order('orderIndex', { ascending: true });
          if (qqData) setQuestions(qqData as QuizQuestion[]);
        }
      } catch (e) {
        console.error('Failed to load attempt', e);
      }
      setLoading(false);
    })();
  }, [attemptId]);

  if (loading) {
    return (
      <AuroraBackground>
        <View style={styles.center}><ActivityIndicator size="large" color={c.primary} /></View>
      </AuroraBackground>
    );
  }

  if (!attempt || !quiz) {
    return (
      <AuroraBackground>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={36} color={c.mutedForeground} />
          <Text style={{ color: c.mutedForeground, marginTop: 12 }}>Attempt not found</Text>
          <TouchableOpacity style={styles.backHomeBtn} onPress={() => router.back()}>
            <Text style={{ color: c.primary, fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </AuroraBackground>
    );
  }

  const pct = attempt.totalPossible > 0
    ? Math.round((attempt.totalEarned / attempt.totalPossible) * 100)
    : 0;

  const getGradeColor = (p: number) => {
    if (p >= 80) return '#2ECC71';
    if (p >= 60) return '#F59E0B';
    return '#FF5370';
  };

  const gradeColor = getGradeColor(pct);

  if (!quiz.showResults) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1 }}>
          <View style={[styles.header, { paddingTop: topPad + 12 }]}>
            <TouchableOpacity onPress={() => router.dismissAll()} style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}>
              <Ionicons name="close" size={22} color={c.foreground} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: c.foreground }]}>Quiz Submitted</Text>
            <View style={{ width: 36 }} />
          </View>
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={64} color="#2ECC71" />
            <Text style={[styles.submittedTitle, { color: c.foreground }]}>Submitted!</Text>
            <Text style={[styles.submittedSub, { color: c.mutedForeground }]}>Your quiz has been submitted successfully. Results will be available once graded.</Text>
            <TouchableOpacity style={[styles.returnBtn, { backgroundColor: `${c.primary}26` }]} onPress={() => router.navigate('/quizzes')}>
              <Text style={[styles.returnBtnText, { color: c.primary }]}>Return to Quizzes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => router.dismissAll()} style={[styles.backBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="close" size={22} color={c.foreground} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: c.foreground }]} numberOfLines={1}>Results</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: Platform.OS === 'web' ? 34 : 20 }}>
          <View style={[styles.scoreCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={[styles.scoreLabel, { color: c.mutedForeground }]}>{quiz.title}</Text>
            <Text style={[styles.scoreValue, { color: gradeColor }]}>{pct}%</Text>
            <Text style={[styles.scoreDetail, { color: c.mutedForeground }]}>
              {attempt.totalEarned} / {attempt.totalPossible} points
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: c.mutedForeground }]}>Question Review</Text>

          {questions.map((q, i) => {
            const answersData: QuizAnswer[] = Array.isArray(attempt.answers) ? attempt.answers : [];
            const ans = answersData.find(a => a.questionId === q.id);
            const isMC = q.typeSnapshot === 'multiple_choice';
            const isCorrect = ans?.isCorrect === true;
            const isWrong = ans?.isCorrect === false;
            const pending = ans?.isCorrect === null;

            let statusColor = c.mutedForeground;
            let statusIcon: keyof typeof Ionicons.glyphMap = 'remove-outline';
            let statusLabel = 'Not answered';
            if (isCorrect) { statusColor = '#2ECC71'; statusIcon = 'checkmark-circle'; statusLabel = 'Correct'; }
            else if (isWrong) { statusColor = '#FF5370'; statusIcon = 'close-circle'; statusLabel = 'Incorrect'; }
            else if (pending) { statusColor = '#F59E0B'; statusIcon = 'time-outline'; statusLabel = 'Pending'; }

            return (
              <View key={q.id} style={[styles.reviewCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewNum, { color: c.mutedForeground }]}>Question {i + 1}</Text>
                  <View style={[styles.statusPill, { backgroundColor: `${statusColor}22` }]}>
                    <Ionicons name={statusIcon} size={12} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={styles.promptRow}>
                  <Text style={[styles.reviewPrompt, { color: c.foreground }]}>{q.promptSnapshot}</Text>
                  <TouchableOpacity
                    style={[styles.speakBtn, { backgroundColor: c.muted }, speakingId === q.id && { backgroundColor: c.primary }]}
                    onPress={() => speakQuestion(q.id, q.promptSnapshot)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={speakingId === q.id ? 'volume-high' : 'volume-medium-outline'}
                      size={16}
                      color={speakingId === q.id ? '#FFFFFF' : c.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>

                {isMC && (
                  <View style={styles.reviewOptions}>
                    {q.optionsSnapshot.map((opt, oi) => {
                      const wasSelected = ans?.answer === opt.label;
                      const isCorrectOpt = opt.label === q.correctAnswerSnapshot;
                      return (
                        <View
                          key={oi}
                          style={[
                            styles.reviewOption,
                            { backgroundColor: c.muted },
                            wasSelected && isCorrect && { backgroundColor: 'rgba(46,204,113,0.12)' },
                            wasSelected && isWrong && { backgroundColor: 'rgba(255,83,112,0.12)' },
                            !wasSelected && isCorrectOpt && { backgroundColor: 'rgba(46,204,113,0.12)' },
                          ]}
                        >
                          <Text style={[styles.reviewOptionLabel, { color: c.mutedForeground }]}>{opt.label}.</Text>
                          <Text style={[styles.reviewOptionText, { color: (wasSelected || isCorrectOpt) ? c.foreground : c.mutedForeground }]}>{opt.text}</Text>
                          {wasSelected && (
                            <Ionicons
                              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={isCorrect ? '#2ECC71' : '#FF5370'}
                            />
                          )}
                          {!wasSelected && isCorrectOpt && (
                            <Ionicons name="checkmark-circle" size={18} color="#2ECC71" />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {pending && (
                  <View style={[styles.pendingBox, { backgroundColor: 'rgba(245,158,11,0.08)' }]}>
                    <Ionicons name="time-outline" size={16} color="#F59E0B" />
                    <Text style={styles.pendingText}>Pending teacher grading</Text>
                  </View>
                )}

                {ans?.score != null && ans.score > 0 && !pending && (
                  <Text style={styles.scoreEarned}>+{ans?.score} pt{ans?.score !== 1 ? 's' : ''}</Text>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={[styles.returnBtn, { backgroundColor: `${c.primary}26` }]} onPress={() => router.navigate('/quizzes')}>
            <Text style={[styles.returnBtnText, { color: c.primary }]}>Back to Quizzes</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800' },
  scoreCard: { borderRadius: 24, padding: 32, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  scoreLabel: { fontSize: 14, marginBottom: 8 },
  scoreValue: { fontSize: 56, fontWeight: '900', marginBottom: 4 },
  scoreDetail: { fontSize: 15, fontWeight: '600' },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, letterSpacing: 0.5 },
  reviewCard: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewNum: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  promptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  reviewPrompt: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  speakBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  reviewOptions: { gap: 8 },
  reviewOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  reviewOptionLabel: { fontSize: 12, fontWeight: '700' },
  reviewOptionText: { flex: 1, fontSize: 13 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  pendingText: { fontSize: 13, color: '#F59E0B', fontWeight: '600' },
  scoreEarned: { fontSize: 13, fontWeight: '700', color: '#2ECC71', marginTop: 8 },
  submittedTitle: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  submittedSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 40, marginBottom: 24 },
  returnBtn: { marginTop: 16, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  returnBtnText: { fontSize: 15, fontWeight: '700' },
  backHomeBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: 'rgba(61,90,254,0.15)' },
});
