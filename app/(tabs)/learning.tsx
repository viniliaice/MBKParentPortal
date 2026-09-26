import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AuroraBackground from '@/components/AuroraBackground';
import { Card } from '@/components/Card';
import { useApp } from '@/context/AppContext';
import { useColors, type Colors } from '@/hooks/useColors';
import { useTabBarSpacing } from '@/hooks/useScreenInsets';
import { accessibleAccent } from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';
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

/**
 * Practice material. It is reachable from More rather than the tab bar — it is not
 * one of the two questions the parent app answers — but it is otherwise unchanged.
 */
export default function LearningScreen() {
  const { lessonProgress, gamification } = useApp();
  const c = useColors();
  const { isDark } = useTheme();
  const tabSpacing = useTabBarSpacing();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [activeSubject, setActiveSubject] = useState<'math' | 'english'>('math');

  const subject = SUBJECTS.find(s => s.id === activeSubject)!;
  const subjectColor = accessibleAccent(subject.color, isDark);
  const totalLessons = subject.topics.reduce((sum, t) => sum + t.lessons.length, 0);
  const completedLessons = subject.topics.reduce((sum, t) => sum + t.lessons.filter(l => lessonProgress[l.id]?.completed).length, 0);
  const totalXP = Object.values(lessonProgress).filter(p => p.completed).reduce((s, p) => s + p.xpEarned, 0);

  return (
    <AuroraBackground>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: tabSpacing + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: 0 }]}>
          <Text style={[styles.headerTitle, { color: c.foreground }]}>Learning</Text>
          <View style={styles.headerBadges}>
            {gamification.currentStreak > 0 ? (
              <View style={[styles.badge, { backgroundColor: c.surfaceMuted }]}>
                <Ionicons name="flame" size={13} color={c.destructive} />
                <Text style={[styles.badgeText, { color: c.destructive }]}>{gamification.currentStreak}</Text>
              </View>
            ) : null}
            <View style={[styles.badge, { backgroundColor: c.surfaceMuted }]}>
              <Ionicons name="trophy" size={13} color={c.warning} />
              <Text style={[styles.badgeText, { color: c.warning }]}>Level {gamification.level}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: c.surfaceMuted }]}>
              <Ionicons name="star" size={13} color={c.warning} />
              <Text style={[styles.badgeText, { color: c.warning }]}>{totalXP} XP</Text>
            </View>
          </View>
        </View>

        <View style={styles.subjectToggle}>
          {SUBJECTS.map(s => {
            const active = activeSubject === s.id;
            const color = accessibleAccent(s.color, isDark);
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.subjectTab,
                  { backgroundColor: active ? color : c.surface, borderColor: active ? color : c.border },
                ]}
                onPress={() => setActiveSubject(s.id as 'math' | 'english')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={s.iconName as never} size={16} color={active ? c.onBrand : color} />
                <Text style={[styles.subjectTabText, { color: active ? c.onBrand : c.textSecondary }]}>{s.title}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Card style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressLabel, { color: c.textSecondary }]}>{subject.title} progress</Text>
            <Text style={[styles.progressPct, { color: subjectColor }]}>{completedLessons}/{totalLessons} lessons</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: c.surfaceSunken }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0}%` as never, backgroundColor: subjectColor },
              ]}
            />
          </View>
        </Card>

        {(() => {
          const subjectLessonIds = new Set(subject.topics.flatMap(t => t.lessons.map(l => l.id)));
          const mastery = computeMastery(lessonProgress, subjectLessonIds);
          const entries = Object.entries(mastery);
          return entries.length > 0 ? (
            <Card style={styles.masteryCard}>
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>MASTERY BY ACTIVITY TYPE</Text>
              <View style={{ gap: 10 }}>
                {entries.map(([type, m]) => (
                  <View key={type} style={styles.masteryRow}>
                    <Text style={[styles.masteryType, { color: c.textBody }]} numberOfLines={1}>
                      {ACTIVITY_TYPE_LABELS[type] || type}
                    </Text>
                    <View style={[styles.masteryTrack, { backgroundColor: c.surfaceSunken }]}>
                      <View style={[styles.masteryFill, { width: `${m.pct}%` as never, backgroundColor: subjectColor }]} />
                    </View>
                    <Text style={[styles.masteryPct, { color: c.foreground }]}>{m.pct}%</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null;
        })()}

        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>TOPICS</Text>
        {subject.topics.map(topic => (
          <TopicCard key={topic.id} topic={topic} lessonProgress={lessonProgress} />
        ))}
      </ScrollView>
    </AuroraBackground>
  );
}

function TopicCard({ topic, lessonProgress }: { topic: Topic; lessonProgress: ReturnType<typeof useApp>['lessonProgress'] }) {
  const c = useColors();
  const { isDark } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [expanded, setExpanded] = useState(false);
  const topicColor = accessibleAccent(topic.color, isDark);
  const completed = topic.lessons.filter(l => lessonProgress[l.id]?.completed).length;
  const total = topic.lessons.length;

  return (
    <Card style={styles.topicCard} padded={false}>
      <TouchableOpacity onPress={() => setExpanded(!expanded)} activeOpacity={0.85} style={styles.topicHeader} accessibilityRole="button">
        <View style={[styles.topicIcon, { backgroundColor: `${topic.color}22` }]}>
          <Ionicons name={topic.iconName as never} size={22} color={topicColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.topicTitle, { color: c.foreground }]}>{topic.title}</Text>
          <Text style={[styles.topicDesc, { color: c.textSecondary }]} numberOfLines={1}>{topic.description}</Text>
          <View style={[styles.topicProgress, { backgroundColor: c.surfaceSunken }]}>
            <View
              style={[
                styles.topicProgressFill,
                { width: `${total > 0 ? (completed / total) * 100 : 0}%` as never, backgroundColor: topicColor },
              ]}
            />
          </View>
          <Text style={[styles.topicProgressLabel, { color: c.textSecondary }]}>{completed}/{total} lessons</Text>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={c.textSecondary} />
      </TouchableOpacity>

      {expanded ? (
        <View style={[styles.lessonList, { borderTopColor: c.border }]}>
          {topic.lessons.map((lesson: Lesson, i: number) => {
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
                style={[styles.lessonRow, { borderBottomColor: c.border, opacity: unlocked ? 1 : 0.6 }]}
                onPress={() => { if (unlocked) router.push({ pathname: '/lesson/[id]', params: { id: lesson.id, topicId: topic.id } }); }}
                activeOpacity={unlocked ? 0.85 : 1}
                accessibilityRole="button"
              >
                <View style={[styles.lessonNum, { backgroundColor: done ? topicColor : c.surfaceMuted }]}>
                  {!unlocked ? <Ionicons name="lock-closed" size={13} color={c.textDim} /> :
                   done ? <Ionicons name="checkmark" size={14} color={c.onBrand} /> :
                   <Text style={[styles.lessonNumText, { color: topicColor }]}>{i + 1}</Text>}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lessonTitle, { color: unlocked ? c.foreground : c.textDim }]}>{lesson.title}</Text>
                  {showLocked ? (
                    <Text style={[styles.lockedHint, { color: c.textDim }]}>Master the previous lesson first</Text>
                  ) : showMastery ? (
                    <Text style={[styles.masteryHint, { color: c.accent }]}>
                      Mastery {masteryPct}%{masteryPct >= MASTERY_THRESHOLD ? ' · mastered' : ''}
                    </Text>
                  ) : (
                    <View style={styles.lessonMeta}>
                      {types.map(type => (
                        <View key={type} style={[styles.activityTypePill, { backgroundColor: c.surfaceMuted }]}>
                          <Text style={[styles.activityTypePillText, { color: c.textSecondary }]}>
                            {ACTIVITY_TYPE_LABELS[type]}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                {unlocked ? (
                  <View style={[styles.xpPill, { backgroundColor: c.surfaceMuted }]}>
                    <Text style={[styles.xpPillText, { color: c.warning }]}>+{lesson.xp} XP</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerBadges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  subjectToggle: { flexDirection: 'row', marginHorizontal: 20, gap: 10, marginBottom: 14 },
  subjectTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1 },
  subjectTabText: { fontSize: 14, fontWeight: '700' },
  progressCard: { marginHorizontal: 20, marginBottom: 12, gap: 10 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  progressLabel: { fontSize: 13 },
  progressPct: { fontSize: 13, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  masteryCard: { marginHorizontal: 20, marginBottom: 12, gap: 12 },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  masteryType: { fontSize: 12, width: 108 },
  masteryTrack: { flex: 1, height: 5, borderRadius: 3, overflow: 'hidden' },
  masteryFill: { height: 5, borderRadius: 3 },
  masteryPct: { fontSize: 12.5, fontWeight: '700', width: 40, textAlign: 'right' },
  sectionLabel: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 10, marginTop: 6 },
  topicCard: { marginHorizontal: 20, marginBottom: 12, overflow: 'hidden' },
  topicHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  topicIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  topicTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  topicDesc: { fontSize: 12, marginBottom: 8 },
  topicProgress: { height: 4, borderRadius: 2, marginBottom: 4, overflow: 'hidden' },
  topicProgressFill: { height: 4, borderRadius: 2 },
  topicProgressLabel: { fontSize: 11 },
  lessonList: { borderTopWidth: 1 },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1 },
  lessonNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  lessonNumText: { fontSize: 12, fontWeight: '700' },
  lessonTitle: { fontSize: 14, fontWeight: '600', marginBottom: 5 },
  lockedHint: { fontSize: 11.5 },
  masteryHint: { fontSize: 11.5, fontWeight: '600' },
  lessonMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  activityTypePill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  activityTypePillText: { fontSize: 10 },
  xpPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  xpPillText: { fontSize: 11, fontWeight: '700' },
});
