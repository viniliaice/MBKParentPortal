import 'expo-sqlite/localStorage/install';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseStudent = {
  id: string;
  name: string;
  className: string;
  parentId: string;
  createdAt: string;
};

export type SupabaseExam = {
  id: string;
  studentId: string;
  subject: string;
  score: number;
  total: number;
  examType: string;
  month: string;
  status: string;
  parentId: string | null;
  date: string;
  createdAt: string;
  teacherId: string;
  termId: string;
  subjectId: string;
};

export type SupabaseAnnouncement = {
  id: string;
  className: string;
  message: string;
  createdBy: string;
  createdAt: string;
};

export type SupabaseMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

export type SupabaseAcademicYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  createdAt: string;
};

export type SupabaseProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  phone1: string;
  phone2: string;
  auth_id: string | null;
  expo_push_token: string | null;
  createdAt: string;
};

export type SupabaseLessonProgress = {
  id: string;
  parent_id: string;
  lesson_id: string;
  completed: boolean;
  xp_earned: number;
  correct_count: number;
  total_activities: number;
  completed_at: string | null;
  activity_results: any | null;
  mastery_level: number;
  attempts_count: number;
  last_attempt_at: string | null;
  srs_due_at: string | null;
  srs_correct_streak: number;
};

export type SupabaseLessonAttempt = {
  id: string;
  parent_id: string;
  lesson_id: string;
  attempt_number: number;
  correct_count: number;
  total_activities: number;
  accuracy_pct: number;
  activity_results: any | null;
  completed_at: string;
};

export type SupabaseGamification = {
  id: string;
  parent_id: string;
  current_streak: number;
  longest_streak: number;
  last_lesson_date: string | null;
  level: number;
  total_xp_earned: number;
  daily_reward_claimed: boolean;
  daily_reward_date: string | null;
};

export type QuizAnswer = {
  questionId: string;
  answer: string;
  isCorrect: boolean | null;
  score: number;
  feedback: string;
};

export type Quiz = {
  id: string;
  className: string;
  subject: string;
  title: string;
  description: string | null;
  teacherId: string;
  timeLimit: number;
  questionOrder: 'sequential' | 'random';
  showResults: boolean;
  status: 'active' | 'closed' | 'draft';
  openDate: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
};

export type QuizQuestion = {
  id: string;
  quizId: string;
  questionId: string;
  promptSnapshot: string;
  optionsSnapshot: { label: string; text: string }[];
  correctAnswerSnapshot: string;
  typeSnapshot: 'multiple_choice' | 'direct_answer';
  points: number;
  orderIndex: number;
};

export type QuizAttempt = {
  id: string;
  quizId: string;
  studentId: string;
  answers: QuizAnswer[];
  totalEarned: number;
  totalPossible: number;
  status: 'in_progress' | 'submitted' | 'graded';
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  createdAt: string;
};
