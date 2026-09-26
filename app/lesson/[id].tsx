import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import ActivityRenderer from '@/components/ActivityRenderer';
import ConceptAnimation from '@/components/ConceptAnimation';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import { getLessonById, getTopicById } from '@/data/learningData';
import { useApp } from '@/context/AppContext';
import { useColors, type Colors } from '@/hooks/useColors';
import { accessibleAccent, withAlpha } from '@/constants/colors';
import { useTopPadding } from '@/hooks/useScreenInsets';
import { useTheme } from '@/context/ThemeContext';
import * as Haptics from 'expo-haptics';

const TYPE_DESCRIPTIONS: Record<string, string> = {
  multipleChoice: 'Choose the correct answer',
  tapCorrect: 'Tap the correct answer',
  fillBlank: 'Fill in the blank',
  dragOrder: 'Tap in the correct order',
  matchPairs: 'Match the pairs',
  numberLine: 'Find the number',
  trueFalse: 'True or False',
  writing: 'Spell it right',
};

export default function LessonScreen() {
  const { id, topicId } = useLocalSearchParams<{ id: string; topicId: string }>();
  const { saveLessonAttempt, gamification } = useApp();
  const c = useColors();
  const { isDark } = useTheme();
  const topPad = useTopPadding();
  const styles = useMemo(() => makeStyles(c), [c]);

  const lesson = getLessonById(id);
  const topic = getTopicById(topicId);

  const [step, setStep] = useState<'intro' | 'animation' | number | 'review' | 'done'>('intro');
  const [correctCount, setCorrectCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activityResults, setActivityResults] = useState<{ activityId: string; type: string; correct: boolean }[]>([]);
  const [answeredCurrent, setAnsweredCurrent] = useState(false);
  const [reviewingActivityIdx, setReviewingActivityIdx] = useState<number>(-1);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0.7);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [step]);

  if (!lesson || !topic) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: c.foreground, fontSize: 16 }}>Lesson not found</Text>
        </View>
      </AuroraBackground>
    );
  }

  // The curriculum's topic colour is designed for a dark surface; in light mode it is
  // shaded so labels and bars stay readable.
  const topicColor = accessibleAccent(topic.color, isDark);

  const activities = lesson.activities;
  const currentIdx = typeof step === 'number' ? step : -1;
  const currentActivity = currentIdx >= 0 ? activities[currentIdx] : null;

  const totalSteps = activities.length + 2;
  const currentStepNum = step === 'intro' ? 0 : step === 'animation' ? 1 : step === 'done' ? totalSteps - 1 : (step as number) + 2;
  const progress = currentStepNum / (totalSteps - 1);

  const handleCorrect = () => {
    setCorrectCount(c => c + 1);
    if (currentActivity) {
      setActivityResults(prev => [...prev, { activityId: currentActivity.id, type: currentActivity.type, correct: true }]);
    }
    setAnsweredCurrent(true);
  };

  const handleIncorrect = () => {
    if (currentActivity) {
      setActivityResults(prev => [...prev, { activityId: currentActivity.id, type: currentActivity.type, correct: false }]);
    }
    setAnsweredCurrent(true);
    setReviewingActivityIdx(currentIdx);
    setStep('review');
  };

  const handleReviewComplete = () => {
    setStep(reviewingActivityIdx);
    setAnsweredCurrent(false);
    setActivityResults(prev => prev.slice(0, -1));
  };

  const handleAnimationComplete = () => {
    setStep(0);
  };

  const handleNext = () => {
    if (step === 'intro') {
      setStep('animation');
    } else if (typeof step === 'number') {
      if (!answeredCurrent) return;
      if (step < activities.length - 1) {
        setAnsweredCurrent(false);
        setStep(step + 1);
      } else {
        saveLessonAttempt(lesson.id, correctCount, activities.length, activityResults.map(ar => ({ ...ar, timeSpentMs: 0 })));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setShowCelebration(true);
      }
    }
  };

  const handleExit = () => {
    Alert.alert('Leave Lesson', 'Your progress in this lesson will be lost. Are you sure?', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <AuroraBackground>
      <View style={{ flex: 1 }}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={handleExit} style={[styles.closeBtn, { backgroundColor: c.surfaceMuted }]} accessibilityRole="button" accessibilityLabel="Leave lesson">
            <Ionicons name="close" size={20} color={c.foreground} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressTrack, { backgroundColor: c.surfaceSunken }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as never, backgroundColor: topicColor }]} />
            </View>
            <Text style={[styles.progressLabel, { color: c.textSecondary }]}>{currentStepNum + 1}/{totalSteps}</Text>
          </View>
        </View>

        {step === 'animation' ? (
          <View style={styles.animationContainer}>
            <ConceptAnimation topicId={topicId} topicColor={topicColor} onComplete={handleAnimationComplete} />
          </View>
        ) : step === 'review' ? (
          <View style={styles.animationContainer}>
            <ConceptAnimation topicId={topicId} topicColor={topicColor} review onComplete={handleReviewComplete} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'intro' ? (
              <View style={styles.introContainer}>
                <View style={[styles.introIcon, { backgroundColor: withAlpha(topic.color, 0.13) }]}>
                  <Ionicons name={topic.iconName as never} size={40} color={topicColor} />
                </View>
                <Text style={[styles.lessonTitle, { color: c.foreground }]}>{lesson.title}</Text>
                <View style={[styles.objectiveBox, { borderColor: withAlpha(topic.color, 0.27), backgroundColor: c.surfaceMuted }]}>
                  <Text style={[styles.objectiveLabel, { color: c.textSecondary }]}>GOAL</Text>
                  <Text style={[styles.objectiveText, { color: c.foreground }]}>{lesson.objective}</Text>
                </View>
                <View style={[styles.explanationBox, { backgroundColor: c.surfaceMuted }]}>
                  <Text style={[styles.explanationText, { color: c.textBody }]}>{lesson.explanation}</Text>
                </View>
                <View style={styles.activityTypesPreview}>
                  <Text style={[styles.activityTypesLabel, { color: c.textSecondary }]}>THIS LESSON USES:</Text>
                  <View style={styles.activityTypesRow}>
                    {[...new Set(activities.map(a => a.type))].map(type => (
                      <View key={type} style={[styles.activityTypePill, { backgroundColor: c.surfaceMuted }]}>
                        <Text style={[styles.activityTypePillText, { color: c.textBody }]}>{TYPE_DESCRIPTIONS[type]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={[styles.startBtn, { backgroundColor: topicColor }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={[styles.startBtnText, { color: c.onBrand }]}>Start Lesson</Text>
                  <Ionicons name="arrow-forward" size={18} color={c.onBrand} />
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={[styles.activityContainer, { opacity: fadeAnim }]}>
                <View style={styles.activityHeader}>
                  <Text style={[styles.activityNum, { color: c.textSecondary }]}>
                    Question {(step as number) + 1} of {activities.length}
                  </Text>
                  <View style={[styles.activityTypeBadge, { backgroundColor: withAlpha(topic.color, 0.13), borderColor: withAlpha(topic.color, 0.27) }]}>
                    <Text style={[styles.activityTypeBadgeText, { color: topicColor }]}>
                      {TYPE_DESCRIPTIONS[currentActivity!.type]}
                    </Text>
                  </View>
                </View>
                <View style={[styles.questionBox, { backgroundColor: c.surface }]}>
                  <Text style={[styles.questionText, { color: c.foreground }]}>{currentActivity!.question}</Text>
                </View>
                <ActivityRenderer
                  key={step}
                  activity={currentActivity!}
                  onCorrect={handleCorrect}
                  onIncorrect={handleIncorrect}
                />
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: answeredCurrent ? topicColor : c.surfaceMuted }]}
                  onPress={handleNext}
                  activeOpacity={0.85}
                  disabled={!answeredCurrent}
                >
                  <Text style={[styles.nextBtnText, { color: answeredCurrent ? c.onBrand : c.textDim }]}>
                    {(step as number) < activities.length - 1 ? 'Next' : 'Finish'}
                  </Text>
                  <Ionicons
                    name={(step as number) < activities.length - 1 ? 'arrow-forward' : 'checkmark'}
                    size={18}
                    color={answeredCurrent ? c.onBrand : c.textDim}
                  />
                </TouchableOpacity>
              </Animated.View>
            )}
          </ScrollView>
        )}

        {showCelebration && (
          <CelebrationOverlay
            xpGained={lesson.xp}
            badgeName={lesson.badgeName}
            badgeIcon={lesson.badgeIcon}
            correctCount={correctCount}
            totalActivities={activities.length}
            streak={gamification.currentStreak}
            level={gamification.level}
            dailyBonus={10}
            onContinue={() => { setShowCelebration(false); router.back(); }}
          />
        )}
      </View>
    </AuroraBackground>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  progressContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, width: 44, textAlign: 'right' },
  content: { padding: 20, paddingBottom: 40 },
  introContainer: { alignItems: 'center', gap: 20 },
  introIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lessonTitle: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  objectiveBox: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1.5 },
  objectiveLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  objectiveText: { fontSize: 15, lineHeight: 22 },
  explanationBox: { width: '100%', borderRadius: 16, padding: 16 },
  explanationText: { fontSize: 15, lineHeight: 24 },
  activityTypesPreview: { width: '100%' },
  activityTypesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  activityTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityTypePill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  activityTypePillText: { fontSize: 12 },
  animationContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  startBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 4 },
  startBtnText: { fontSize: 16, fontWeight: '700' },
  activityContainer: { gap: 20 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityNum: { fontSize: 13 },
  activityTypeBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  activityTypeBadgeText: { fontSize: 11, fontWeight: '600' },
  questionBox: { borderRadius: 16, padding: 20, borderWidth: 1, borderColor: c.border },
  questionText: { fontSize: 18, fontWeight: '700', lineHeight: 26 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
});
