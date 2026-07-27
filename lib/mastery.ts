/*
 * Mastery + spaced-repetition helpers.
 *
 * Mastery is computed from recent attempts (not all-time average): the last
 * 3 attempts are weighted so a kid who struggled once months ago but has nailed
 * it repeatedly since reads as mastered. A kid with no attempts reads as 0
 * (not mastered). Threshold for unlocking the next lesson is a single tunable
 * constant below.
 */

export const MASTERY_THRESHOLD = 70;

/**
 * Minimum number of attempts before a lesson can be considered mastered.
 * A single lucky first try should not unlock the next lesson; the student
 * must show consistency across at least this many attempts.
 */
export const MASTERY_MIN_ATTEMPTS = 2;

export interface AttemptSummary {
  accuracyPct: number;
  completedAt: string | null;
}

/**
 * Compute a 0-100 mastery level from a list of attempts (oldest first).
 * Recent attempts are weighted more than old ones. If there are fewer than
 * 3 attempts, all available attempts are used (still weighted toward the
 * most recent). Returns 0 when there are no attempts.
 *
 * NOTE: computeMasteryLevel returns the raw weighted accuracy. Use
 * isMastered() to check the threshold — it enforces MASTERY_MIN_ATTEMPTS
 * so a single lucky first try cannot unlock the next lesson.
 */
export function computeMasteryLevel(attempts: AttemptSummary[]): number {
  if (attempts.length === 0) return 0;
  const recent = attempts.slice(-3);
  const weights = recent.length === 3
    ? [1, 2, 3]
    : recent.length === 2
    ? [1, 3]
    : [1];
  let weightedSum = 0;
  let weightTotal = 0;
  recent.forEach((a, i) => {
    const w = weights[i];
    weightedSum += a.accuracyPct * w;
    weightTotal += w;
  });
  return Math.round(weightedSum / weightTotal);
}

export function isMastered(masteryLevel: number, attemptsCount = 0): boolean {
  if (attemptsCount < MASTERY_MIN_ATTEMPTS) return false;
  return masteryLevel >= MASTERY_THRESHOLD;
}

export interface LessonProgressLike {
  completed?: boolean;
  masteryLevel?: number;
  attemptsCount?: number;
  srsDueAt?: string | null;
  srsCorrectStreak?: number;
  prerequisiteLessonId?: string;
}

/**
 * A lesson is unlocked if it has no prerequisite, or its prerequisite's
 * mastery level has reached the threshold. A lesson the student has already
 * completed (or attempted) is always unlocked so they can replay it.
 */
export function isLessonUnlocked(
  lessonId: string,
  prerequisiteLessonId: string | undefined,
  progressByLesson: Record<string, LessonProgressLike>,
): boolean {
  if (!prerequisiteLessonId) return true;
  const own = progressByLesson[lessonId];
  if (own && (own.completed || (own.attemptsCount ?? 0) > 0)) return true;
  const prereq = progressByLesson[prerequisiteLessonId];
  if (!prereq) return false;
  return isMastered(prereq.masteryLevel ?? 0, prereq.attemptsCount ?? 0);
}

/**
 * Simple Leitner-style interval growth. The streak grows on each correct
 * review and resets to 0 on a wrong review; the interval (days) grows with
 * the streak so mastered skills resurface less and less often.
 *
 * streak 0 -> 1 day, 1 -> 3 days, 2 -> 7 days, 3+ -> 14 days
 */
export function nextLeitnerInterval(correctStreak: number): number {
  if (correctStreak <= 0) return 1;
  if (correctStreak === 1) return 3;
  if (correctStreak === 2) return 7;
  return 14;
}

/**
 * Returns the next due date (YYYY-MM-DD) for a review, given the new streak
 * after a review attempt. Uses local dates (not UTC) to match the streak logic.
 */
export function nextSrsDueDate(correctStreak: number, from = new Date()): string {
  const days = nextLeitnerInterval(correctStreak);
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

export function localDateStr(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Lessons whose SRS review is due today or earlier. Used by the lesson flow to
 * inject 1-2 review questions into a new lesson.
 */
export function isSrsDue(progress: LessonProgressLike | undefined, today = new Date()): boolean {
  if (!progress || !progress.srsDueAt) return false;
  const todayStr = localDateStr(today);
  return progress.srsDueAt <= todayStr;
}