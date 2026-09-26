/**
 * Report maths — what a parent's marks actually mean.
 *
 * Everything here is a pure function over the shapes `AppContext` already produces:
 * no React, no Supabase client, no theme. That keeps the academic rules in one
 * readable place and lets the parent-facing screens stay presentational.
 *
 * Weighting and calculation structure:
 * - CA (Continuous Assessment) = 40%
 *   CA consists of: Homework, Attendance, Classwork, Discipline.
 *   These four components together make up 40% of the monthly result.
 *   They do not each independently contribute 40%.
 *   Missing CA components do not penalize the student with zero; available CA
 *   components are normalized appropriately based on their scores and totals.
 * - Quiz / Monthly Test = 60%
 * - Final Monthly Result = normalized CA × 40% + Quiz × 60%
 *
 * Report-period month determination:
 * - `exams.month` is the academic report period and is authoritative when present.
 * - `date` records when marks were conducted or entered. It is only used to infer a
 *   month for legacy rows with no stored report period, and to supply a year.
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
  id?: string;
  studentId: string;
  subject: string;
  score?: number | string | null;
  total?: number | null;
  examType?: string | null;
  month?: string | null;
  date: string;
  termId?: string | null;
  assessmentLabel?: string | null;
  entryState?: string | null;
  status?: string | null;
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

export const FULL_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * 12 academic year months starting in September (index 0) through August (index 11).
 */
export const ACADEMIC_YEAR_MONTHS = [
  'Sep',
  'Oct',
  'Nov',
  'Dec',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
];

/** Parse calendar year and 0-indexed month from a date string safely without timezone drift. */
export function parseDateParts(
  dateStr: string | null | undefined,
): { year: number; monthIndex: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const match = dateStr.match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?/);
  if (match) {
    const year = parseInt(match[1], 10);
    const monthIndex = parseInt(match[2], 10) - 1;
    if (monthIndex >= 0 && monthIndex <= 11) {
      return { year, monthIndex };
    }
  }
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) {
    return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
  }
  return null;
}

/** Resolve a month name, 3-letter code, or academic month string to a 0-indexed calendar month (0-11). */
export function getCalendarMonthIndex(monthLabel: string | null | undefined): number {
  if (!monthLabel || typeof monthLabel !== 'string') return -1;
  const clean = monthLabel.trim().toLowerCase();
  const fullIdx = FULL_MONTH_NAMES.findIndex(m => m.toLowerCase() === clean);
  if (fullIdx >= 0) return fullIdx;
  const shortIdx = MONTH_NAMES.findIndex(m => m.toLowerCase() === clean);
  if (shortIdx >= 0) return shortIdx;
  const acadIdx = ACADEMIC_YEAR_MONTHS.findIndex(m => m.toLowerCase() === clean);
  if (acadIdx >= 0) {
    return acadIdx < 4 ? acadIdx + 8 : acadIdx - 4;
  }
  return -1;
}

type MonthBearingRecord = { date?: string | null; month?: string | null };

