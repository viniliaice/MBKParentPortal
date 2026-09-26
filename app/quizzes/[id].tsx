import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import AnimatedProgressBar from '@/components/AnimatedProgressBar';
import { supabase, type Quiz, type QuizQuestion } from '@/lib/supabase';
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
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

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

  if (!quiz || questions.length === 0) {
    return (
      <AuroraBackground>
        <View style={[styles.center, { paddingTop: topPad }]}>
          <Ionicons name="hourglass-outline" size={36} color="#4A5080" />
          <Text style={styles.loadingText}>Loading quiz...</Text>
        </View>
      </AuroraBackground>
    );
  }

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity
            onPress={() => Alert.alert('Leave Quiz', 'Your progress will be lost.', [
              { text: 'Stay', style: 'cancel' },
              { text: 'Leave', style: 'destructive', onPress: () => router.back() },
            ])}
            style={styles.backBtn}
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{quiz.title}</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.timerRow}>
          {timeLeft !== null && (
            <View style={[styles.timer, timeLeft < 60 && styles.timerUrgent]}>
              <Ionicons name="timer-outline" size={14} color={timeLeft < 60 ? '#FF5370' : '#F59E0B'} />
              <Text style={[styles.timerText, timeLeft < 60 && { color: '#FF5370' }]}>
                {formatTime(timeLeft)}
              </Text>
            </View>
          )}
          <Text style={styles.counter}>{currentIndex + 1} of {questions.length}</Text>
        </View>

        <AnimatedProgressBar
          progress={progress}
          color="#3D5AFE"
          height={3}
          style={{ marginHorizontal: 20, marginBottom: 12 }}
        />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          <View style={styles.dotRow}>
            {questions.map((q, i) => (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.dot,
                  i === currentIndex && styles.dotActive,
                  answers[q.id]?.answer?.trim() && styles.dotAnswered,
                ]}
                onPress={() => setCurrentIndex(i)}
              />
            ))}
          </View>

          {currentQuestion && (
            <>
              <View style={styles.questionMeta}>
                <Text style={styles.questionType}>
                  {isDirect ? 'Direct Answer' : 'Multiple Choice'}
                </Text>
                <Text style={styles.questionPoints}>{currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}</Text>
              </View>

              <Text style={styles.prompt}>{currentQuestion.promptSnapshot}</Text>

              {isDirect ? (
                <TextInput
                  style={styles.textarea}
                  multiline
                  placeholder="Type your answer..."
                  placeholderTextColor="#4A5080"
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
                          isSelected && styles.optionSelected,
                          isSelected && {
                            borderColor: '#3D5AFE',
                            shadowColor: '#3D5AFE',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.6,
                            shadowRadius: 12,
                            elevation: 8,
                          },
                        ]}
                        onPress={() => selectOption(opt.label)}
                        activeOpacity={0.8}
                      >
                        <View style={[styles.optionRadio, isSelected && styles.optionRadioSelected]}>
                          {isSelected && <View style={styles.optionRadioInner} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionLabel}>{opt.label}.</Text>
                          <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                            {opt.text}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color="#3D5AFE" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
              onPress={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <Ionicons name="arrow-back" size={18} color={currentIndex === 0 ? '#4A5080' : '#FFFFFF'} />
              <Text style={[styles.navBtnText, currentIndex === 0 && { color: '#4A5080' }]}>Prev</Text>
            </TouchableOpacity>

            <Text style={styles.answeredCount}>
              {answeredCount}/{questions.length} answered
            </Text>

            {isLast ? (
              <TouchableOpacity
                style={[styles.submitBtn, !allAnswered && { opacity: 0.6 }]}
                onPress={confirmSubmit}
                disabled={submitting}
              >
                <LinearGradient colors={['#3D5AFE', '#00BCD4']} style={styles.submitGrad}>
                  <Text style={styles.submitText}>{submitting ? 'Submitting...' : 'Submit'}</Text>
                  <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.navBtn}
                onPress={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              >
                <Text style={styles.navBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </AuroraBackground>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#8892B0', fontSize: 15 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center', marginHorizontal: 10 },
  timerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 8 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  timerUrgent: { backgroundColor: 'rgba(255,83,112,0.15)' },
  timerText: { fontSize: 14, fontWeight: '700', color: '#F59E0B' },
  counter: { fontSize: 13, color: '#8892B0', fontWeight: '500' },
  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.15)' },
  dotActive: { backgroundColor: '#3D5AFE', width: 20, borderRadius: 4 },
  dotAnswered: { backgroundColor: '#2ECC71' },
  questionMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  questionType: { fontSize: 11, fontWeight: '700', color: '#8892B0', textTransform: 'uppercase', letterSpacing: 0.5 },
  questionPoints: { fontSize: 11, fontWeight: '700', color: '#F59E0B' },
  prompt: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', lineHeight: 28, marginBottom: 24 },
  textarea: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 16,
    backgroundColor: 'rgba(20,29,58,0.9)', color: '#FFFFFF', fontSize: 15,
    padding: 16, minHeight: 140, textAlignVertical: 'top', lineHeight: 22,
  },
  optionsContainer: { gap: 12 },
  optionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(20,29,58,0.9)', borderRadius: 16,
    padding: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.07)',
  },
  optionSelected: {
    borderColor: '#3D5AFE', backgroundColor: 'rgba(61,90,254,0.08)',
  },
  optionRadio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  optionRadioSelected: { borderColor: '#3D5AFE' },
  optionRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#3D5AFE' },
  optionLabel: { fontSize: 13, fontWeight: '700', color: '#8892B0', marginBottom: 2 },
  optionText: { fontSize: 15, color: '#CCCCCC', lineHeight: 20 },
  optionTextSelected: { color: '#FFFFFF' },
  footer: { paddingHorizontal: 20 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12, paddingHorizontal: 16 },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  answeredCount: { fontSize: 12, color: '#8892B0', fontWeight: '500' },
  submitBtn: { borderRadius: 14, overflow: 'hidden' },
  submitGrad: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 20 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
