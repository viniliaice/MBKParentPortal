import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { ScreenHeader } from '@/components/ScreenHeader';
import { supabase, type Quiz, type QuizQuestion } from '@/lib/supabase';
import { demoApi, isDemoMode } from '@/lib/demoMode';
import { useColors, type Colors } from '@/hooks/useColors';
import { shuffleArray } from '@/utils/seededRandom';

interface AnswerEntry {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  score: number;
  feedback: string;
}

export default function TakeQuizScreen() {
  const { id: quizId, studentId } = useLocalSearchParams<{ id: string; studentId: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [startedAt] = useState(new Date().toISOString());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

  useEffect(() => {
    (async () => {
      // Development builds only (see lib/demoMode.ts).
      if (isDemoMode()) {
        const demoQuizRow = demoApi.quizById(quizId);
        if (demoQuizRow) {
          setQuiz(demoQuizRow);
          if (demoQuizRow.timeLimit) setTimeLeft(demoQuizRow.timeLimit * 60);
          const rows = demoApi.quizQuestions(quizId);
          setQuestions(demoQuizRow.questionOrder === 'random'
            ? shuffleArray(rows, `${quizId}-${studentId}-questions`)
            : rows);
        }
        return;
      }

      const { data: qData } = await supabase.from('quizzes').select('*').eq('id', quizId).single();
      if (qData) {
        setQuiz(qData as Quiz);
        if (qData.timeLimit) setTimeLeft(qData.timeLimit * 60);
      }

      const { data: qqData } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quizId', quizId)
        .order('orderIndex', { ascending: true });
      if (qqData) {
        let shuffled = qqData as QuizQuestion[];
        if (qData?.questionOrder === 'random') {
          shuffled = shuffleArray(shuffled, `${quizId}-${studentId}-questions`);
        }
        setQuestions(shuffled);
      }
    })();
  }, [quizId, studentId]);

  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleSubmit(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft]);

  const handleSubmit = useCallback(async (timedOut = false) => {
    if (submittingRef.current) return;
    setSubmitting(true);

    const gradedAnswers: AnswerEntry[] = questions.map(q => {
      const ans = answers[q.id];
      if (!ans || !ans.answer.trim()) {
        return {
          questionId: q.id,
          answer: '',
          isCorrect: false,
          score: 0,
          feedback: 'No answer provided',
        };
      }
      if (q.typeSnapshot === 'multiple_choice') {
        const isCorrect = ans.answer === q.correctAnswerSnapshot;
        return {
          questionId: q.id,
          answer: ans.answer,
          isCorrect,
          score: isCorrect ? q.points : 0,
          feedback: isCorrect ? 'Correct' : 'Incorrect',
        };
      }
      return {
        questionId: q.id,
        answer: ans.answer,
        isCorrect: null,
        score: 0,
        feedback: 'Pending teacher grading',
      };
    });

    const totalEarned = gradedAnswers.reduce((s, a) => s + a.score, 0);
    const totalPossible = questions.reduce((s, q) => s + q.points, 0);

    // Development builds only (see lib/demoMode.ts): the attempt stays in memory.
    if (isDemoMode()) {
      const submittedAt = new Date().toISOString();
      const attemptId = demoApi.saveQuizAttempt({
        quizId, studentId, answers: gradedAnswers, totalEarned, totalPossible,
        status: 'submitted', startedAt, submittedAt, gradedAt: submittedAt,
      });
      router.replace({ pathname: '/quizzes/results', params: { id: attemptId } });
      return;
    }

    const { data, error } = await supabase.from('quiz_attempts').insert({
      quizId,
      studentId,
      answers: gradedAnswers,
      totalEarned,
      totalPossible,
      status: 'submitted',
      startedAt: startedAt,
      submittedAt: new Date().toISOString(),
    }).select('id').single();

    if (error) {
      if (error.code === '23505') {
        Alert.alert('Already Submitted', 'You have already submitted this quiz.');
      } else {
        Alert.alert('Error', 'Failed to submit quiz. Please try again.');
      }
      setSubmitting(false);
      return;
    }

    if (data) {
      router.replace({ pathname: '/quizzes/results', params: { id: data.id } });
    }
    // `timedOut` is accepted for the timer path; submission is the same either way.
  }, [quizId, studentId, questions, answers, startedAt]);

  const currentQuestion = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const isLast = currentIndex === questions.length - 1;

  const answeredCount = Object.keys(answers).length;
  const allAnswered = questions.every(q => answers[q.id]?.answer?.trim());

  const selectedOption = currentQuestion ? answers[currentQuestion.id]?.answer : null;
  const isDirect = currentQuestion?.typeSnapshot === 'direct_answer';

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const selectOption = (label: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        answer: label,
        isCorrect: null,
        score: 0,
        feedback: '',
      },
    }));
  };

  const setTextAnswer = (text: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        answer: text,
        isCorrect: null,
        score: 0,
        feedback: '',
      },
    }));
  };

  const confirmSubmit = () => {
    const unanswered = questions.filter(q => !answers[q.id]?.answer?.trim()).length;
    const msg = unanswered > 0
      ? `You have ${unanswered} unanswered question${unanswered > 1 ? 's' : ''}. Submit anyway?`
      : 'Are you sure you want to submit?';
    Alert.alert('Submit Quiz', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Submit', style: 'destructive', onPress: () => handleSubmit() },
    ]);
  };

  const confirmLeave = () => {
    Alert.alert('Leave Quiz', 'Your progress will be lost.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (!quiz || questions.length === 0) {
    return (
      <AuroraBackground>
        <View style={styles.center}>
          <Ionicons name="hourglass-outline" size={36} color={c.textDim} />
          <Text style={[styles.loadingText, { color: c.textSecondary }]}>Loading quiz…</Text>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <ScreenHeader title={quiz.title} onBack={confirmLeave} />

        <View style={styles.timerRow}>
          {timeLeft !== null ? (
            <View style={[styles.timer, { backgroundColor: timeLeft < 60 ? c.surfaceMuted : c.surfaceMuted }]}>
              <Ionicons name="timer-outline" size={14} color={timeLeft < 60 ? c.destructive : c.warning} />
              <Text style={[styles.timerText, { color: timeLeft < 60 ? c.destructive : c.warning }]}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          ) : <View />}
          <Text style={[styles.counter, { color: c.textSecondary }]}>
            Question {currentIndex + 1} of {questions.length}
          </Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: c.surfaceSunken }]}>
          <View style={[styles.progressFill, { width: `${progress}%` as never, backgroundColor: c.primary }]} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.dotRow}>
            {questions.map((q, i) => (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.dot,
                  { backgroundColor: answers[q.id]?.answer?.trim() ? c.accent : c.surfaceSunken },
                  i === currentIndex && [styles.dotActive, { backgroundColor: c.primary }],
                ]}
                onPress={() => setCurrentIndex(i)}
                accessibilityRole="button"
                accessibilityLabel={`Question ${i + 1}`}
              />
            ))}
          </View>

          {currentQuestion ? (
            <>
              <View style={styles.questionMeta}>
                <Text style={[styles.questionType, { color: c.textSecondary }]}>
                  {isDirect ? 'Written answer' : 'Multiple choice'}
                </Text>
                <Text style={[styles.questionPoints, { color: c.warning }]}>
                  {currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}
                </Text>
              </View>

              <Text style={[styles.prompt, { color: c.foreground }]}>{currentQuestion.promptSnapshot}</Text>

              {isDirect ? (
                <TextInput
                  style={[
                    styles.textarea,
                    { borderColor: c.inputBorder, backgroundColor: c.inputBackground, color: c.foreground },
                  ]}
                  multiline
                  placeholder="Type your answer…"
                  placeholderTextColor={c.placeholder}
                  value={answers[currentQuestion.id]?.answer || ''}
                  onChangeText={setTextAnswer}
                />
              ) : (
                <View style={styles.optionsContainer}>
                  {currentQuestion.optionsSnapshot.map((opt, oi) => {
                    const isSelected = selectedOption === opt.label;
                    return (
                      <TouchableOpacity
                        key={oi}
                        style={[
                          styles.optionBtn,
                          {
                            backgroundColor: c.surface,
                            borderColor: isSelected ? c.primary : c.border,
                          },
                          isSelected && {
                            shadowColor: c.primary,
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.35,
                            shadowRadius: 12,
                            elevation: 6,
                          },
                        ]}
                        onPress={() => selectOption(opt.label)}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                      >
                        <View style={[styles.optionRadio, { borderColor: isSelected ? c.primary : c.borderStrong }]}>
                          {isSelected ? <View style={[styles.optionRadioInner, { backgroundColor: c.primary }]} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.optionLabel, { color: c.textSecondary }]}>{opt.label}.</Text>
                          <Text style={[styles.optionText, { color: isSelected ? c.foreground : c.textBody }]}>
                            {opt.text}
                          </Text>
                        </View>
                        {isSelected ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
              accessibilityRole="button"
            >
              <Ionicons name="arrow-back" size={18} color={currentIndex === 0 ? c.textDim : c.foreground} />
              <Text style={[styles.navBtnText, { color: currentIndex === 0 ? c.textDim : c.foreground }]}>Prev</Text>
            </TouchableOpacity>

            <Text style={[styles.answeredCount, { color: c.textSecondary }]}>
              {answeredCount}/{questions.length} answered
            </Text>

            {isLast ? (
              <TouchableOpacity
                style={[styles.submitBtn, !allAnswered && { opacity: 0.65 }]}
                onPress={confirmSubmit}
                disabled={submitting}
                accessibilityRole="button"
              >
                <LinearGradient colors={c.brandGradient} style={styles.submitGrad}>
                  <Text style={[styles.submitText, { color: c.onBrand }]}>{submitting ? 'Submitting…' : 'Submit'}</Text>
                  <Ionicons name="checkmark" size={18} color={c.onBrand} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
                accessibilityRole="button"
              >
                <Text style={[styles.navBtnText, { color: c.foreground }]}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color={c.foreground} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </AuroraBackground>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 15 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  timerText: { fontSize: 14, fontWeight: '700' },
  counter: { fontSize: 13, fontWeight: '500' },
  progressTrack: { height: 3, marginHorizontal: 20, borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 2 },
  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 20, borderRadius: 4 },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  questionType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionPoints: { fontSize: 11, fontWeight: '700' },
  prompt: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 24 },
  textarea: {
    borderWidth: 1, borderRadius: 16, fontSize: 15,
    padding: 16, minHeight: 140, textAlignVertical: 'top', lineHeight: 22,
  },
  optionsContainer: { gap: 12 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 16, padding: 16, borderWidth: 1.5,
  },
  optionRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  optionRadioInner: { width: 12, height: 12, borderRadius: 6 },
  optionLabel: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  optionText: { fontSize: 15, lineHeight: 20 },
  footer: { paddingHorizontal: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600' },
  answeredCount: { fontSize: 12, fontWeight: '500' },
  submitBtn: { borderRadius: 14, overflow: 'hidden' },
  submitGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20 },
  submitText: { fontSize: 15, fontWeight: '700' },
});
