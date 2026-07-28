/*
 * Grade color thresholds were duplicated three times with the exact same
 * >=80/>=60 bands: data/mockData.ts's getGradeColor(score,total), and
 * inline copies in app/quizzes/results.tsx and app/quizzes/history.tsx
 * (both taking an already-computed percentage). One source of truth here;
 * data/mockData.ts now delegates to gradeColorForPct to avoid a third
 * copy of the thresholds while keeping its existing (score, total) signature
 * for its own callers.
 */
export function gradeColorForPct(pct: number): string {
  if (pct >= 80) return '#2ECC71';
  if (pct >= 60) return '#F59E0B';
  return '#FF5370';
}

export function gradeColorForScore(score: number, total: number): string {
  const pct = total > 0 ? (score / total) * 100 : 0;
  return gradeColorForPct(pct);
}
