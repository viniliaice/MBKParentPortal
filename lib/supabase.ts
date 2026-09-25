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
  /** null once the parent account has been deleted and the record is retained. */
  parentId: string | null;
  /** 'active' | 'retained' — retained rows stay with the school, unlinked. */
  retentionStatus?: string;
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
  teacherId: string | null;
  termId: string | null;
  subjectId: string | null;
};

export type SupabaseAnnouncement = {
  id: string;
  className: string;
  message: string;
  createdBy: string | null;
  createdAt: string;
};

export type SupabaseMessage = {
  id: string;
  senderId: string;
  recipientId: string;
  /** Display names captured by the send_message() RPC; never sent by a client. */
  senderName: string | null;
  recipientName: string | null;
  senderRole: string | null;
  recipientRole: string | null;
  subject: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

/** A profile the signed-in user is actually allowed to message. */
export type SupabaseContact = {
  id: string;
  name: string;
  role: string;
  class_name: string | null;
};

/** The caller's own profile, resolved by link_profile(). */
export type SupabaseLinkedProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
  class_name: string | null;
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
  /** 'parent' | 'teacher' | 'supervisor' | 'office' | 'admin' */
  role: string;
  /** The ONLY auth link: auth.uid() = profiles.auth_id. */
  auth_id: string | null;
  phone1: string | null;
  phone2: string | null;
  /** Class names and subjects a staff account is responsible for (jsonb). */
  assignedClasses: string[] | null;
  assignedSubjects: string[] | null;
  photo_url: string | null;
  createdAt: string;
  /** Expo push token, written through set_push_token(). */
  expo_push_token: string | null;
  /** A different token flow; this app never writes it. */
  fcm_token: string | null;
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
  /** Filled by the database from the student row; never written by the client. */
  parentId: string | null;
  answers: QuizAnswer[];
  totalEarned: number;
  totalPossible: number;
  status: 'in_progress' | 'submitted' | 'graded';
  startedAt: string;
  submittedAt: string | null;
  gradedAt: string | null;
  createdAt: string;
};
