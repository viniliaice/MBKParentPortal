import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Alert, Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import ActivityRenderer from '@/components/ActivityRenderer';
import ConceptAnimation from '@/components/ConceptAnimation';
import CelebrationOverlay from '@/components/CelebrationOverlay';
import { getLessonById, getTopicById } from '@/data/learningData';
import { useApp } from '@/context/AppContext';
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
  const { saveLessonProgress, gamification } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const lesson = getLessonById(id);
  const topic = getTopicById(topicId);

  const [step, setStep] = useState<'intro' | 'animation' | number | 'done'>('intro');
  const [correctCount, setCorrectCount] = useState(0);
  const [showCelebration, setShowCelebration] = useState(false);
  const [activityResults, setActivityResults] = useState<{ activityId: string; type: string; correct: boolean }[]>([]);
  const activityStartTime = React.useRef(Date.now());
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0.7);
    Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }, [step]);

  if (!lesson || !topic) {
    return (
      <AuroraBackground>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 16 }}>Lesson not found</Text>
        </View>
      </AuroraBackground>
    );
  }

  const activities = lesson.activities;
  const currentIdx = typeof step === 'number' ? step : -1;
  const currentActivity = currentIdx >= 0 ? activities[currentIdx] : null;

  const totalSteps = activities.length + 3;
  const currentStepNum = step === 'intro' ? 0 : step === 'animation' ? 1 : step === 'done' ? totalSteps - 1 : (step as number) + 2;
  const progress = currentStepNum / (totalSteps - 1);

  const handleCorrect = () => {
    setCorrectCount(c => c + 1);
    if (currentActivity) {
      setActivityResults(prev => [...prev, { activityId: currentActivity.id, type: currentActivity.type, correct: true }]);
    }
  };

  const handleIncorrect = () => {
    if (currentActivity) {
      setActivityResults(prev => [...prev, { activityId: currentActivity.id, type: currentActivity.type, correct: false }]);
    }
  };

  const handleAnimationComplete = () => {
    setStep(0);
  };

  const handleNext = () => {
    if (step === 'intro') {
      setStep('animation');
    } else if (typeof step === 'number') {
      if (step < activities.length - 1) {
        setStep(step + 1);
      } else {
        saveLessonProgress({
          lessonId: lesson.id,
          completed: true,
          xpEarned: lesson.xp,
          correctCount,
          totalActivities: activities.length,
          completedAt: new Date().toISOString(),
          activityResults: activityResults.map(ar => ({ ...ar, timeSpentMs: 0 })),
        });
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
          <TouchableOpacity onPress={handleExit} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` as any, backgroundColor: topic.color }]} />
            </View>
            <Text style={styles.progressLabel}>{currentStepNum + 1}/{totalSteps}</Text>
          </View>
        </View>

        {step === 'animation' ? (
          <View style={styles.animationContainer}>
            <ConceptAnimation topicId={topicId} topicColor={topic.color} onComplete={handleAnimationComplete} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {step === 'intro' ? (
              <View style={styles.introContainer}>
                <View style={[styles.introIcon, { backgroundColor: `${topic.color}22` }]}>
                  <Ionicons name={topic.iconName as any} size={40} color={topic.color} />
                </View>
                <Text style={styles.lessonTitle}>{lesson.title}</Text>
                <View style={[styles.objectiveBox, { borderColor: `${topic.color}44` }]}>
                  <Text style={styles.objectiveLabel}>GOAL</Text>
                  <Text style={styles.objectiveText}>{lesson.objective}</Text>
                </View>
                <View style={styles.explanationBox}>
                  <Text style={styles.explanationText}>{lesson.explanation}</Text>
                </View>
                <View style={styles.activityTypesPreview}>
                  <Text style={styles.activityTypesLabel}>THIS LESSON USES:</Text>
                  <View style={styles.activityTypesRow}>
                    {[...new Set(activities.map(a => a.type))].map(type => (
                      <View key={type} style={styles.activityTypePill}>
                        <Text style={styles.activityTypePillText}>{TYPE_DESCRIPTIONS[type]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                <TouchableOpacity style={[styles.startBtn, { backgroundColor: topic.color }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.startBtnText}>Start Lesson</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            ) : (
              <Animated.View style={[styles.activityContainer, { opacity: fadeAnim }]}>
                <View style={styles.activityHeader}>
                  <Text style={styles.activityNum}>Question {(step as number) + 1} of {activities.length}</Text>
                  <View style={[styles.activityTypeBadge, { backgroundColor: `${topic.color}22`, borderColor: `${topic.color}44` }]}>
                    <Text style={[styles.activityTypeBadgeText, { color: topic.color }]}>{TYPE_DESCRIPTIONS[currentActivity!.type]}</Text>
                  </View>
                </View>
                <View style={styles.questionBox}>
                  <Text style={styles.questionText}>{currentActivity!.question}</Text>
                </View>
                <ActivityRenderer
                  key={step}
                  activity={currentActivity!}
                  onCorrect={handleCorrect}
                  onIncorrect={handleIncorrect}
                />
                <TouchableOpacity style={[styles.nextBtn, { backgroundColor: topic.color }]} onPress={handleNext} activeOpacity={0.85}>
                  <Text style={styles.nextBtnText}>{(step as number) < activities.length - 1 ? 'Next' : 'Finish'}</Text>
                  <Ionicons name={(step as number) < activities.length - 1 ? 'arrow-forward' : 'checkmark'} size={18} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  progressContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTrack: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  progressLabel: { fontSize: 12, color: '#8892B0', width: 40, textAlign: 'right' },
  content: { padding: 20, paddingBottom: 40 },
  introContainer: { alignItems: 'center', gap: 20 },
  introIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  lessonTitle: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' },
  objectiveBox: { width: '100%', borderRadius: 16, padding: 16, borderWidth: 1.5, backgroundColor: 'rgba(255,255,255,0.03)' },
  objectiveLabel: { fontSize: 10, fontWeight: '700', color: '#8892B0', letterSpacing: 1, marginBottom: 6 },
  objectiveText: { fontSize: 15, color: '#FFFFFF', lineHeight: 22 },
  explanationBox: { width: '100%', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 16 },
  explanationText: { fontSize: 15, color: '#CCCCCC', lineHeight: 24 },
  activityTypesPreview: { width: '100%' },
  activityTypesLabel: { fontSize: 10, fontWeight: '700', color: '#8892B0', letterSpacing: 1, marginBottom: 8 },
  activityTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  activityTypePill: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  activityTypePillText: { fontSize: 12, color: '#CCCCCC' },
  animationContainer: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  startBtn: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 4 },
  startBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  activityContainer: { gap: 20 },
  activityHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityNum: { fontSize: 13, color: '#8892B0' },
  activityTypeBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1 },
  activityTypeBadgeText: { fontSize: 11, fontWeight: '600' },
  questionBox: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20 },
  questionText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', lineHeight: 26 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 16, marginTop: 8 },
  nextBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
