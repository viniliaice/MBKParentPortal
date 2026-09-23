-- ============================================================================
-- Live policies and helpers, transcribed from the school's pg_policies export.
--
-- This is the state of the project *before* the remediation policies are
-- applied, including the rules that never match (they compare profiles.id with
-- auth.uid()::text, which is never true in this data) and the blanket policies
-- that were dropped. Tests apply this, then the migrations, then assert the
-- difference.
--
-- Transcribed faithfully for the tables the tests exercise, so a test result
-- says something about production rather than about a convenient invention.
--
-- The three helper functions are reconstructed from observed behaviour, not read
-- from the project (their real definitions are still to be exported):
--   current_profile_id()   auth.uid() -> profiles.id        (business id)
--   current_profile_role() auth.uid() -> profiles.role
--   is_admin()             role = 'admin'
-- Flagged in docs/schema.md, because a different real definition would make some
-- assertions here optimistic.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY INVOKER)
--
-- These read `profiles` as the *calling* role, so row level security applies
-- inside them. That is not an assumption any more: it is what production proved
-- when a policy on `profiles` that called them produced
--   "infinite recursion detected in policy for relation profiles"
-- (docs/schema.md §6.4). If they were SECURITY DEFINER there would have been no
-- recursion. Tests must keep them invoker, because that is the harder case: any
-- policy on `profiles` has to survive it.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT coalesce(public.current_profile_role() = 'admin', false)
$$;

GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- The RLS state as reported: which tables had it on, and which did not
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'attendance', 'audit_logs', 'authorized_pickup_students', 'authorized_pickups',
    'class_subjects', 'exams', 'grade_correction_audit', 'grade_uploads', 'homework',
    'lesson_plan_periods', 'lesson_plans', 'profiles', 'quiz_attempts', 'quizzes',
    'release_log', 'student_enrollments', 'student_merge_audit', 'student_merge_audits',
    'student_merge_batches', 'student_promotions', 'students', 'unit_plans'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;

  -- Left OFF on purpose: this is exactly what was reported, and the whole point
  -- of migration 20260923104000 is to switch these on.
  foreach t in array array[
    'academic_years', 'ai_review_logs', 'ai_reviews', 'announcement_recipients',
    'announcements', 'grade_scales', 'id_migration_map', 'lesson_period_ai_reviews',
    'messages', 'questions', 'quiz_questions', 'report_comments', 'report_config',
    'student_lesson_progress', 'subjects', 'terms'
  ]
  loop
    execute format('alter table public.%I disable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- profiles (RLS on)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated users" ON public.profiles;
CREATE POLICY "Allow authenticated users" ON public.profiles
  FOR ALL TO public
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Profiles can read own profile" ON public.profiles;
CREATE POLICY "Profiles can read own profile" ON public.profiles
  FOR SELECT TO public
  USING (auth.uid() = auth_id);

-- A rule with the other convention. Kept because it is live, and because the
-- tests assert that it never matches.
DROP POLICY IF EXISTS "Users see own profile" ON public.profiles;
CREATE POLICY "Users see own profile" ON public.profiles
  FOR SELECT TO public
  USING (id = (auth.uid())::text);

-- ---------------------------------------------------------------------------
-- students (RLS on)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for all users" ON public.students;
CREATE POLICY "Enable read access for all users" ON public.students
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS students_admin_supervisor_office_read ON public.students;
CREATE POLICY students_admin_supervisor_office_read ON public.students
  FOR SELECT TO authenticated
  USING (current_profile_role() = ANY (ARRAY['admin', 'supervisor', 'office']));

DROP POLICY IF EXISTS students_teacher_read ON public.students;
CREATE POLICY students_teacher_read ON public.students
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'teacher'
    AND "className" IN (
      SELECT cs."className" FROM public.class_subjects cs
      WHERE cs."teacherId" = current_profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- exams (RLS on): the parent rule that works, the admin rule that does not
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS exam_select_authorized ON public.exams;
CREATE POLICY exam_select_authorized ON public.exams
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = ANY (ARRAY['admin', 'supervisor'])
    OR "teacherId" = current_profile_id()
    OR "parentId" = current_profile_id()
  );

DROP POLICY IF EXISTS "Admins full access exams" ON public.exams;
CREATE POLICY "Admins full access exams" ON public.exams
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = (auth.uid())::text AND profiles.role = 'admin'
  ));

DROP POLICY IF EXISTS "Parents see own children exams" ON public.exams;
CREATE POLICY "Parents see own children exams" ON public.exams
  FOR SELECT TO public
  USING (("parentId" = (auth.uid())::text)
    OR ("studentId" IN (SELECT students.id FROM public.students WHERE students."parentId" = (auth.uid())::text)));

-- ---------------------------------------------------------------------------
-- attendance / homework (RLS on): the parent rules that already work
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS attendance_parent_read ON public.attendance;
CREATE POLICY attendance_parent_read ON public.attendance
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "studentId" IN (SELECT s.id FROM public.students s WHERE s."parentId" = current_profile_id())
  );

DROP POLICY IF EXISTS homework_parent_read ON public.homework;
CREATE POLICY homework_parent_read ON public.homework
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "studentId" IN (SELECT s.id FROM public.students s WHERE s."parentId" = current_profile_id())
  );

