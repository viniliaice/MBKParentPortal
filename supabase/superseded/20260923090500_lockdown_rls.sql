-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Lock down row level security — one table x role access matrix

1. The problem this migration fixes
- Every table created by the historical migrations carried policies of the form
    CREATE POLICY "anon_select_x" ON x FOR SELECT TO anon, authenticated USING (true);
  i.e. the public anon key (shipped inside the app bundle) could read and write
  every table: student records, exam marks, attendance, messages, everything.
  The policies were enabled, so this was not a theoretical exposure.
- The app itself could not be blamed for the reads: it filters by
  parentId/studentId *in the client*, which is not authorization.
- The lesson/quiz tables kept the same pattern (lesson_attempts, gamification,
  and the quiz tables from the unversioned migration_quiz.sql).

2. What replaces it
- Anon is removed from the schema completely: table and sequence privileges are
  revoked (and default privileges changed, so a table added later is not
  automatically exposed), and no policy grants anything to anon. A request with
  only the anon key gets nothing.
- `authenticated` gets exactly the rows its role is entitled to:
    * parent  : own children, their exams/attendance/homework, own learning
                records, own messages, own class announcements, class quizzes
    * teacher : the class in profiles.class_name (attendance/homework writes,
                own quizzes, grading) plus its own rows
    * admin   : the whole school
  The rules live in the helper functions created by
  20260923090300_auth_identity_model.sql so that every table uses the same
  definition of "my child" / "my class".
- Messages are read-only for clients: rows are created by the controlled
  send_message() RPC and marked read by mark_message_read(), both of which
  validate the caller (see 20260923091000_messaging_rpc.sql). Direct inserts are
  rejected because there is no INSERT policy at all.
- profiles is select-only for clients (own row, or the families of a teacher's
  own class). Writes to it go through set_push_token()/clear_push_token().
  School provisioning (creating parents/teachers, changing roles) stays a
  school-side operation with the database owner, by design: no client, and no
  stolen parent token, can promote itself to teacher or admin.

3. How it is applied
- Every existing policy on the application tables is dropped first (looked up
  from pg_policies, so a policy with an unexpected name cannot survive), then
  the canonical set is created. Re-running is safe: the drop/recreate pair is
  deterministic.
- RLS is switched on for each table as well, so the matrix applies even if a
  table was created without ENABLE ROW LEVEL SECURITY.

4. What is deliberately NOT granted
- anon: nothing at all.
- parents: no DELETE anywhere (account deletion is a server-side flow:
  20260923092000_account_deletion.sql), no INSERT/UPDATE on students, exams,
  attendance, homework, announcements or messages.
- teachers: no write access to another class; no DELETE; no access to another
  class's quizzes or messages.
- admins: full access, including DELETE, because the school administers the
  records. (Role values other than parent/teacher/admin have no staff rights;
  see the note in 20260923090300_auth_identity_model.sql.)
- The push-notification trigger function is executable by nobody except the
  trigger itself.

5. Residual, stated honestly
- The quiz client receives `quiz_questions."correctAnswerSnapshot"` to grade
  answers locally (the pre-existing app design). A parent can therefore read the
  answers of their own class's quizzes in the API response. Fixing that needs
  server-side grading (an RPC that compares answers and returns a score) and is
  listed as a follow-up in docs/security-model.md; row access itself is already
  class-scoped, so no other class's data is reachable.
*/

-- ---------------------------------------------------------------------------
-- 1. Drop every existing policy on the application tables
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'students', 'exams', 'attendance', 'homework',
        'announcements', 'messages', 'lesson_progress', 'lesson_attempts',
        'gamification', 'quizzes', 'questions', 'quiz_questions',
        'quiz_attempts', 'academic_years'
      ])
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    RAISE NOTICE 'lockdown: dropped policy %.%', r.tablename, r.policyname;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Anon loses the schema. Privileges first, then (belatedly) nothing is
--    granted back: no policy below mentions the anon role.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tablename);
  END LOOP;

  FOR r IN
    SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon', r.sequencename);
  END LOOP;
END $$;

-- A table created later must not be exposed by Supabase's default privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- ---------------------------------------------------------------------------
-- 3. RLS on, for every table in the matrix (defensive; the historical
--    migrations enabled it, but a table without it ignores all of the below).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
        'profiles', 'students', 'exams', 'attendance', 'homework',
        'announcements', 'messages', 'lesson_progress', 'lesson_attempts',
        'gamification', 'quizzes', 'questions', 'quiz_questions',
        'quiz_attempts', 'academic_years'
      ])
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. The matrix
-- ---------------------------------------------------------------------------

