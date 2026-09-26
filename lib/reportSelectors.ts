/**
 * Report maths — what a parent's marks actually mean.
 *
 * Everything here is a pure function over the shapes `AppContext` already produces:
 * no React, no Supabase client, no theme. That keeps the academic rules in one
 * readable place and lets the parent-facing screens stay presentational.
 *
 * The rules themselves are not defined here: `computeMonthlyResults` /
 * `computeTermResults` in `context/AppContext.tsx` own the weightings and produce the
 * `ReportResult` rows. This module only *selects, labels and summarises* them, and
 * points out where a report cannot be computed yet (missing components) so the app
 * can say "not published" instead of showing a misleading zero.
 */

export type ReportPeriod = 'monthly' | 'midterm' | 'final';

export interface ReportComponent {
  name: string;
  score: number;
  total: number;
  weight: number;
}

/** Structural match for the `ComputedResult` rows from `AppContext`. */
export interface ReportResult {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  total: number;
  examType: string;
  month: string;
  date: string;
  components: ReportComponent[];
}

/** Structural match for the exam rows held in `AppContext`. */
export interface ExamRow {
  studentId: string;
  subject: string;
  examType: string;
  month: string;
  date: string;
  termId: string | null;
}

/** A report that cannot be calculated yet because part of it has not been entered. */
export interface PendingReport {
  id: string;
  studentId: string;
  subject: string;
  period: ReportPeriod;
  month: string;
  date: string;
  /** Parent-facing labels for what the school has not published yet. */
  missing: string[];
}

export const ATTENTION_THRESHOLD = 60;
export const STRONG_THRESHOLD = 80;

export const REPORT_PERIODS: { key: ReportPeriod; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'midterm', label: 'Midterm' },
  { key: 'final', label: 'Final' },
];

export const ACADEMIC_YEAR_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function percentage(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function gradeFor(score: number, total: number): string {
  const p = total > 0 ? (score / total) * 100 : 0;
  if (p >= 90) return 'A+';
  if (p >= 80) return 'A';
  if (p >= 70) return 'B+';
  if (p >= 60) return 'B';
  if (p >= 50) return 'C';
  if (p >= 40) return 'D';
  return 'F';
}

export function gradeColorFor(
  score: number,
  total: number,
  colors: { success: string; warning: string; danger: string },
): string {
  const p = total > 0 ? (score / total) * 100 : 0;
  if (p >= 60) return p >= 80 ? colors.success : colors.warning;
  return colors.danger;
}

/** 'Sep 2025' from a report's date, falling back to its stored month code. */
export function formatMonthYear(dateStr: string, monthCode?: string): string {
  if (dateStr) {
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
    }
  }
  const monthIndex = ACADEMIC_YEAR_MONTHS.indexOf(monthCode ?? '');
  return monthIndex >= 0 ? ACADEMIC_YEAR_MONTHS[monthIndex] : '';
}

/** '2025-2026' — the academic year a date belongs to (the year rolls over in September). */
export function academicYearKey(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = d.getMonth();
  return month >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

/** The academic-year keys to offer: those with results, plus anything the school lists. */
export function academicYearOptions(resultYears: string[], schoolYearNames: string[]): string[] {
  const years = new Set<string>();
  for (const year of resultYears) if (year) years.add(year);
  for (const name of schoolYearNames) if (name) years.add(name.replace('/', '-'));
  return Array.from(years).sort();
}

export function isPeriod(value: string | undefined | null): value is ReportPeriod {
  return value === 'monthly' || value === 'midterm' || value === 'final';
}

export function filterByYear<T extends ReportResult>(results: T[], yearKey: string): T[] {
  if (!yearKey) return results;
  return results.filter(r => r.date && academicYearKey(r.date) === yearKey);
}

export function filterByPeriod<T extends ReportResult>(results: T[], period: ReportPeriod): T[] {
  return results.filter(r => r.examType === period);
}

/** The academic-month label ('Sep'…'Jun') a calendar month index belongs to. */
export function academicMonthLabel(calendarMonthIndex: number): string {
  return ACADEMIC_YEAR_MONTHS[calendarMonthIndex >= 8 ? calendarMonthIndex - 8 : calendarMonthIndex + 4];
}

/** How many monthly results each academic month holds (months with none are omitted). */
export function monthlyMonthCounts(results: ReportResult[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of results) {
    if (r.examType !== 'monthly' || !r.date) continue;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const label = academicMonthLabel(d.getMonth());
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return map;
}

/** The most recent academic month that has monthly results, or null. */
export function latestMonthWithData(results: ReportResult[]): string | null {
  let latestDate = '';
  let latestLabel: string | null = null;
  for (const r of results) {
    if (r.examType !== 'monthly' || !r.date) continue;
    if (r.date > latestDate) {
      latestDate = r.date;
      latestLabel = academicMonthLabel(new Date(r.date).getMonth());
    }
  }
  return latestLabel;
}

/** Monthly results belonging to one academic month inside one academic year. */
export function filterByMonth(results: ReportResult[], monthLabel: string, yearKey: string): ReportResult[] {
  const acadIdx = ACADEMIC_YEAR_MONTHS.indexOf(monthLabel);
  if (acadIdx < 0) return [];
  const calendarMonth = acadIdx < 4 ? acadIdx + 8 : acadIdx - 4;
  const [startYear, endYear] = yearKey.split('-');
  // Sep–Dec sit in the first year of the academic year; Jan–Jun in the second.
  const calendarYear = yearKey
    ? Number(acadIdx >= 4 ? endYear : startYear)
    : null;

  return results.filter(r => {
    if (r.examType !== 'monthly' || !r.date) return false;
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime()) || d.getMonth() !== calendarMonth) return false;
    return calendarYear === null || Number.isNaN(calendarYear) || d.getFullYear() === calendarYear;
  });
}

