import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