-- profiles ------------------------------------------------------------------
-- Own row, plus the families of a teacher's own class (that is what the
-- messaging contact list is built from). Admins see everyone.
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated
  USING (id = public.current_profile_id());

CREATE POLICY profiles_select_own_class_families ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.teacher_class() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.students s
      WHERE s."parentId" = profiles.id
        AND s."className" = public.teacher_class()
    )
  );

CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- students ------------------------------------------------------------------
-- Deliberately written with the row's own columns instead of calling
-- can_read_student(id): a policy that re-reads the table it protects cannot see
-- a row inserted by the same statement, which makes INSERT ... RETURNING fail
-- with a misleading WITH CHECK error.
CREATE POLICY students_select_own ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR "parentId" = public.current_profile_id()
    OR (public.teacher_class() IS NOT NULL AND "className" = public.teacher_class())
  );

CREATE POLICY students_admin_write ON public.students
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- exams / attendance / homework ---------------------------------------------
-- Read: the family it belongs to, the teacher of that class, admins.
-- Write: the teacher of that class (the school's normal workflow) and admins.
-- WITH CHECK re-tests the row *after* the change, so a teacher cannot move a
-- record into another class.
CREATE POLICY exams_select_own ON public.exams
  FOR SELECT TO authenticated
  USING (public.can_read_student("studentId"));

CREATE POLICY exams_write_school_insert ON public.exams
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY exams_write_school_update ON public.exams
  FOR UPDATE TO authenticated
  USING (public.can_write_student_record("studentId"))
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY exams_admin_delete ON public.exams
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY attendance_select_own ON public.attendance
  FOR SELECT TO authenticated
  USING (public.can_read_student("studentId"));

CREATE POLICY attendance_write_school_insert ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY attendance_write_school_update ON public.attendance
  FOR UPDATE TO authenticated
  USING (public.can_write_student_record("studentId"))
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY attendance_admin_delete ON public.attendance
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY homework_select_own ON public.homework
  FOR SELECT TO authenticated
  USING (public.can_read_student("studentId"));

CREATE POLICY homework_write_school_insert ON public.homework
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY homework_write_school_update ON public.homework
  FOR UPDATE TO authenticated
  USING (public.can_write_student_record("studentId"))
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY homework_admin_delete ON public.homework
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- announcements -------------------------------------------------------------
-- Read: a parent sees the classes their children are in; staff see their own
-- class; admins see all. This is what app/(tabs)/index.tsx renders.
-- Write: the teacher of that class and admins (admin can change/delete).
CREATE POLICY announcements_select_class ON public.announcements
  FOR SELECT TO authenticated
  USING (
    "className" = ANY (public.my_class_names())
    OR public.is_teacher_of_class("className")
    OR public.is_admin()
  );

CREATE POLICY announcements_insert_class ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher_of_class("className") OR public.is_admin());

CREATE POLICY announcements_admin_modify ON public.announcements
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY announcements_admin_delete ON public.announcements
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- messages ------------------------------------------------------------------
-- Read: participant only. No INSERT/UPDATE/DELETE policy exists: the RPCs are
-- the only writers.
CREATE POLICY messages_select_participant ON public.messages
  FOR SELECT TO authenticated
  USING (
    "senderId" = public.current_profile_id_text()
    OR "recipientId" = public.current_profile_id_text()
  );

CREATE POLICY messages_admin_select ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY messages_admin_delete ON public.messages
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- learning tables (parent-owned, snake_case as the app expects) --------------
CREATE POLICY lesson_progress_own ON public.lesson_progress
  FOR ALL TO authenticated
  USING (parent_id = public.current_profile_id())
  WITH CHECK (parent_id = public.current_profile_id());

CREATE POLICY lesson_progress_admin ON public.lesson_progress
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY lesson_attempts_own ON public.lesson_attempts
  FOR ALL TO authenticated
  USING (parent_id = public.current_profile_id())
  WITH CHECK (parent_id = public.current_profile_id());

CREATE POLICY lesson_attempts_admin ON public.lesson_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY gamification_own ON public.gamification
  FOR ALL TO authenticated
  USING (parent_id = public.current_profile_id())
  WITH CHECK (parent_id = public.current_profile_id());