export interface SubjectScore {
  subject: string;
  pct: number;
}

export interface PeriodSummary {
  /** Average of the period's subject percentages — the same average the app has always shown. */
  averagePct: number;
  count: number;
  grade: string;
  averageOf: number;
  strongest: SubjectScore | null;
  attention: SubjectScore[];
}

export function summarisePeriod(results: ReportResult[]): PeriodSummary {
  const scores: SubjectScore[] = results.map(r => ({
    subject: r.subject,
    pct: percentage(r.score, r.total),
  }));

  const averagePct = scores.length > 0
    ? Math.round(scores.reduce((sum, s) => sum + s.pct, 0) / scores.length)
    : 0;

  const sorted = [...scores].sort((a, b) => b.pct - a.pct);

  return {
    averagePct,
    count: scores.length,
    grade: gradeFor(averagePct, 100),
    averageOf: scores.length,
    strongest: sorted.length > 0 && sorted[0].pct >= STRONG_THRESHOLD ? sorted[0] : null,
    attention: scores.filter(s => s.pct < ATTENTION_THRESHOLD).sort((a, b) => a.pct - b.pct),
  };
}

export interface LatestPeriodSummary extends PeriodSummary {
  /** The academic year the summary was drawn from, e.g. '2025-2026'. */
  yearKey: string;
  /** The academic month for a monthly report, otherwise ''. */
  month: string;
  /** Parent-facing label, e.g. 'Sep 2025 monthly report'. */
  label: string;
  /** The most recent date among the results summarised. */
  date: string;
  results: ReportResult[];
}

/**
 * The most recent report of one period: for monthly, the latest month that has
 * results; for midterm/final, the newest academic year that has them. This is what a
 * dashboard card should say — not an average across several years.
 */
export function latestPeriodSummary(results: ReportResult[], period: ReportPeriod): LatestPeriodSummary | null {
  const all = filterByPeriod(results, period).filter(r => r.date);
  if (all.length === 0) return null;

  const newestYear = all.reduce((newest, r) => {
    const key = academicYearKey(r.date);
    return key > newest ? key : newest;
  }, '');
  const inYear = filterByYear(all, newestYear);

  const month = period === 'monthly' ? latestMonthWithData(inYear) ?? '' : '';
  const scoped = period === 'monthly' ? filterByMonth(inYear, month, newestYear) : inYear;
  if (scoped.length === 0) return null;

  const date = scoped.reduce((latest, r) => (r.date > latest ? r.date : latest), '');
  const summary = summarisePeriod(scoped);

  return {
    ...summary,
    yearKey: newestYear,
    month,
    label: period === 'monthly'
      ? `${formatMonthYear(date, scoped[0].month)} monthly report`
      : period === 'midterm' ? 'Midterm report' : 'Final report',
    date,
    results: scoped,
  };
}

const COMPONENT_TYPES = ['CA', 'Homework', 'Classwork', 'Quiz'];

/**
 * Reports the school has started but not finished, mirroring exactly the conditions
 * `computeMonthlyResults` / `computeTermResults` use to emit a result. Anything this
 * returns has no computed result, so the app can list the subject as "not published
 * yet" rather than leaving a silent gap (or a zero) on the marks screen.
 */
