/*
# Create full app schema (profiles, students, exams, attendance, announcements, messages, homework, lesson_progress, gamification)

1. Purpose
- Bootstraps the complete database for the MBK Parent Portal app.
- The app uses custom profile-based auth: login looks up a row in `profiles` by email.
  No Supabase Auth session is created, so the frontend runs as the anon role for all
  queries. All policies therefore allow anon + authenticated and use USING (true),
  matching the existing app pattern (the application layer scopes by parent_id).

2. New Tables
- profiles: parent/teacher accounts. id (uuid PK), name, email (unique), role,
  phone1, phone2, auth_id (nullable, for future Supabase Auth linking),
  expo_push_token (nullable), created_at.
- students: children linked to a parent. id (uuid PK), name, class_name,
  parent_id (references profiles), created_at.
- exams: graded items. id (uuid PK), student_id, subject, score, total,
  exam_type, month, status, parent_id (nullable), date, created_at,
  teacher_id, term_id, subject_id.
- attendance: daily attendance. id (uuid PK), student_id, date, status, note.
- announcements: school-wide notices. id (uuid PK), class_name, message,
  created_by, created_at.
- messages: parent-teacher messaging. id (uuid PK), sender_id, recipient_id,
  subject, body, read_at (nullable), created_at.
- homework: homework assignments. id (uuid PK), student_id, subject, title,
  due_date, status, description, created_at.
- lesson_progress: per-parent lesson completion. id (uuid PK), parent_id,
  lesson_id, completed, xp_earned, correct_count, total_activities,
  completed_at (nullable), activity_results (jsonb). Unique (parent_id, lesson_id).
- gamification: per-parent gamification state. id (uuid PK), parent_id (unique),
  current_streak, longest_streak, last_lesson_date, level, total_xp_earned,
  daily_reward_claimed, daily_reward_date.

3. Security
- RLS enabled on every table.
- Policies allow anon + authenticated full CRUD on all tables, consistent with
  the app's anon-key custom-auth model. Application code scopes queries by
  parent_id / student_id.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'parent',
  phone1 text,
  phone2 text,
  auth_id uuid,
  expo_push_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
CREATE POLICY "anon_select_profiles" ON profiles FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_profiles" ON profiles;
CREATE POLICY "anon_insert_profiles" ON profiles FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_profiles" ON profiles;
CREATE POLICY "anon_update_profiles" ON profiles FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_profiles" ON profiles;
CREATE POLICY "anon_delete_profiles" ON profiles FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  class_name text NOT NULL,
  parent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_students" ON students;
CREATE POLICY "anon_select_students" ON students FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_students" ON students;
CREATE POLICY "anon_insert_students" ON students FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_students" ON students;
CREATE POLICY "anon_update_students" ON students FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_students" ON students;
CREATE POLICY "anon_delete_students" ON students FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  exam_type text NOT NULL,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'graded',
  parent_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  teacher_id text,
  term_id text,
  subject_id text
);
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_exams" ON exams;
CREATE POLICY "anon_select_exams" ON exams FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_exams" ON exams;
CREATE POLICY "anon_insert_exams" ON exams FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_exams" ON exams;
CREATE POLICY "anon_update_exams" ON exams FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_exams" ON exams;
CREATE POLICY "anon_delete_exams" ON exams FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date text NOT NULL,
  status text NOT NULL,
  note text
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_attendance" ON attendance;
CREATE POLICY "anon_select_attendance" ON attendance FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_attendance" ON attendance;
CREATE POLICY "anon_insert_attendance" ON attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_attendance" ON attendance;
CREATE POLICY "anon_update_attendance" ON attendance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_attendance" ON attendance;
CREATE POLICY "anon_delete_attendance" ON attendance FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_name text NOT NULL,
  message text NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_announcements" ON announcements;
CREATE POLICY "anon_select_announcements" ON announcements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_announcements" ON announcements;
CREATE POLICY "anon_insert_announcements" ON announcements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_announcements" ON announcements;
CREATE POLICY "anon_update_announcements" ON announcements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_announcements" ON announcements;
CREATE POLICY "anon_delete_announcements" ON announcements FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id text NOT NULL,
  recipient_id text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS homework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject text NOT NULL,
  title text NOT NULL,
  due_date text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE homework ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_homework" ON homework;
CREATE POLICY "anon_select_homework" ON homework FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_homework" ON homework;
CREATE POLICY "anon_insert_homework" ON homework FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_homework" ON homework;
CREATE POLICY "anon_update_homework" ON homework FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_homework" ON homework;
CREATE POLICY "anon_delete_homework" ON homework FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  xp_earned integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  total_activities integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  activity_results jsonb,
  UNIQUE (parent_id, lesson_id)
);
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_select_lesson_progress" ON lesson_progress FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_insert_lesson_progress" ON lesson_progress FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_update_lesson_progress" ON lesson_progress FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lesson_progress" ON lesson_progress;
CREATE POLICY "anon_delete_lesson_progress" ON lesson_progress FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS gamification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_lesson_date text,
  level integer NOT NULL DEFAULT 1,
  total_xp_earned integer NOT NULL DEFAULT 0,
  daily_reward_claimed boolean NOT NULL DEFAULT false,
  daily_reward_date text
);
ALTER TABLE gamification ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_gamification" ON gamification;
CREATE POLICY "anon_select_gamification" ON gamification FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_gamification" ON gamification;
CREATE POLICY "anon_insert_gamification" ON gamification FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_gamification" ON gamification;
CREATE POLICY "anon_update_gamification" ON gamification FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_gamification" ON gamification;
CREATE POLICY "anon_delete_gamification" ON gamification FOR DELETE TO anon, authenticated USING (true);

-- Enable pg_net for push-notification edge function triggers
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.call_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://qopeilyvkfqbjdeudwnz.supabase.co/functions/v1/send-notification',
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.call_push_notification();

DROP TRIGGER IF EXISTS on_new_announcement ON public.announcements;
CREATE TRIGGER on_new_announcement
  AFTER INSERT ON public.announcements
  FOR EACH ROW
  EXECUTE FUNCTION public.call_push_notification();