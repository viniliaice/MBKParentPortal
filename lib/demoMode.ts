/**
 * Demo mode — the whole parent app, offline, for previewing the UI.
 *
 * Why this exists: every signed-in screen loads from Supabase, so without real
 * project credentials the app cannot get past the login form. Demo mode swaps the
 * *data source* only: the rows below have exactly the shapes the live tables return
 * (`SupabaseExam`, `AppMessage`, `Quiz`, …), so all the existing logic — the report
 * maths in `AppContext`, `reportSelectors`, mastery, gamification — runs unchanged
 * over them. Nothing here is a second implementation of a screen.
 *
 * Safety rules, all deliberate:
 *
 * 1. `DEMO_MODE` is only ever true for a development build (`__DEV__`) — a release
 *    build can never sign in without a real Supabase account, whatever the env says.
 * 2. Nothing in this file touches the network or `lib/supabase`. There is no live
 *    project to touch: demo mode never signs anyone in against Supabase.
 * 3. Every write (sending a message, saving progress, submitting a quiz) is kept in
 *    this module's memory and disappears on reload — a demo session can never reach
 *    school data.
 * 4. `EXPO_PUBLIC_DEMO_MODE=false` turns the whole thing off in a dev build too.
 *
 * To review the app for real, set the two Supabase env values and set that flag to
 * `false`; see README "Environment variables".
 */

import { getLessonById } from '@/data/learningData';
import type { HomeworkItem, AttendanceRecord, AppMessage } from '@/data/mockData';
import type { SupabaseAcademicYear, SupabaseExam, SupabaseContact, SupabaseGamification, SupabaseLessonAttempt, SupabaseLessonProgress, Quiz, QuizQuestion, QuizAttempt, QuizAnswer } from '@/lib/supabase';
import type { AnnouncementData, StudentData } from '@/context/AppContext';

const flag = process.env.EXPO_PUBLIC_DEMO_MODE;
const explicitlyDisabled = flag === 'false' || flag === '0' || flag === 'off';

/**
 * On for a development build unless switched off by env. Never on in a release
 * build: a shipped app must not be able to open the parent portal without signing in.
 */
export const DEMO_MODE = __DEV__ && !explicitlyDisabled;

export function isDemoMode(): boolean {
  return DEMO_MODE;
}

/** The account the demo signs in as. Ids match the rows below. */
export const DEMO_PARENT_ID = 'demo-parent-1';
export const DEMO_PARENT_NAME = 'Demo Parent';

// ---------------------------------------------------------------------------
// Dates — relative to "today" so the preview always looks current.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

function atMidday(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function daysAgo(n: number): Date {
  return atMidday(new Date(Date.now() - n * DAY_MS));
}

/**
 * A day in the current calendar month, never in the future. Monthly reports are
 * grouped by calendar month on screen, so every monthly row has to land in the
 * month that is being previewed.
 */
function thisMonth(day: number): Date {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(day, lastDay, now.getDate()));
  return new Date(now.getFullYear(), now.getMonth(), safeDay, 12, 0, 0, 0);
}

/** ISO date (no time) as stored in the date-only columns. */
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ACADEMIC_MONTHS = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

/** The academic-month code the exams table stores ('Sep' … 'Jun'). */
function monthCode(d: Date): string {
  const m = d.getMonth();
  return ACADEMIC_MONTHS[m >= 8 ? m - 8 : m + 4] ?? MONTH_ABBR[m];
}