export function computePendingReports(exams: ExamRow[]): PendingReport[] {
  const pending: PendingReport[] = [];

  const monthly = new Map<string, ExamRow[]>();
  const terms = new Map<string, ExamRow[]>();

  for (const e of exams) {
    if (['CA', 'Homework', 'Classwork', 'Quiz'].includes(e.examType)) {
      const key = `${e.studentId}||${e.subject}||${e.month}`;
      if (!monthly.has(key)) monthly.set(key, []);
      monthly.get(key)!.push(e);
    }
    if (e.examType === 'Midterm' || e.examType === 'Final' || COMPONENT_TYPES.includes(e.examType)) {
      const key = `${e.studentId}||${e.subject}||${e.termId || 'default'}`;
      if (!terms.has(key)) terms.set(key, []);
      terms.get(key)!.push(e);
    }
  }

  for (const [key, group] of monthly) {
    const [studentId, subject, month] = key.split('||');
    const hasCA = group.some(e => e.examType !== 'Quiz');
    const hasQuiz = group.some(e => e.examType === 'Quiz');
    if (hasCA && hasQuiz) continue;
    pending.push({
      id: `pending-monthly-${studentId}-${subject}-${month}`,
      studentId,
      subject,
      period: 'monthly',
      month,
      date: group[0].date,
      missing: [
        ...(hasCA ? [] : ['classwork, homework and attendance']),
        ...(hasQuiz ? [] : ['quiz']),
      ],
    });
  }

  for (const [key, group] of terms) {
    const [studentId, subject] = key.split('||');
    for (const { examType, period } of [
      { examType: 'Midterm', period: 'midterm' as const },
      { examType: 'Final', period: 'final' as const },
    ]) {
      const target = group.filter(e => e.examType === examType);
      const components = group.filter(e => COMPONENT_TYPES.includes(e.examType));
      if (target.length > 0 && components.length > 0) continue;
      if (target.length === 0 && components.length === 0) continue;
      pending.push({
        id: `pending-${period}-${studentId}-${subject}`,
        studentId,
        subject,
        period,
        month: '',
        date: (target[0] ?? components[0]).date,
        missing: [
          ...(components.length === 0 ? ['classwork, homework and quiz'] : []),
          ...(target.length === 0 ? [`${examType.toLowerCase()} exam`] : []),
        ],
      });
    }
  }

  return pending;
}

/**
 * The pending reports that belong to one view of the marks screen. Scoping them the
 * same way as the results beside them is what keeps the pair honest: a midterm that
 * has not been sat yet must not read as "still being published" while the parent is
 * looking at September.
 */
export function pendingForView(
  pending: PendingReport[],
  period: ReportPeriod,
  options: { month?: string; yearKey?: string } = {},
): PendingReport[] {
  const { month = '', yearKey = '' } = options;

  return pending.filter(item => {
    if (item.period !== period) return false;
    if (!item.date) return true;
    if (yearKey && academicYearKey(item.date) !== yearKey) return false;
    if (period === 'monthly' && month) {
      return academicMonthLabel(new Date(item.date).getMonth()) === month;
    }
    return true;
  });
}

export interface ChildAcademics {
  /** The period the summary below is drawn from — the most recent one with results. */
  period: ReportPeriod | null;
  /** Parent-facing period label, e.g. 'Sep 2025 monthly report'. */
  label: string;
  month: string;
  averagePct: number;
  grade: string;
  subjectCount: number;
  strongest: SubjectScore | null;
  attention: SubjectScore[];
  latestAssessment: { subject: string; pct: number; date: string } | null;
  /** Results the school has not finished publishing for this child, any period. */
  pending: PendingReport[];
  /** The same list, narrowed to the period and month the summary above is about. */
  latestPending: PendingReport[];
  hasAnyResult: boolean;
}

export function summariseChild(
  results: ReportResult[],
  pendingReports: PendingReport[],
  studentId: string,
): ChildAcademics {
  const own = results.filter(r => r.studentId === studentId);
  const pending = pendingReports.filter(p => p.studentId === studentId);

  const empty: ChildAcademics = {
    period: null,
    label: '',
    month: '',
    averagePct: 0,
    grade: '',
    subjectCount: 0,
    strongest: null,
    attention: [],
    latestAssessment: null,
    pending,
    latestPending: [],
    hasAnyResult: false,
  };

  if (own.length === 0) return empty;

  const dated = own.filter(r => r.date);
  const latest = dated.length > 0
    ? dated.reduce((a, b) => (b.date > a.date ? b : a))
    : own[0];
  const period = isPeriod(latest.examType) ? latest.examType : 'monthly';
  const month = period === 'monthly' ? academicMonthLabel(new Date(latest.date).getMonth()) : '';
  const yearKey = academicYearKey(latest.date);

  const periodResults = period === 'monthly'
    ? filterByMonth(filterByPeriod(own, 'monthly'), month, yearKey)
    : filterByPeriod(own, period);

  const summary = summarisePeriod(periodResults);

  return {
    period,
    latestPending: pendingForView(pending, period, { month, yearKey }),
    label: period === 'monthly'
      ? `${formatMonthYear(latest.date, latest.month)} monthly report`
      : period === 'midterm' ? 'Midterm report' : 'Final report',
    month,
    averagePct: summary.averagePct,
    grade: summary.grade,
    subjectCount: summary.count,
    strongest: summary.strongest,
    attention: summary.attention,
    latestAssessment: {
      subject: latest.subject,
      pct: percentage(latest.score, latest.total),
      date: latest.date,
    },
    pending,
    hasAnyResult: true,
  };
}