CREATE POLICY gamification_admin ON public.gamification
  FOR SELECT TO authenticated
  USING (public.is_admin());

-- quizzes -------------------------------------------------------------------
-- Read: the owning teacher, the class it is for (parents included) and admins.
-- Same reasoning as students_select_own: the row's own columns are used, so a
-- teacher's INSERT ... RETURNING works.
CREATE POLICY quizzes_select_own ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR "teacherId" = public.current_profile_id()
    OR "className" = public.teacher_class()
    OR (status = 'active' AND "className" = ANY (public.my_class_names()))
  );

CREATE POLICY quizzes_update_own ON public.quizzes
  FOR UPDATE TO authenticated
  USING (public.can_write_quiz(id))
  WITH CHECK (public.can_write_quiz(id));

CREATE POLICY quizzes_admin_delete ON public.quizzes
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- A teacher may only create a quiz for their own class and as themselves.
CREATE POLICY quizzes_insert_own_class ON public.quizzes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (public.is_teacher_of_class("className") AND "teacherId" = public.current_profile_id())
  );

-- questions (question bank) -------------------------------------------------
CREATE POLICY questions_select_school ON public.questions
  FOR SELECT TO authenticated
  USING (public.is_staff());

CREATE POLICY questions_insert_own ON public.questions
  FOR INSERT TO authenticated
  WITH CHECK ("createdBy" = public.current_profile_id_text() OR public.is_admin());

CREATE POLICY questions_update_own ON public.questions
  FOR UPDATE TO authenticated
  USING ("createdBy" = public.current_profile_id_text() OR public.is_admin())
  WITH CHECK ("createdBy" = public.current_profile_id_text() OR public.is_admin());

CREATE POLICY questions_admin_delete ON public.questions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- quiz_questions ------------------------------------------------------------
CREATE POLICY quiz_questions_select_visible_quiz ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (public.can_read_quiz("quizId"));

CREATE POLICY quiz_questions_insert_own_quiz ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_quiz("quizId"));

CREATE POLICY quiz_questions_update_own_quiz ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (public.can_write_quiz("quizId"))
  WITH CHECK (public.can_write_quiz("quizId"));

CREATE POLICY quiz_questions_admin_delete ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- quiz_attempts -------------------------------------------------------------
-- Read: the family it belongs to, the teacher of that class (grading), admins.
-- Insert: a parent, for their own child only — WITH CHECK calls
-- can_read_student(), and the BEFORE INSERT trigger derives parentId from the
-- child row, so a spoofed parentId is overwritten, not trusted.
-- Update: the teacher of that class (grading) and admins.
CREATE POLICY quiz_attempts_select_own ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (public.can_read_student("studentId"));

CREATE POLICY quiz_attempts_insert_own_child ON public.quiz_attempts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_read_student("studentId")
    AND public.can_read_quiz("quizId")
    AND NOT public.is_teacher()
  );

CREATE POLICY quiz_attempts_grade_school ON public.quiz_attempts
  FOR UPDATE TO authenticated
  USING (public.can_write_student_record("studentId"))
  WITH CHECK (public.can_write_student_record("studentId"));

CREATE POLICY quiz_attempts_admin_delete ON public.quiz_attempts
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- academic_years ------------------------------------------------------------
-- The school calendar is visible to every signed-in user; only admins change it.
CREATE POLICY academic_years_select_all ON public.academic_years
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY academic_years_admin_write ON public.academic_years
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. Explicit privileges for `authenticated`
--    (RLS decides which rows; the grant decides whether the table is reachable
--    at all. Both are needed, and this makes the model readable in one place.)
-- ---------------------------------------------------------------------------

GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamification TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_attempts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_years TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. The push-notification trigger function is not a public API
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.call_push_notification() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.call_push_notification() FROM anon;
REVOKE ALL ON FUNCTION public.call_push_notification() FROM authenticated;
REVOKE ALL ON FUNCTION public.set_quiz_attempt_parent() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_quiz_attempt_parent() FROM anon;
REVOKE ALL ON FUNCTION public.set_quiz_attempt_parent() FROM authenticated;
REVOKE ALL ON FUNCTION public.enforce_quiz_attempt_integrity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_quiz_attempt_integrity() FROM anon;
REVOKE ALL ON FUNCTION public.enforce_quiz_attempt_integrity() FROM authenticated;
REVOKE ALL ON FUNCTION public.touch_quizzes_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_quizzes_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.touch_quizzes_updated_at() FROM authenticated;