-- ---------------------------------------------------------------------------
-- quizzes / quiz_attempts (RLS on)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS quizzes_parent_read ON public.quizzes;
CREATE POLICY quizzes_parent_read ON public.quizzes
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "className" IN (SELECT s."className" FROM public.students s WHERE s."parentId" = current_profile_id())
  );

DROP POLICY IF EXISTS quizzes_teacher_write ON public.quizzes;
CREATE POLICY quizzes_teacher_write ON public.quizzes
  FOR ALL TO authenticated
  USING (current_profile_role() = ANY (ARRAY['admin', 'teacher']) AND "teacherId" = current_profile_id())
  WITH CHECK (current_profile_role() = ANY (ARRAY['admin', 'teacher']) AND "teacherId" = current_profile_id());

DROP POLICY IF EXISTS quiz_attempts_parent ON public.quiz_attempts;
CREATE POLICY quiz_attempts_parent ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "studentId" IN (SELECT s.id FROM public.students s WHERE s."parentId" = current_profile_id())
  )
  WITH CHECK (
    current_profile_role() = 'parent'
    AND "studentId" IN (SELECT s.id FROM public.students s WHERE s."parentId" = current_profile_id())
  );

DROP POLICY IF EXISTS quiz_attempts_staff ON public.quiz_attempts;
CREATE POLICY quiz_attempts_staff ON public.quiz_attempts
  FOR SELECT TO authenticated
  USING (current_profile_role() = ANY (ARRAY['admin', 'supervisor', 'office', 'teacher']));

-- ---------------------------------------------------------------------------
-- report_comments (RLS OFF in production): the rule that never matches
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Parents see own comments" ON public.report_comments;
CREATE POLICY "Parents see own comments" ON public.report_comments
  FOR SELECT TO public
  USING ("studentId" IN (SELECT students.id FROM public.students WHERE students."parentId" = (auth.uid())::text));

-- ---------------------------------------------------------------------------
-- Reference data (RLS OFF in production): reads deliberately public
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Read terms" ON public.terms;
CREATE POLICY "Read terms" ON public.terms FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Read subjects" ON public.subjects;
CREATE POLICY "Read subjects" ON public.subjects FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Read grades" ON public.grade_scales;
CREATE POLICY "Read grades" ON public.grade_scales FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Read config" ON public.report_config;
CREATE POLICY "Read config" ON public.report_config FOR SELECT TO public USING (true);

-- ---------------------------------------------------------------------------
-- Staff-internal tables (RLS OFF in production, policies already written)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS ai_reviews_admin_all ON public.ai_reviews;
CREATE POLICY ai_reviews_admin_all ON public.ai_reviews
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS ai_review_logs_admin_all ON public.ai_review_logs;
CREATE POLICY ai_review_logs_admin_all ON public.ai_review_logs
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS lesson_period_ai_reviews_admin_all ON public.lesson_period_ai_reviews;
CREATE POLICY lesson_period_ai_reviews_admin_all ON public.lesson_period_ai_reviews
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

-- The teacher/supervisor rules from the export. Without these the fixture would
-- claim staff cannot read their own reviews, which is not what production says.
DROP POLICY IF EXISTS supervisor_manage_reviews ON public.ai_reviews;
CREATE POLICY supervisor_manage_reviews ON public.ai_reviews
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.auth_id = auth.uid() AND profiles.role = 'supervisor'
  ));

DROP POLICY IF EXISTS teacher_select_own_reviews ON public.ai_reviews;
CREATE POLICY teacher_select_own_reviews ON public.ai_reviews
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.lesson_plans
    WHERE lesson_plans.id = ai_reviews.plan_id
      AND lesson_plans.teacher_id = current_profile_id()
  ));

DROP POLICY IF EXISTS teacher_select_own_ai_logs ON public.ai_review_logs;
CREATE POLICY teacher_select_own_ai_logs ON public.ai_review_logs
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.lesson_plans
    WHERE lesson_plans.id = ai_review_logs.plan_id
      AND lesson_plans.teacher_id = (auth.uid())::text
  ));

-- lesson_plans / lesson_plan_periods (RLS on in production, needed because the
-- review policies above read lesson_plans)
DROP POLICY IF EXISTS lesson_plans_admin_all ON public.lesson_plans;
CREATE POLICY lesson_plans_admin_all ON public.lesson_plans
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin') WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS lesson_plans_supervisor_read ON public.lesson_plans;
CREATE POLICY lesson_plans_supervisor_read ON public.lesson_plans
  FOR SELECT TO authenticated USING (current_profile_role() = 'supervisor');

DROP POLICY IF EXISTS lesson_plans_teacher_own ON public.lesson_plans;
CREATE POLICY lesson_plans_teacher_own ON public.lesson_plans
  FOR ALL TO authenticated
  USING (current_profile_role() = 'teacher' AND teacher_id = current_profile_id())
  WITH CHECK (current_profile_role() = 'teacher' AND teacher_id = current_profile_id());

-- ---------------------------------------------------------------------------
-- class_subjects / student_enrollments / release_log (RLS on, staff reads)
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS class_subjects_select ON public.class_subjects;
CREATE POLICY class_subjects_select ON public.class_subjects FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS enrollments_parent_read ON public.student_enrollments;
CREATE POLICY enrollments_parent_read ON public.student_enrollments
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "studentId" IN (SELECT s.id FROM public.students s WHERE s."parentId" = current_profile_id())
  );
