import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { useApp } from '@/context/AppContext';
import { useColors } from '@/hooks/useColors';
import { SUBJECTS, Topic, Lesson } from '@/data/learningData';
import { computeMastery } from '@/context/AppContext';
import { isLessonUnlocked, MASTERY_THRESHOLD } from '@/lib/mastery';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  multipleChoice: 'Multiple Choice',
  tapCorrect: 'Tap Correct',
  fillBlank: 'Fill in Blank',
  dragOrder: 'Put in Order',
  matchPairs: 'Match Pairs',
  numberLine: 'Number Line',
  trueFalse: 'True or False',
  writing: 'Spelling',
};

export default function LearningScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { lessonProgress, gamification } = useApp();
  const [activeSubject, setActiveSubject] = useState<'math' | 'english'>('math');
  const topPad = Platform.OS === 'web' ? 67 : insets.top;

  const subject = SUBJECTS.find(s => s.id === activeSubject)!;
  const totalLessons = subject.topics.reduce((sum, t) => sum + t.lessons.length, 0);
  const completedLessons = subject.topics.reduce((sum, t) => sum + t.lessons.filter(l => lessonProgress[l.id]?.completed).length, 0);

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 + 84 : 100, maxWidth: 720, alignSelf: 'center', width: '100%' }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={[styles.headerTitle, { color: c.foreground }]}>Learning Hub</Text>
            <Text style={[styles.headerSub, { color: c.mutedForeground }]}>
              Optional practice for your child. Progress is kept privately.
            </Text>
          </View>
          <View style={styles.headerBadges}>
            {gamification.currentStreak > 0 && (
              <View style={[styles.streakBadge, { backgroundColor: `${c.destructive}26` }]}>
                <Ionicons name="flame" size={14} color={c.destructive} />
                <Text style={[styles.streakText, { color: c.destructive }]}>{gamification.currentStreak}</Text>
              </View>
            )}
            <View style={[styles.levelBadge, { backgroundColor: `${c.gold}1F` }]}>
              <Ionicons name="trophy" size={14} color={c.gold} />
              <Text style={[styles.levelText, { color: c.gold }]}>Lv.{gamification.level}</Text>
            </View>
            <View style={[styles.xpBadge, { backgroundColor: `${c.gold}1F` }]}>
              <Ionicons name="star" size={14} color={c.gold} />
              <Text style={[styles.xpText, { color: c.gold }]}>{Object.values(lessonProgress).filter(p => p.completed).reduce((s, p) => s + p.xpEarned, 0)} XP</Text>
            </View>
          </View>
        </View>

        <View style={styles.subjectToggle}>
          {SUBJECTS.map(s => (
            <TouchableOpacity
              key={s.id}
              style={[
                styles.subjectTab,
                { backgroundColor: c.card, borderColor: c.border },
                activeSubject === s.id && { backgroundColor: s.color, borderColor: s.color },
              ]}
              onPress={() => setActiveSubject(s.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={s.iconName as any} size={16} color={activeSubject === s.id ? '#FFFFFF' : s.color} />
              <Text style={[styles.subjectTabText, { color: activeSubject === s.id ? '#FFFFFF' : c.foreground }]}>{s.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.progressCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: c.mutedForeground }]}>{subject.title} Progress</Text>
            <Text style={[styles.progressPct, { color: subject.color }]}>{completedLessons}/{totalLessons} lessons</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
            <View style={[styles.progressFill, { width: `${totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}%` as any, backgroundColor: subject.color }]} />
          </View>
        </View>

        {(() => {
          const subjectLessonIds = new Set(subject.topics.flatMap(t => t.lessons.map(l => l.id)));
          const mastery = computeMastery(lessonProgress, subjectLessonIds);
          const entries = Object.entries(mastery);
          return entries.length > 0 ? (
            <View style={[styles.masteryCard, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.masteryTitle, { color: c.mutedForeground }]}>Mastery by Activity Type</Text>
              <View style={styles.masteryGrid}>
                {entries.map(([type, m]) => {
                  const mapColors: Record<string, string> = {
                    multipleChoice: '#3D5AFE', tapCorrect: '#00BCD4', fillBlank: '#2ECC71',
                    dragOrder: '#F59E0B', matchPairs: '#EC4899', numberLine: '#8B5CF6',
                    trueFalse: '#FF5370', writing: '#14B8A6',
                  };
                  const color = mapColors[type] || c.mutedForeground;
                  return (
                    <View key={type} style={[styles.masteryItem, { borderColor: `${color}33` }]}>
                      <View style={styles.masteryItemHeader}>
                        <Text style={[styles.masteryType, { color }]}>{ACTIVITY_TYPE_LABELS[type] || type}</Text>
                        <Text style={[styles.masteryPct, { color }]}>{m.pct}%</Text>
                      </View>
                      <View style={[styles.masteryTrack, { backgroundColor: c.border }]}>
                        <View style={[styles.masteryFill, { width: `${m.pct}%` as any, backgroundColor: color }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null;
        })()}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeKeyRow}>
          {Object.entries(ACTIVITY_TYPE_LABELS).map(([type, label]) => (
            <View key={type} style={[styles.typeChip, { backgroundColor: c.muted, borderColor: c.border }]}>
              <ActivityTypeIcon type={type} size={12} />
              <Text style={[styles.typeChipText, { color: c.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </ScrollView>

        {subject.topics.map(topic => (
          <TopicCard key={topic.id} topic={topic} lessonProgress={lessonProgress} />
        ))}
      </ScrollView>
    </AuroraBackground>
  );
}

function TopicCard({ topic, lessonProgress }: { topic: Topic; lessonProgress: Record<string, any> }) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const completed = topic.lessons.filter(l => lessonProgress[l.id]?.completed).length;
  const total = topic.lessons.length;

  return (
    <View style={[styles.topicCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.8} style={styles.topicHeader}>
        <View style={[styles.topicIcon, { backgroundColor: `${topic.color}22` }]}>
          <Ionicons name={topic.iconName as any} size={22} color={topic.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.topicTitle, { color: c.foreground }]}>{topic.title}</Text>
          <Text style={[styles.topicDesc, { color: c.mutedForeground }]} numberOfLines={1}>{topic.description}</Text>
          <View style={[styles.topicProgress, { backgroundColor: c.border }]}>
            <View style={[styles.topicProgressFill, { width: `${total > 0 ? (completed / total) * 100 : 0}%` as any, backgroundColor: topic.color }]} />
          </View>
          <Text style={[styles.topicProgressLabel, { color: c.mutedForeground }]}>{completed}/{total} lessons</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={[styles.lessonList, { borderTopColor: c.border }]}>
          {topic.lessons.map((lesson, i) => {
            const progress = lessonProgress[lesson.id];
            const done = progress?.completed;
            const unlocked = isLessonUnlocked(lesson.id, lesson.prerequisiteLessonId, lessonProgress);
            const masteryPct = progress?.masteryLevel ?? 0;
            const types = [...new Set(lesson.activities.map(a => a.type))];
            const showLocked = !unlocked && !!lesson.prerequisiteLessonId;
            const showMastery = unlocked && done && masteryPct > 0;
            return (
              <TouchableOpacity
                key={lesson.id}
                style={[styles.lessonRow, { borderBottomColor: c.border }, done && styles.lessonRowDone, !unlocked && styles.lessonRowLocked]}
                onPress={() => { if (unlocked) router.push({ pathname: '/lesson/[id]', params: { id: lesson.id, topicId: topic.id } }); }}
                activeOpacity={unlocked ? 0.8 : 1}
              >
                <View style={[styles.lessonNum, { backgroundColor: c.muted }, done && { backgroundColor: topic.color }, !unlocked && { backgroundColor: c.muted }]}>
                  {!unlocked ? <Ionicons name="lock-closed" size={13} color={c.mutedForeground} /> :
                   done ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> :
                   <Text style={[styles.lessonNumText, { color: topic.color }]}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lessonTitle, { color: c.foreground }, !unlocked && { color: c.mutedForeground }]}>{lesson.title}</Text>
                  {showLocked ? (
                    <Text style={[styles.lockedHint, { color: c.mutedForeground }]}>Master the previous lesson first</Text>
                  ) : showMastery ? (
                    <Text style={[styles.masteryHint, { color: c.accent }]}>Mastery {masteryPct}%</Text>
                  ) : (
                    <View style={styles.lessonMeta}>
                      {types.map(type => (
                        <View key={type} style={[styles.activityTypePill, { backgroundColor: c.muted }]}>
                          <ActivityTypeIcon type={type} size={10} />
                          <Text style={[styles.activityTypePillText, { color: c.mutedForeground }]}>{ACTIVITY_TYPE_LABELS[type]}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {unlocked ? (
                  <View style={[styles.xpPill, { backgroundColor: `${c.gold}1F` }]}>
                    <Text style={[styles.xpPillText, { color: c.gold }]}>+{lesson.xp} XP</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function ActivityTypeIcon({ type, size }: { type: string; size: number }) {
  const map: Record<string, { icon: any; color: string }> = {
    multipleChoice: { icon: 'radio-button-on', color: '#3D5AFE' },
    tapCorrect: { icon: 'hand-right', color: '#00BCD4' },
    fillBlank: { icon: 'pencil', color: '#2ECC71' },
    dragOrder: { icon: 'swap-vertical', color: '#F59E0B' },
    matchPairs: { icon: 'git-compare', color: '#EC4899' },
    numberLine: { icon: 'analytics', color: '#8B5CF6' },
    trueFalse: { icon: 'checkmark-circle', color: '#FF5370' },
    writing: { icon: 'text', color: '#14B8A6' },
  };
  const cfg = map[type] ?? { icon: 'help-circle', color: '#8892B0' };
  return <Ionicons name={cfg.icon} size={size} color={cfg.color} />;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  xpText: { fontSize: 13, fontWeight: '700' },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  streakText: { fontSize: 13, fontWeight: '700' },
  levelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20 },
  levelText: { fontSize: 13, fontWeight: '700' },
  subjectToggle: { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 16 },
  subjectTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  subjectTabText: { fontSize: 14, fontWeight: '700' },
  progressCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  progressLabel: { fontSize: 13 },
  progressPct: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3 },
  progressFill: { height: 6, borderRadius: 3 },
  typeKeyRow: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  masteryCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1 },
  masteryTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 12 },
  masteryGrid: { gap: 10 },
  masteryItem: { borderRadius: 10, padding: 10, borderWidth: 1 },
  masteryItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  masteryType: { fontSize: 12, fontWeight: '600' },
  masteryPct: { fontSize: 13, fontWeight: '800' },
  masteryTrack: { height: 4, borderRadius: 2 },
  masteryFill: { height: 4, borderRadius: 2 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1 },
  typeChipText: { fontSize: 10 },
  topicCard: { marginHorizontal: 20, marginBottom: 12, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  topicHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  topicIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  topicDesc: { fontSize: 12, marginBottom: 6 },
  topicProgress: { height: 4, borderRadius: 2, marginBottom: 2 },
  topicProgressFill: { height: 4, borderRadius: 2 },
  topicProgressLabel: { fontSize: 10 },
  lessonList: { borderTopWidth: 1 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  lessonRowDone: { opacity: 0.8 },
  lessonRowLocked: { opacity: 0.55 },
  lockedHint: { fontSize: 11, marginTop: 2 },
  masteryHint: { fontSize: 11, marginTop: 2, fontWeight: '600' },
  lessonNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lessonNumText: { fontSize: 12, fontWeight: '700' },
  lessonTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  lessonMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  activityTypePill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  activityTypePillText: { fontSize: 9 },
  xpPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  xpPillText: { fontSize: 11, fontWeight: '700' },
});