/** The academic years the demo spans. The monthly reports sit in the current one. */
function academicYearOf(d: Date): string {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

const CURRENT_YEAR_KEY = academicYearOf(new Date());
const MONTHLY_DAY = thisMonth(9);
const MONTHLY_YEAR_KEY = academicYearOf(MONTHLY_DAY);
const MIDTERM_DAY = daysAgo(21);
const FINAL_DAY = daysAgo(49);

// ---------------------------------------------------------------------------
// Children
// ---------------------------------------------------------------------------

/**
 * The id is shown to the parent as the child's admission number (see
 * `ChildSelector`), so it is shaped like one rather than like a demo marker.
 */
export const DEMO_STUDENTS: StudentData[] = [
  { id: 'MBK-1042', name: 'Amina Yusuf', className: 'Grade 4A', grade: 'Grade 4', avatarColor: '#3D5AFE' },
  { id: 'MBK-2087', name: 'Bilal Yusuf', className: 'Grade 2B', grade: 'Grade 2', avatarColor: '#00BCD4' },
];

const [AMINA, BILAL] = DEMO_STUDENTS;

// ---------------------------------------------------------------------------
// Exams — these feed computeMonthlyResults / computeTermResults unchanged
// ---------------------------------------------------------------------------

interface ExamInput {
  id: string;
  studentId: string;
  subject: string;
  examType: string;
  score: number;
  total: number;
  date: Date;
  termId?: string | null;
}

function exam(input: ExamInput): SupabaseExam {
  const iso = input.date.toISOString();
  return {
    id: input.id,
    studentId: input.studentId,
    subject: input.subject,
    score: input.score,
    total: input.total,
    examType: input.examType,
    month: monthCode(input.date),
    status: 'published',
    parentId: DEMO_PARENT_ID,
    date: iso,
    createdAt: iso,
    teacherId: null,
    termId: input.termId ?? null,
    subjectId: null,
  };
}

/** One month of components for a subject: the CA marks plus the quiz. */
function monthlyMarks(studentId: string, subject: string, suffix: string, marks: {
  homework: [number, number];
  classwork: [number, number];
  quiz: [number, number] | null;
}): SupabaseExam[] {
  const rows: SupabaseExam[] = [
    exam({ id: `demo-exam-${suffix}-hw`, studentId, subject, examType: 'Homework', score: marks.homework[0], total: marks.homework[1], date: MONTHLY_DAY }),
    exam({ id: `demo-exam-${suffix}-cw`, studentId, subject, examType: 'Classwork', score: marks.classwork[0], total: marks.classwork[1], date: MONTHLY_DAY }),
  ];
  if (marks.quiz) {
    rows.push(exam({ id: `demo-exam-${suffix}-quiz`, studentId, subject, examType: 'Quiz', score: marks.quiz[0], total: marks.quiz[1], date: MONTHLY_DAY }));
  }
  // A subject with no quiz row on purpose: the marks screen then has to say
  // "not published yet" instead of showing a zero (see computePendingReports).
  return rows;
}

export const DEMO_EXAMS: SupabaseExam[] = [
  ...monthlyMarks(AMINA.id, 'Mathematics', 'a-math', { homework: [9, 10], classwork: [8, 10], quiz: [17, 20] }),
  ...monthlyMarks(AMINA.id, 'English', 'a-eng', { homework: [8, 10], classwork: [8, 10], quiz: [15, 20] }),
  ...monthlyMarks(AMINA.id, 'Science', 'a-sci', { homework: [8, 10], classwork: [7, 10], quiz: null }),

  ...monthlyMarks(BILAL.id, 'Mathematics', 'b-math', { homework: [10, 10], classwork: [9, 10], quiz: [18, 20] }),
  ...monthlyMarks(BILAL.id, 'English', 'b-eng', { homework: [7, 10], classwork: [7, 10], quiz: [13, 20] }),

  // Amina's mathematics: a complete midterm and a final from the end of last year.
  exam({ id: 'demo-exam-a-math-mid-hw', studentId: AMINA.id, subject: 'Mathematics', examType: 'Homework', score: 9, total: 10, date: MIDTERM_DAY, termId: 'demo-term-1' }),
  exam({ id: 'demo-exam-a-math-mid-cw', studentId: AMINA.id, subject: 'Mathematics', examType: 'Classwork', score: 8, total: 10, date: MIDTERM_DAY, termId: 'demo-term-1' }),
  exam({ id: 'demo-exam-a-math-mid-quiz', studentId: AMINA.id, subject: 'Mathematics', examType: 'Quiz', score: 16, total: 20, date: MIDTERM_DAY, termId: 'demo-term-1' }),
  exam({ id: 'demo-exam-a-math-mid', studentId: AMINA.id, subject: 'Mathematics', examType: 'Midterm', score: 42, total: 60, date: MIDTERM_DAY, termId: 'demo-term-1' }),
  exam({ id: 'demo-exam-a-math-fin-hw', studentId: AMINA.id, subject: 'Mathematics', examType: 'Homework', score: 9, total: 10, date: FINAL_DAY, termId: 'demo-term-2' }),
  exam({ id: 'demo-exam-a-math-fin-quiz', studentId: AMINA.id, subject: 'Mathematics', examType: 'Quiz', score: 17, total: 20, date: FINAL_DAY, termId: 'demo-term-2' }),
  exam({ id: 'demo-exam-a-math-fin', studentId: AMINA.id, subject: 'Mathematics', examType: 'Final', score: 45, total: 60, date: FINAL_DAY, termId: 'demo-term-2' }),

  // Bilal's English: components only, so the midterm reads as still being marked.
  exam({ id: 'demo-exam-b-eng-mid-hw', studentId: BILAL.id, subject: 'English', examType: 'Homework', score: 8, total: 10, date: MIDTERM_DAY, termId: 'demo-term-1' }),
  exam({ id: 'demo-exam-b-eng-mid-cw', studentId: BILAL.id, subject: 'English', examType: 'Classwork', score: 7, total: 10, date: MIDTERM_DAY, termId: 'demo-term-1' }),
];

// ---------------------------------------------------------------------------
// Attendance — the last four school weeks, weekdays only
// ---------------------------------------------------------------------------

function recentWeekdays(count: number): Date[] {
  const days: Date[] = [];
  let cursor = new Date();
  while (days.length < count) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days.push(atMidday(cursor));
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return days.reverse();
}

const DEMO_SCHOOL_DAYS = recentWeekdays(20);

function attendanceFor(studentId: string, prefix: string, absent: number[], late: number[]): AttendanceRecord[] {
  return DEMO_SCHOOL_DAYS.map((day, i) => ({
    id: `demo-att-${prefix}-${i}`,
    studentId,
    date: isoDate(day),
    status: absent.includes(i) ? 'absent' : late.includes(i) ? 'late' : 'present',
    note: absent.includes(i) ? 'Absence reported by the family.' : '',
  }));
}

export const DEMO_ATTENDANCE: AttendanceRecord[] = [
  ...attendanceFor(AMINA.id, 'a', [6], [11, 17]),
  ...attendanceFor(BILAL.id, 'b', [4, 13], [9]),
];

// ---------------------------------------------------------------------------
// Homework, announcements, messages, contacts
// ---------------------------------------------------------------------------

export const DEMO_HOMEWORK: HomeworkItem[] = [
  { id: 'demo-hw-1', studentId: AMINA.id, subject: 'Mathematics', title: 'Fractions worksheet 4', dueDate: isoDate(daysAgo(-1)), status: 'pending', description: 'Pages 12–13. Show the working for each answer.' },
  { id: 'demo-hw-2', studentId: AMINA.id, subject: 'English', title: 'Reading: The Water Well', dueDate: isoDate(daysAgo(-3)), status: 'pending', description: 'Read the story twice and answer questions 1–5 in full sentences.' },
  { id: 'demo-hw-3', studentId: AMINA.id, subject: 'Science', title: 'Label the plant', dueDate: isoDate(daysAgo(2)), status: 'submitted', description: 'Draw and label the parts of a plant.' },
  { id: 'demo-hw-4', studentId: AMINA.id, subject: 'Mathematics', title: 'Times tables 6 and 7', dueDate: isoDate(daysAgo(5)), status: 'graded', description: 'Practise for 10 minutes each evening.' },
  { id: 'demo-hw-5', studentId: BILAL.id, subject: 'Mathematics', title: 'Counting to 100', dueDate: isoDate(daysAgo(-2)), status: 'pending', description: 'Count in tens to 100 with an adult.' },
  { id: 'demo-hw-6', studentId: BILAL.id, subject: 'English', title: 'Letters G to M', dueDate: isoDate(daysAgo(1)), status: 'submitted', description: 'Write each letter three times in the exercise book.' },
];

export const DEMO_ANNOUNCEMENTS: AnnouncementData[] = [
  {
    id: 'demo-ann-1',
    title: 'School announcement',
    body: 'Parents’ evening is on Thursday at 6pm in the main hall. Class teachers will be available until 8pm.',
    date: daysAgo(1).toISOString(),
    category: 'event',
  },
  {
    id: 'demo-ann-2',
    title: 'Grade 4A announcement',
    body: 'The Grade 4A trip to the national library has been moved to next Monday. Please send a packed lunch.',
    date: daysAgo(2).toISOString(),
    category: 'academic',
    className: 'Grade 4A',
  },
  {
    id: 'demo-ann-3',
    title: 'School announcement',
    body: 'School closes at 12pm on Wednesday for staff training. Buses will leave at 12:15pm.',
    date: daysAgo(6).toISOString(),
    category: 'urgent',
  },
  {
    id: 'demo-ann-4',
    title: 'Grade 2B announcement',
    body: 'Please return the reading record books by the end of the week.',
    date: daysAgo(9).toISOString(),
    category: 'general',
    className: 'Grade 2B',
  },
];

export const DEMO_CONTACTS: SupabaseContact[] = [
  { id: 'demo-staff-1', name: 'Ms. Hodan Ali', role: 'teacher', class_name: 'Grade 4A' },
  { id: 'demo-staff-2', name: 'Mr. Cabdi Warsame', role: 'teacher', class_name: 'Grade 2B' },
  { id: 'demo-staff-3', name: 'School Office', role: 'office', class_name: null },
  { id: 'demo-staff-4', name: 'Mrs. Fadumo Hassan', role: 'supervisor', class_name: null },
];

export const DEMO_MESSAGES: AppMessage[] = [
  {
    id: 'demo-msg-1',
    senderId: 'demo-staff-1',
    senderName: 'Ms. Hodan Ali',
    recipientId: DEMO_PARENT_ID,
    recipientName: DEMO_PARENT_NAME,
    subject: 'Amina’s mathematics progress',
    body: 'Amina did very well in this week’s fractions quiz. Please keep practising the times tables at home — that is the one area holding her back from a higher grade.',
    isRead: false,
    createdAt: daysAgo(0).toISOString(),
    isInbox: true,
  },
  {
    id: 'demo-msg-2',
    senderId: 'demo-staff-3',
    senderName: 'School Office',
    recipientId: DEMO_PARENT_ID,
    recipientName: DEMO_PARENT_NAME,
    subject: 'Parents’ evening — Thursday',
    body: 'Reminder that parents’ evening is on Thursday from 6pm. No appointment is needed; please sign in at the office.',
    isRead: true,
    createdAt: daysAgo(2).toISOString(),
    isInbox: true,
  },
  {
    id: 'demo-msg-3',
    senderId: 'demo-staff-4',
    senderName: 'Mrs. Fadumo Hassan',
    recipientId: DEMO_PARENT_ID,
    recipientName: DEMO_PARENT_NAME,
    subject: 'Bilal’s attendance',
    body: 'Bilal was marked late on Sunday morning. Please let us know if there is anything the school can help with.',
    isRead: false,
    createdAt: daysAgo(3).toISOString(),
    isInbox: true,
  },
  {
    id: 'demo-msg-4',
    senderId: DEMO_PARENT_ID,
    senderName: 'You',
    recipientId: 'demo-staff-1',
    recipientName: 'Ms. Hodan Ali',
    subject: 'Thank you',
    body: 'Thank you for the update. We will work on the times tables every evening this week.',
    isRead: true,
    createdAt: daysAgo(4).toISOString(),
    isInbox: false,
  },
  {
    id: 'demo-msg-5',
    senderId: DEMO_PARENT_ID,
    senderName: 'You',
    recipientId: 'demo-staff-3',
    recipientName: 'School Office',
    subject: 'Absence on Sunday',
    body: 'Amina was unwell on Sunday and could not attend. Please excuse her absence.',
    isRead: true,
    createdAt: daysAgo(7).toISOString(),
    isInbox: false,
  },
];

export const DEMO_ACADEMIC_YEARS: SupabaseAcademicYear[] = [
  { id: 'demo-year-1', name: CURRENT_YEAR_KEY, startDate: `${CURRENT_YEAR_KEY.slice(0, 4)}-09-01`, endDate: `${Number(CURRENT_YEAR_KEY.slice(0, 4)) + 1}-06-30`, isCurrent: true, createdAt: daysAgo(60).toISOString() },
  { id: 'demo-year-2', name: MONTHLY_YEAR_KEY === CURRENT_YEAR_KEY ? '2025-2026' : MONTHLY_YEAR_KEY, startDate: '2025-09-01', endDate: '2026-06-30', isCurrent: false, createdAt: daysAgo(400).toISOString() },
];

// ---------------------------------------------------------------------------
// Learning progress — built from the real curriculum so the ids and activity
// types match what the lesson screens look for.
// ---------------------------------------------------------------------------

interface DemoLessonProgress {
  row: SupabaseLessonProgress;
  activityResults: { activityId: string; type: string; correct: boolean; timeSpentMs: number }[];
}

function lessonProgressFor(lessonId: string, opts: {
  correct: number;
  xp: number;
  estimatedActivities: number;
  mastery: number;
  attempts: number;
  daysAgoCompleted: number;
}): DemoLessonProgress | null {
  const lesson = getLessonById(lessonId);
  if (!lesson) return null;

  const activityResults = lesson.activities.map((activity, i) => ({
    activityId: activity.id,
    type: activity.type,
    correct: i < opts.correct,
    timeSpentMs: 8_000 + i * 1_500,
  }));

  const completedAt = daysAgo(opts.daysAgoCompleted).toISOString();
  return {
    activityResults,
    row: {
      id: `demo-progress-${lessonId}`,
      parent_id: DEMO_PARENT_ID,
      lesson_id: lessonId,
      completed: true,
      xp_earned: opts.xp,
      correct_count: opts.correct,
      total_activities: lesson.activities.length,
      completed_at: completedAt,
      activity_results: activityResults,
      mastery_level: opts.mastery,
      attempts_count: opts.attempts,
      last_attempt_at: completedAt,
      srs_due_at: null,
      srs_correct_streak: 1,
    },
  };
}

const DEMO_PROGRESS: DemoLessonProgress[] = [
  lessonProgressFor('cnt_1', { correct: 5, xp: 50, estimatedActivities: 5, mastery: 3, attempts: 2, daysAgoCompleted: 6 }),
  lessonProgressFor('cnt_2', { correct: 4, xp: 55, estimatedActivities: 4, mastery: 2, attempts: 1, daysAgoCompleted: 5 }),
  lessonProgressFor('add_1', { correct: 4, xp: 50, estimatedActivities: 4, mastery: 2, attempts: 2, daysAgoCompleted: 3 }),
  lessonProgressFor('abc_1', { correct: 5, xp: 50, estimatedActivities: 5, mastery: 3, attempts: 1, daysAgoCompleted: 2 }),
  lessonProgressFor('voc_1', { correct: 4, xp: 50, estimatedActivities: 4, mastery: 1, attempts: 1, daysAgoCompleted: 1 }),
].filter((p): p is DemoLessonProgress => p !== null);

export const DEMO_LESSON_PROGRESS: SupabaseLessonProgress[] = DEMO_PROGRESS.map(p => p.row);

export const DEMO_LESSON_ATTEMPTS: SupabaseLessonAttempt[] = DEMO_PROGRESS.flatMap((p, index) => {
  const total = p.row.total_activities;
  const accuracy = total > 0 ? Math.round((p.row.correct_count / total) * 100) : 0;
  return [{
    id: `demo-attempt-${p.row.lesson_id}`,
    parent_id: DEMO_PARENT_ID,
    lesson_id: p.row.lesson_id,
    attempt_number: p.row.attempts_count,
    correct_count: p.row.correct_count,
    total_activities: total,
    accuracy_pct: index === 0 ? Math.max(accuracy - 20, 0) : accuracy,
    activity_results: p.activityResults,
    completed_at: p.row.completed_at ?? new Date().toISOString(),
  }];
});

export const DEMO_GAMIFICATION: SupabaseGamification = {
  id: 'demo-gam-1',
  parent_id: DEMO_PARENT_ID,
  current_streak: 3,
  longest_streak: 9,
  last_lesson_date: isoDate(daysAgo(1)),
  level: 3,
  total_xp_earned: 470,
  daily_reward_claimed: true,
  daily_reward_date: isoDate(daysAgo(1)),
};

// ---------------------------------------------------------------------------
// Quizzes
// ---------------------------------------------------------------------------

interface DemoQuiz { quiz: Quiz; questions: QuizQuestion[] }

function quizQuestion(quizId: string, index: number, prompt: string, options: string[], correct: string): QuizQuestion {
  const letters = ['A', 'B', 'C', 'D'];
  return {
    id: `demo-qq-${quizId}-${index + 1}`,
    quizId,
    questionId: `demo-q-${quizId}-${index + 1}`,
    promptSnapshot: prompt,
    optionsSnapshot: options.map((text, i) => ({ label: letters[i], text })),
    correctAnswerSnapshot: correct,
    typeSnapshot: 'multiple_choice',
    points: 5,
    orderIndex: index,
  };
}

function demoQuiz(quiz: Quiz, questions: { prompt: string; options: string[]; correct: string }[]): DemoQuiz {
  return {
    quiz,
    questions: questions.map((q, i) => quizQuestion(quiz.id, i, q.prompt, q.options, q.correct)),
  };
}

function quizBase(id: string, className: string, subject: string, title: string, description: string, opensDaysAgo: number, dueInDays: number, timeLimit: number): Quiz {
  return {
    id,
    className,
    subject,
    title,
    description,
    teacherId: 'demo-staff-1',
    timeLimit,
    questionOrder: 'sequential',
    showResults: true,
    status: 'active',
    openDate: daysAgo(opensDaysAgo).toISOString(),
    dueDate: daysAgo(-dueInDays).toISOString(),
    createdAt: daysAgo(opensDaysAgo).toISOString(),
    updatedAt: daysAgo(opensDaysAgo).toISOString(),
  };
}

const DEMO_QUIZZES: DemoQuiz[] = [
  demoQuiz(quizBase('demo-quiz-1', 'Grade 4A', 'Mathematics', 'Fractions check-in', 'Equivalent fractions and adding halves.', 5, 3, 15), [
    { prompt: 'Which fraction is the same as 1/2?', options: ['2/4', '1/3', '3/4', '2/3'], correct: '2/4' },
    { prompt: 'What is 1/4 + 1/4?', options: ['1/2', '1/8', '2/8', '1/4'], correct: '1/2' },
    { prompt: 'Which is the largest fraction?', options: ['3/4', '1/2', '2/5', '1/3'], correct: '3/4' },
    { prompt: 'How many quarters make one whole?', options: ['4', '2', '3', '6'], correct: '4' },
  ]),
  demoQuiz(quizBase('demo-quiz-2', 'Grade 4A', 'English', 'Reading comprehension', 'Questions on “The Water Well” — read the story first.', 4, 2, 20), [
    { prompt: 'Where is the story set?', options: ['A village', 'A city', 'A school', 'An island'], correct: 'A village' },
    { prompt: 'Why did the well run dry?', options: ['A long drought', 'A broken pump', 'Too many people', 'A blocked pipe'], correct: 'A long drought' },
    { prompt: 'What does the word “scarcely” mean?', options: ['Hardly', 'Quickly', 'Loudly', 'Often'], correct: 'Hardly' },
  ]),
  demoQuiz(quizBase('demo-quiz-3', 'Grade 2B', 'Mathematics', 'Counting to 100', 'Counting in tens and ones.', 3, 4, 10), [
    { prompt: 'What comes after 89?', options: ['90', '88', '91', '99'], correct: '90' },
    { prompt: 'Count in tens: 20, 30, 40, …', options: ['50', '45', '41', '60'], correct: '50' },
    { prompt: 'How many tens are in 70?', options: ['7', '17', '70', '10'], correct: '7' },
  ]),
];

const quizById = new Map(DEMO_QUIZZES.map(q => [q.quiz.id, q]));

const DEMO_QUIZ_ANSWERS: QuizAnswer[] = quizById.get('demo-quiz-1')!.questions.map((q, i) => ({
  questionId: q.id,
  answer: i === 1 ? '1/8' : q.correctAnswerSnapshot,
  isCorrect: i !== 1,
  score: i === 1 ? 0 : q.points,
  feedback: i === 1 ? 'Not quite — a half plus a quarter is three quarters.' : 'Correct.',
}));

const DEMO_QUIZ_ATTEMPTS: QuizAttempt[] = [{
  id: 'demo-quiz-attempt-1',
  quizId: 'demo-quiz-1',
  studentId: AMINA.id,
  parentId: DEMO_PARENT_ID,
  answers: DEMO_QUIZ_ANSWERS,
  totalEarned: DEMO_QUIZ_ANSWERS.reduce((sum, a) => sum + a.score, 0),
  totalPossible: quizById.get('demo-quiz-1')!.questions.reduce((sum, q) => sum + q.points, 0),
  status: 'graded',
  startedAt: daysAgo(2).toISOString(),
  submittedAt: daysAgo(2).toISOString(),
  gradedAt: daysAgo(1).toISOString(),
  createdAt: daysAgo(2).toISOString(),
}];

// ---------------------------------------------------------------------------
// Demo API — what the screens call instead of Supabase. Reads come from the rows
// above; writes stay in this module's memory for the session.
// ---------------------------------------------------------------------------

const sessionAttempts: QuizAttempt[] = [...DEMO_QUIZ_ATTEMPTS];
const sessionMessages: AppMessage[] = DEMO_MESSAGES.map(m => ({ ...m }));
let messageCounter = sessionMessages.length;

export const demoApi = {
  /** Active quizzes for a class, with a question count — same shape as the live query. */
  quizzesForClass(className: string): (Quiz & { question_count: number })[] {
    const now = Date.now();
    return DEMO_QUIZZES
      .filter(({ quiz }) => quiz.className === className
        && quiz.status === 'active'
        && new Date(quiz.openDate).getTime() <= now
        && new Date(quiz.dueDate).getTime() >= now)
      .map(({ quiz, questions }) => ({ ...quiz, question_count: questions.length }));
  },

  quizById(quizId: string): Quiz | null {
    return quizById.get(quizId)?.quiz ?? null;
  },

  quizQuestions(quizId: string): QuizQuestion[] {
    return quizById.get(quizId)?.questions ?? [];
  },

  /** Attempt ids per quiz for one child, for the "already attempted" marker. */
  attemptedQuizIds(studentId: string): Set<string> {
    return new Set(sessionAttempts.filter(a => a.studentId === studentId).map(a => a.quizId));
  },

  attemptsForStudent(studentId: string): QuizAttempt[] {
    return sessionAttempts
      .filter(a => a.studentId === studentId)
      .sort((a, b) => (b.submittedAt ?? b.startedAt).localeCompare(a.submittedAt ?? a.startedAt));
  },

  attemptById(attemptId: string): QuizAttempt | null {
    return sessionAttempts.find(a => a.id === attemptId) ?? null;
  },

  /** Submitting never leaves the device: the row is held in memory only. */
  saveQuizAttempt(attempt: Omit<QuizAttempt, 'id' | 'parentId' | 'createdAt'>): string {
    const id = `demo-quiz-attempt-${sessionAttempts.length + 1}`;
    const now = new Date().toISOString();
    sessionAttempts.unshift({ ...attempt, id, parentId: DEMO_PARENT_ID, createdAt: now });
    return id;
  },

  contacts(): SupabaseContact[] {
    return DEMO_CONTACTS;
  },

  messages(): AppMessage[] {
    return sessionMessages;
  },

  markMessageRead(id: string): void {
    const message = sessionMessages.find(m => m.id === id);
    if (message) message.isRead = true;
  },

  sendMessage(input: { recipientId: string; subject: string; body: string; senderId: string }): AppMessage {
    const recipient = DEMO_CONTACTS.find(c => c.id === input.recipientId);
    messageCounter += 1;
    const sent: AppMessage = {
      id: `demo-msg-new-${messageCounter}`,
      senderId: input.senderId,
      senderName: 'You',
      recipientId: input.recipientId,
      recipientName: recipient?.name ?? 'School',
      subject: input.subject,
      body: input.body,
      isRead: true,
      createdAt: new Date().toISOString(),
      isInbox: false,
    };
    sessionMessages.unshift(sent);
    return sent;
  },
};
