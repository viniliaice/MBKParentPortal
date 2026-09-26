import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import AuroraBackground from '@/components/AuroraBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase, type QuizAttempt, type Quiz, type QuizQuestion, type QuizAnswer } from '@/lib/supabase';
import { useColors, type Colors } from '@/hooks/useColors';

export default function QuizResultsScreen() {
  const { id: attemptId } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

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
      } catch {
        // The empty state below covers a missing or unreadable attempt.
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
          <Ionicons name="alert-circle-outline" size={36} color={c.textDim} />
          <Text style={{ color: c.textSecondary, marginTop: 12 }}>Attempt not found</Text>
          <TouchableOpacity style={[styles.backHomeBtn, { backgroundColor: c.primarySoft }]} onPress={() => router.back()} accessibilityRole="button">
            <Text style={{ color: c.primary, fontWeight: '600' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </AuroraBackground>
    );
  }

  const pct = attempt.totalPossible > 0
    ? Math.round((attempt.totalEarned / attempt.totalPossible) * 100)
    : 0;

  const gradeColor = pct >= 80 ? c.accent : pct >= 60 ? c.warning : c.destructive;

  if (!quiz.showResults) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1 }}>
          <ScreenHeader title="Quiz submitted" onBack={() => router.dismissAll()} />
          <View style={styles.center}>
            <Ionicons name="checkmark-circle" size={64} color={c.accent} />
            <Text style={[styles.submittedTitle, { color: c.foreground }]}>Submitted!</Text>
            <Text style={[styles.submittedSub, { color: c.textSecondary }]}>
              Your quiz has been submitted successfully. Results will be available once graded.
            </Text>
            <TouchableOpacity style={[styles.returnBtn, { backgroundColor: c.primarySoft }]} onPress={() => router.navigate('/quizzes')} accessibilityRole="button">
              <Text style={[styles.returnBtnText, { color: c.primary }]}>Return to quizzes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader title="Results" onBack={() => router.dismissAll()} />

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={[styles.scoreCard, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Text style={[styles.scoreLabel, { color: c.textSecondary }]}>{quiz.title}</Text>
            <Text style={[styles.scoreValue, { color: gradeColor }]}>{pct}%</Text>
            <View style={[styles.scoreBar, { backgroundColor: c.surfaceSunken }]}>
              <View style={[styles.scoreBarFill, { width: `${Math.min(pct, 100)}%` as never, backgroundColor: gradeColor }]} />
            </View>
            <Text style={[styles.scoreDetail, { color: c.textBody }]}>
              {attempt.totalEarned} / {attempt.totalPossible} points
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: c.textSecondary }]}>Question review</Text>

          {questions.map((q, i) => {
            const answersData: QuizAnswer[] = Array.isArray(attempt.answers) ? attempt.answers : [];
            const ans = answersData.find(a => a.questionId === q.id);
            const isMC = q.typeSnapshot === 'multiple_choice';
            const isCorrect = ans?.isCorrect === true;
            const isWrong = ans?.isCorrect === false;
            const pending = ans?.isCorrect === null;

            let statusColor = c.textSecondary;
            let statusIcon: keyof typeof Ionicons.glyphMap = 'remove-outline';
            let statusLabel = 'Not answered';
            if (isCorrect) { statusColor = c.accent; statusIcon = 'checkmark-circle'; statusLabel = 'Correct'; }
            else if (isWrong) { statusColor = c.destructive; statusIcon = 'close-circle'; statusLabel = 'Incorrect'; }
            else if (pending) { statusColor = c.warning; statusIcon = 'time-outline'; statusLabel = 'Pending'; }

            return (
              <View key={q.id} style={[styles.reviewCard, { backgroundColor: c.surface, borderColor: c.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewNum, { color: c.textSecondary }]}>Question {i + 1}</Text>
                  <View style={[styles.statusPill, { backgroundColor: c.surfaceMuted }]}>
                    <Ionicons name={statusIcon} size={12} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>
                <View style={styles.promptRow}>
                  <Text style={[styles.reviewPrompt, { color: c.foreground }]}>{q.promptSnapshot}</Text>
                  <TouchableOpacity
                    style={[styles.speakBtn, { backgroundColor: speakingId === q.id ? c.primary : c.surfaceMuted }]}
                    onPress={() => speakQuestion(q.id, q.promptSnapshot)}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityLabel={speakingId === q.id ? 'Stop reading the question' : 'Read the question aloud'}
                  >
                    <Ionicons
                      name={speakingId === q.id ? 'volume-high' : 'volume-medium-outline'}
                      size={16}
                      color={speakingId === q.id ? c.onBrand : c.textSecondary}
                    />
                  </TouchableOpacity>
                </View>

                {isMC ? (
                  <View style={styles.reviewOptions}>
                    {q.optionsSnapshot.map((opt, oi) => {
                      const wasSelected = ans?.answer === opt.label;
                      const isCorrectOpt = opt.label === q.correctAnswerSnapshot;
                      const highlight = isCorrectOpt ? c.accent : c.destructive;
                      const showHighlight = (wasSelected && isCorrect) || (wasSelected && isWrong) || isCorrectOpt;
                      return (
                        <View
                          key={oi}
                          style={[
                            styles.reviewOption,
                            { backgroundColor: c.surfaceMuted, borderColor: showHighlight ? highlight : 'transparent' },
                          ]}
                        >
                          <Text style={[styles.reviewOptionLabel, { color: c.textSecondary }]}>{opt.label}.</Text>
                          <Text style={[styles.reviewOptionText, { color: c.textBody }]}>{opt.text}</Text>
                          {wasSelected ? (
                            <Ionicons
                              name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                              size={18}
                              color={isCorrect ? c.accent : c.destructive}
                            />
                          ) : null}
                          {!wasSelected && isCorrectOpt ? <Ionicons name="checkmark-circle" size={18} color={c.accent} /> : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {pending ? (
                  <View style={[styles.pendingBox, { backgroundColor: c.surfaceMuted }]}>
                    <Ionicons name="time-outline" size={16} color={c.warning} />
                    <Text style={[styles.pendingText, { color: c.warning }]}>Pending teacher grading</Text>
                  </View>
                ) : null}

                {ans?.score != null && ans.score > 0 && !pending ? (
                  <Text style={[styles.scoreEarned, { color: c.accent }]}>
                    +{ans?.score} pt{ans?.score !== 1 ? 's' : ''}
                  </Text>
                ) : null}
              </View>
            );
          })}

          <TouchableOpacity style={[styles.returnBtn, { backgroundColor: c.primarySoft }]} onPress={() => router.navigate('/quizzes')} accessibilityRole="button">
            <Text style={[styles.returnBtnText, { color: c.primary }]}>Back to quizzes</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </AuroraBackground>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  scoreCard: { borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  scoreLabel: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  scoreValue: { fontSize: 52, fontWeight: '900', marginBottom: 10 },
  scoreBar: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  scoreBarFill: { height: 8, borderRadius: 4 },
  scoreDetail: { fontSize: 14.5, fontWeight: '600' },
  sectionTitle: { fontSize: 12.5, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  reviewCard: { borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  reviewNum: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  promptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 12 },
  reviewPrompt: { flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 22 },
  speakBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: -2 },
  reviewOptions: { gap: 8 },
  reviewOption: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  reviewOptionLabel: { fontSize: 12, fontWeight: '700' },
  reviewOptionText: { flex: 1, fontSize: 13 },
  pendingBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12 },
  pendingText: { fontSize: 13, fontWeight: '600' },
  scoreEarned: { fontSize: 13, fontWeight: '700', marginTop: 8 },
  submittedTitle: { fontSize: 24, fontWeight: '800', marginTop: 16 },
  submittedSub: { fontSize: 15, textAlign: 'center', lineHeight: 22, paddingHorizontal: 24, marginBottom: 24 },
  returnBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 16, paddingHorizontal: 24 },
  returnBtnText: { fontSize: 15, fontWeight: '700' },
  backHomeBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 },
});