/** Return a trimmed non-empty database value, or an empty string for blank values. */
function nonEmptyMonth(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Keep stored month labels canonical for known calendar months without discarding unknown values. */
function normalizeMonthLabel(value: string | null | undefined): string {
  const month = nonEmptyMonth(value);
  if (!month) return '';
  const monthIndex = getCalendarMonthIndex(month);
  return monthIndex >= 0 ? FULL_MONTH_NAMES[monthIndex] : month;
}

/**
 * Determine an assessment's academic report month.
 *
 * `exams.month` is assigned by the school as the report period, so a non-empty stored
 * value always wins over `date`. Date is intentionally only a legacy fallback for rows
 * without a report month. For example, `{ month: 'August', date: '2026-09-17' }`
 * belongs to the August report, not September.
 */
export function getExamMonth(
  assessmentOrDate: MonthBearingRecord | string | null | undefined,
  fallbackMonth?: string | null,
): string {
  if (assessmentOrDate && typeof assessmentOrDate === 'object') {
    const storedMonth = normalizeMonthLabel(assessmentOrDate.month);
    if (storedMonth) return storedMonth;

    const dateParts = parseDateParts(assessmentOrDate.date);
    if (dateParts) return FULL_MONTH_NAMES[dateParts.monthIndex];

    return normalizeMonthLabel(fallbackMonth);
  }

  if (typeof assessmentOrDate === 'string') {
    const dateParts = parseDateParts(assessmentOrDate);
    if (dateParts) return FULL_MONTH_NAMES[dateParts.monthIndex];
  }

  return normalizeMonthLabel(fallbackMonth);
}

export const getAssessmentMonth = getExamMonth;

/** The 3-letter report-month code (e.g. 'Aug', 'Sep') for an assessment. */
export function getExamMonthCode(
  assessmentOrDate: MonthBearingRecord | string | null | undefined,
  fallbackMonth?: string | null,
): string {
  const full = getExamMonth(assessmentOrDate, fallbackMonth);
  const idx = getCalendarMonthIndex(full);
  return idx >= 0 ? MONTH_NAMES[idx] : '';
}

/**
 * Calendar parts for the report period rather than the mark-entry date.
 *
 * `month` has no year, so the entered date supplies one. When a report month is later
 * in the calendar than its entry month (for example December entered in January), it
 * belongs to the preceding calendar year. This keeps late-entered reports in the
 * academic year in which the marks belong.
 */
export function reportPeriodParts(
  assessmentOrDate: MonthBearingRecord | string | null | undefined,
  fallbackMonth?: string | null,
): { year: number; monthIndex: number } | null {
  const monthName = getAssessmentMonth(assessmentOrDate, fallbackMonth);
  const monthIndex = getCalendarMonthIndex(monthName);
  if (monthIndex < 0) return null;

  const dateStr = assessmentOrDate && typeof assessmentOrDate === 'object'
    ? assessmentOrDate.date
    : typeof assessmentOrDate === 'string' ? assessmentOrDate : null;
  const enteredOn = parseDateParts(dateStr);
  if (!enteredOn) return null;

  const storedMonth = assessmentOrDate && typeof assessmentOrDate === 'object'
    ? nonEmptyMonth(assessmentOrDate.month)
    : '';
  const year = storedMonth && monthIndex > enteredOn.monthIndex
    ? enteredOn.year - 1
    : enteredOn.year;

  return { year, monthIndex };
}

/**
 * A stable report-period key for monthly grouping. It deliberately uses the stored
 * target month rather than the date's month, while retaining a year when a date exists.
 */
export function monthlyKey(
  assessment: MonthBearingRecord,
): string {
  const period = reportPeriodParts(assessment);
  if (period) return `${period.year}-${String(period.monthIndex + 1).padStart(2, '0')}`;

  const monthIndex = getCalendarMonthIndex(getAssessmentMonth(assessment));
  return monthIndex >= 0 ? MONTH_NAMES[monthIndex] : getAssessmentMonth(assessment).toLowerCase();
}

export type AssessmentClassification = 'ca' | 'quiz' | 'term' | 'other';

/**
 * Maps an assessment record to its canonical category:
 * - 'ca': Continuous assessment component (Homework, Attendance, Classwork, Discipline). Contributes to 40% CA.
 * - 'quiz': Monthly Test / Quiz. Contributes to 60% Monthly Quiz.
 * - 'term': Midterm / Final term exam.
 * - 'other': unrecognized.
 */
export function classifyAssessment(exam: {
  examType?: string | null;
  assessmentLabel?: string | null;
}): AssessmentClassification {
  const type = (exam.examType || '').trim().toLowerCase();
  const label = (exam.assessmentLabel || '').trim().toUpperCase();

  // Term exams: Midterm or Final
  if (type === 'midterm' || type === 'final' || label === 'MIDTERM' || label === 'FINAL') {
    return 'term';
  }

  // Quiz / Monthly Test (60% component):
  // Canonical exam types: 'Quiz', 'Monthly Test', 'MonthlyTest', 'Monthly exam'
  // Canonical labels: 'MT', 'QUIZ', 'MONTHLY TEST'
  if (
    type === 'quiz' ||
    type === 'monthly test' ||
    type === 'monthlytest' ||
    type === 'monthly exam' ||
    type === 'monthly test/quiz' ||
    label === 'MT' ||
    label === 'QUIZ' ||
    label === 'MONTHLY TEST' ||
    label === 'MONTHLY_TEST'
  ) {
    return 'quiz';
  }

  // CA components (40% component):
  // HOMEWORK   -> CA (type 'homework', label 'HW1'..'HW4', 'HOMEWORK')
  // ATTENDANCE -> CA (type 'attendance', label 'ATTENDANCE')
  // CLASSWORK  -> CA (type 'classwork', label 'CPW1'..'CPW4', 'CLASSWORK')
  // DISCIPLINE -> CA (type 'discipline', label 'AKHLAAQ', 'DISCIPLINE')
  // General CA -> CA (type 'ca', label 'CA')
  if (
    type === 'ca' ||
    type === 'homework' ||
    type === 'attendance' ||
    type === 'classwork' ||
    type === 'discipline' ||
    label === 'CA' ||
    label === 'ATTENDANCE' ||
    label === 'AKHLAAQ' ||
    label === 'DISCIPLINE' ||
    label === 'CLASSWORK' ||
    label === 'HOMEWORK' ||
    /^HW\d*$/i.test(label) ||
    /^CPW\d*$/i.test(label)
  ) {
    return 'ca';
  }

  return 'other';
}

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

/**
 * A display label for a report period. When a report month is supplied, it is the
 * displayed month; `date` is only used to fill in its year.
 */
export function formatMonthYear(dateStr: string, monthCode?: string): string {
  const storedMonth = normalizeMonthLabel(monthCode);
  const monthIndex = getCalendarMonthIndex(storedMonth);
  const period = storedMonth ? reportPeriodParts({ date: dateStr, month: storedMonth }) : null;

  if (monthIndex >= 0) {
    const year = period?.year ?? parseDateParts(dateStr)?.year;
    return `${MONTH_NAMES[monthIndex]}${year === undefined ? '' : ` ${year}`}`;
  }

  if (storedMonth) {
    const year = parseDateParts(dateStr)?.year;
    return `${storedMonth}${year === undefined ? '' : ` ${year}`}`;
  }

  const dateParts = parseDateParts(dateStr);
  return dateParts ? `${MONTH_NAMES[dateParts.monthIndex]} ${dateParts.year}` : '';
}

/** '2025-2026' — the academic year a date belongs to (the year rolls over in September). */
export function academicYearKey(dateStr: string): string {
  const parts = parseDateParts(dateStr);
  if (!parts) return '';
  return academicYearKeyFromParts(parts);
}

function academicYearKeyFromParts(parts: { year: number; monthIndex: number }): string {
  return parts.monthIndex >= 8
    ? `${parts.year}-${parts.year + 1}`
    : `${parts.year - 1}-${parts.year}`;
}

/**
 * Academic year for an assessment's report period. Monthly rows use the stored report
 * month; rows without one (including term reports) retain the date-based behavior.
 */
export function reportAcademicYearKey(
  assessmentOrDate: MonthBearingRecord | string | null | undefined,
): string {
  const period = reportPeriodParts(assessmentOrDate);
  return period ? academicYearKeyFromParts(period) : '';
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
  return results.filter(r => reportAcademicYearKey(r) === yearKey);
}

export function filterByPeriod<T extends ReportResult>(results: T[], period: ReportPeriod): T[] {
  return results.filter(r => r.examType === period);
}

/** The academic-month label ('Sep'…'Aug') a calendar month index belongs to. */
export function academicMonthLabel(calendarMonthIndex: number): string {
  if (calendarMonthIndex < 0 || calendarMonthIndex > 11) return '';
  return ACADEMIC_YEAR_MONTHS[calendarMonthIndex >= 8 ? calendarMonthIndex - 8 : calendarMonthIndex + 4];
}

/** How many monthly results each academic report month holds (months with none are omitted). */
export function monthlyMonthCounts(results: ReportResult[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of results) {
    if (r.examType !== 'monthly') continue;
    const monthIndex = getCalendarMonthIndex(getAssessmentMonth(r));
    if (monthIndex < 0) continue;
    const label = academicMonthLabel(monthIndex);
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return map;
}

/** The latest academic report month that has monthly results, or null. */
export function latestMonthWithData(results: ReportResult[]): string | null {
  let latestKey = '';
  let latestLabel: string | null = null;
  for (const r of results) {
    if (r.examType !== 'monthly') continue;
    const label = getExamMonthCode(r);
    if (!label) continue;
    const key = monthlyKey(r);
    if (key > latestKey) {
      latestKey = key;
      latestLabel = label;
    }
  }
  return latestLabel;
}

/** Monthly results belonging to one report month inside one academic year. */
export function filterByMonth(results: ReportResult[], monthLabel: string, yearKey: string): ReportResult[] {
  const targetCalendarMonth = getCalendarMonthIndex(monthLabel);
  if (targetCalendarMonth < 0) return [];

  return results.filter(r => {
    if (r.examType !== 'monthly') return false;
    const reportMonth = getCalendarMonthIndex(getAssessmentMonth(r));
    if (reportMonth !== targetCalendarMonth) return false;
    return !yearKey || reportAcademicYearKey(r) === yearKey;
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
 * results; for midterm/final, the newest academic year that has them.
 */
export function latestPeriodSummary(results: ReportResult[], period: ReportPeriod): LatestPeriodSummary | null {
  const all = filterByPeriod(results, period).filter(r => r.date);
  if (all.length === 0) return null;

  const newestYear = all.reduce((newest, r) => {
    const key = reportAcademicYearKey(r);
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

export interface MonthlyScoreCalculation {
  caScore: number;
  caTotal: number;
  caPct: number;
  quizScore: number;
  quizTotal: number;
  quizPct: number;
  finalScore: number;
  caExams: ExamRow[];
  quizExams: ExamRow[];
}

/**
 * Calculates the monthly assessment score following the canonical structure:
 * - CA = Homework + Attendance + Classwork + Discipline (together 40%)
 * - Normalized CA based on available scores/totals (missing assessments are not treated as 0)
 * - Monthly Quiz/Test = 60%
 * - Final Monthly Score = normalized CA × 40% + Quiz × 60%
 */
export function calculateMonthlyScore(
  exams: ExamRow[],
): MonthlyScoreCalculation | null {
  const caExams: ExamRow[] = [];
  const quizExams: ExamRow[] = [];

  for (const e of exams) {
    if (e.status === 'rejected') continue;
    if (e.entryState === 'not_applicable') continue;

    const classification = classifyAssessment(e);
    if (classification === 'ca') {
      caExams.push(e as ExamRow);
    } else if (classification === 'quiz') {
      quizExams.push(e as ExamRow);
    }
  }

  // Monthly result requires at least one CA component and one Monthly Test / Quiz component
  if (caExams.length === 0 || quizExams.length === 0) {
    return null;
  }

  const caScore = caExams.reduce(
    (sum, e) => sum + (e.entryState === 'absent' ? 0 : Number(e.score || 0)),
    0,
  );
  const caTotal = caExams.reduce((sum, e) => sum + Number(e.total || 0), 0);

  const quizScore = quizExams.reduce(
    (sum, e) => sum + (e.entryState === 'absent' ? 0 : Number(e.score || 0)),
    0,
  );
  const quizTotal = quizExams.reduce((sum, e) => sum + Number(e.total || 0), 0);

  const caPct = caTotal > 0 ? Math.round((caScore / caTotal) * 100) : 0;
  const quizPct = quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;
  const finalScore = Math.round(caPct * 0.4 + quizPct * 0.6);

  return {
    caScore,
    caTotal,
    caPct,
    quizScore,
    quizTotal,
    quizPct,
    finalScore,
    caExams,
    quizExams,
  };
}

/**
 * Computes monthly results for all students and subjects from raw assessment rows.
 * Rows are grouped by their stored academic report month; `date` is never allowed to
 * move an August report into September merely because it was entered late.
 */
export function computeMonthlyResults(
  exams: ExamRow[],
  _attendanceMap?: Map<string, Map<string, { present: number; total: number }>>,
): ReportResult[] {
  const results: ReportResult[] = [];
  const groups = new Map<string, ExamRow[]>();

  for (const e of exams) {
    if (e.status === 'rejected') continue;
    if (e.entryState === 'not_applicable') continue;

    const classification = classifyAssessment(e);
    if (classification === 'ca' || classification === 'quiz') {
      const key = `${e.studentId}||${e.subject}||${monthlyKey(e)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e as ExamRow);
    }
  }

  for (const [key, group] of groups) {
    const [studentId, subject, periodKey] = key.split('||');
    const calc = calculateMonthlyScore(group);
    if (!calc) continue;

    const monthName = getAssessmentMonth(group[0]);
    const sortedDates = group
      .map(e => e.date)
      .filter(Boolean)
      .sort((a, b) => (b > a ? 1 : -1));
    const resultDate = sortedDates[0] || group[0].date;

    results.push({
      id: `monthly-${studentId}-${subject}-${periodKey}`,
      studentId,
      subject,
      score: calc.finalScore,
      total: 100,
      examType: 'monthly',
      month: monthName,
      date: resultDate,
      components: [
        {
          name: 'CA (Homework + Attendance + Classwork + Discipline)',
          score: calc.caPct,
          total: 100,
          weight: 40,
        },
        {
          name: 'Quiz',
          score: calc.quizPct,
          total: 100,
          weight: 60,
        },
      ],
    });
  }

  return results;
}

/**
 * Computes midterm or final term results combining continuous assessment (40%) and term exam (60%).
 */
export function computeTermResults(
  exams: ExamRow[],
  examTypeFilter: 'Midterm' | 'Final',
  outputType: string,
): ReportResult[] {
  const results: ReportResult[] = [];
  const groups = new Map<string, ExamRow[]>();

  for (const e of exams) {
    if (e.status === 'rejected') continue;
    if (e.entryState === 'not_applicable') continue;

    const isTarget = (e.examType || '').toLowerCase() === examTypeFilter.toLowerCase();
    const classification = classifyAssessment(e);
    const isComponent = classification === 'ca' || classification === 'quiz';

    if (isTarget || isComponent) {
      const key = `${e.studentId}||${e.subject}||${e.termId || 'default'}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e as ExamRow);
    }
  }

  for (const [key, group] of groups) {
    const [studentId, subject] = key.split('||');
    const targetExams = group.filter(
      e => (e.examType || '').toLowerCase() === examTypeFilter.toLowerCase(),
    );
    const compExams = group.filter(e => {
      const c = classifyAssessment(e);
      return c === 'ca' || c === 'quiz';
    });
    if (targetExams.length === 0 || compExams.length === 0) continue;

    const compScore = compExams.reduce(
      (s, e) => s + (e.entryState === 'absent' ? 0 : Number(e.score || 0)),
      0,
    );
    const compTotal = compExams.reduce((s, e) => s + Number(e.total || 0), 0);
    const compPct = compTotal > 0 ? Math.round((compScore / compTotal) * 100) : 0;

    const examScore = targetExams.reduce(
      (s, e) => s + (e.entryState === 'absent' ? 0 : Number(e.score || 0)),
      0,
    );
    const examTotal = targetExams.reduce((s, e) => s + Number(e.total || 0), 0);
    const examPct = examTotal > 0 ? Math.round((examScore / examTotal) * 100) : 0;

    const finalPct = Math.round(compPct * 0.4 + examPct * 0.6);

    results.push({
      id: `${outputType}-${studentId}-${subject}`,
      studentId,
      subject,
      score: finalPct,
      total: 100,
      examType: outputType,
      month: '',
      date: targetExams[0].date,
      components: [
        { name: 'CA (Homework + Classwork + Quiz)', score: compPct, total: 100, weight: 40 },
        { name: `${examTypeFilter} Exam`, score: examPct, total: 100, weight: 60 },
      ],
    });
  }

  return results;
}

/**
 * Reports the school has started but not finished, mirroring exactly the conditions
 * `computeMonthlyResults` / `computeTermResults` use to emit a result.
 */
export function computePendingReports(exams: ExamRow[]): PendingReport[] {
  const pending: PendingReport[] = [];

  const monthly = new Map<string, ExamRow[]>();
  const terms = new Map<string, ExamRow[]>();

  for (const e of exams) {
    if (e.status === 'rejected') continue;
    if (e.entryState === 'not_applicable') continue;

    const classification = classifyAssessment(e);
    if (classification === 'ca' || classification === 'quiz') {
      const key = `${e.studentId}||${e.subject}||${monthlyKey(e)}`;
      if (!monthly.has(key)) monthly.set(key, []);
      monthly.get(key)!.push(e);
    }

    const isTerm = classification === 'term';
    const isComp = classification === 'ca' || classification === 'quiz';
    if (isTerm || isComp) {
      const key = `${e.studentId}||${e.subject}||${e.termId || 'default'}`;
      if (!terms.has(key)) terms.set(key, []);
      terms.get(key)!.push(e);
    }
  }

  for (const [key, group] of monthly) {
    const [studentId, subject, periodKey] = key.split('||');
    const hasCA = group.some(e => classifyAssessment(e) === 'ca');
    const hasQuiz = group.some(e => classifyAssessment(e) === 'quiz');
    if (hasCA && hasQuiz) continue;

    const monthName = getAssessmentMonth(group[0]);
    const sortedDates = group
      .map(e => e.date)
      .filter(Boolean)
      .sort((a, b) => (b > a ? 1 : -1));
    const resultDate = sortedDates[0] || group[0].date;

    pending.push({
      id: `pending-monthly-${studentId}-${subject}-${periodKey}`,
      studentId,
      subject,
      period: 'monthly',
      month: monthName,
      date: resultDate,
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
      const target = group.filter(e => (e.examType || '').toLowerCase() === examType.toLowerCase());
      const components = group.filter(e => {
        const c = classifyAssessment(e);
        return c === 'ca' || c === 'quiz';
      });
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
 * The pending reports that belong to one view of the marks screen. Monthly views are
 * scoped by the report period stored on the assessment, not by when it was entered.
 */
export function pendingForView(
  pending: PendingReport[],
  period: ReportPeriod,
  options: { month?: string; yearKey?: string } = {},
): PendingReport[] {
  const { month = '', yearKey = '' } = options;
  const targetCalendarMonth = month ? getCalendarMonthIndex(month) : -1;
  if (month && targetCalendarMonth < 0) return [];

  return pending.filter(item => {
    if (item.period !== period) return false;

    if (period === 'monthly') {
      if (month && getCalendarMonthIndex(getAssessmentMonth(item)) !== targetCalendarMonth) {
        return false;
      }
      return !yearKey || !item.date || reportAcademicYearKey(item) === yearKey;
    }

    return !yearKey || !item.date || academicYearKey(item.date) === yearKey;
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

  const reportOrderKey = (result: ReportResult): string => {
    if (result.examType === 'monthly') {
      const reportPeriod = reportPeriodParts(result);
      if (reportPeriod) {
        return `${reportPeriod.year}-${String(reportPeriod.monthIndex + 1).padStart(2, '0')}-${result.date}`;
      }
    }
    return result.date || '';
  };
  const latest = own.reduce((newest, result) => (
    reportOrderKey(result) > reportOrderKey(newest) ? result : newest
  ));
  const period = isPeriod(latest.examType) ? latest.examType : 'monthly';
  const month = period === 'monthly' ? getExamMonthCode(latest) : '';
  const yearKey = reportAcademicYearKey(latest);

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

export interface MonthPillState {
  /** Calendar month index, 0 = Jan — the pills are always drawn Jan → Dec. */
  index: number;
  /** Three-letter label, e.g. 'Sep'. */
  label: string;
  /** Calendar year this pill falls in, given the academic year the row covers. */
  year: number | null;
  /** The academic year the row covers, e.g. '2026-2027'. */
  yearKey: string;
  /** The report month the marks screen groups by — the value a pill navigates with. */
  academicMonth: string;
  /** Published monthly subject results in this month. */
  count: number;
  /** True only when the school has published marks for this student and month. */
  hasMarks: boolean;
}

export interface MonthPillStates {
  /** The academic year the row covers. Empty when there is nothing to place it in. */
  yearKey: string;
  months: MonthPillState[];
}

export interface MonthPillOptions {
  /** Pin the row to a year the screen is already showing (the marks screen's year). */
  yearKey?: string;
  /** Used when the child has no monthly marks yet, so the row still has a year. */
  fallbackYearKey?: string;
}

/**
 * One child's school year as twelve month pills, Jan → Dec: which of them actually carry
 * published monthly marks.
 *
 * "Published" means `computeMonthlyResults` produced a result for it — the same rule the
 * marks screen uses to offer a month at all — so a month with only half a subject's marks
 * entered stays empty rather than reading as half full. Which month a result belongs to is
 * `filterByMonth`'s decision (the school's stored report month, falling back to the date),
 * never a fresh guess here.
 *
 * Left alone, the year is the one `latestPeriodSummary` picks — the year the dashboard's
 * own "Latest: …" line comes from — so the pills and the month named beside them cannot
 * disagree. A child with no monthly marks falls back to the school's current year and
 * lights nothing.
 */
export function monthPillStates(
  results: ReportResult[],
  studentId: string,
  options: MonthPillOptions = {},
): MonthPillStates {
  const { yearKey: pinnedYear = '', fallbackYearKey = '' } = options;
  const monthly = filterByPeriod(
    results.filter(r => r.studentId === studentId),
    'monthly',
  );

  const yearKey = pinnedYear || latestPeriodSummary(monthly, 'monthly')?.yearKey || fallbackYearKey;
  const [startYear, endYear] = yearKey.split('-').map(Number);
  const inYear = yearKey ? filterByYear(monthly, yearKey) : [];

  return {
    yearKey,
    months: MONTH_NAMES.map((label, index) => {
      // Sep–Dec sit in the academic year's first calendar year, Jan–Aug in its second:
      // the same split `reportAcademicYearKey` applies when it keys a report period.
      const year = Number.isInteger(startYear) && Number.isInteger(endYear)
        ? (index >= 8 ? startYear : endYear)
        : null;
      const academicMonth = academicMonthLabel(index);
      const inMonth = yearKey ? filterByMonth(inYear, academicMonth, yearKey) : [];

      return {
        index,
        label,
        year,
        yearKey,
        academicMonth,
        count: inMonth.length,
        hasMarks: inMonth.length > 0,
      };
    }),
  };
}
