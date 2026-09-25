/*
# Turn RLS on for the tables that never had it, and give each one its rules

## Why this file exists

The `relrowsecurity` listing came back `false` for sixteen public tables. A policy
on a table with RLS switched off does nothing at all, so on those tables:

- every row is readable by the `anon` role — the key that ships inside the web page
  and the app bundle — and
- every row is **writable** by it too (PostgREST exposes the table, and the default
  grants give `anon` INSERT/UPDATE/DELETE), unless a trigger or constraint stops it.

That is not theoretical for these tables:

| Table | What becomes public while RLS is off |
| --- | --- |
| `messages` | every parent↔school conversation, in full |
| `report_comments` | teachers' and the principal's comments about named children |
| `announcements`, `announcement_recipients` | school notices, including targeted ones |
| `questions`, `quiz_questions` | the question bank and every quiz's answer key |
| `ai_reviews`, `ai_review_logs`, `lesson_period_ai_reviews` | staff performance reviews of teachers' lesson plans |
| `id_migration_map` | a mapping table that contains profile **emails** |
| `student_lesson_progress` | per-student learning progress — see §8, deliberately left for you |

## What this file does

For each table: switch RLS on, then make sure the people who legitimately use it
keep working. Every rule is written in the same vocabulary as the school's own
working policies (`current_profile_role()` / `current_profile_id()`), and no
existing policy is dropped.

**The one assumption:** everybody who reads or writes these tables is signed in —
the website staff pages, the parent app, and any script — so the rules can be
granted to `authenticated`. If any page writes to one of these tables with the anon
key and no session, tell me which and I will add a narrow rule for it; otherwise
that page will get "permission denied" after this runs.

## Verification checklist after applying

| Screen | Expected |
| --- | --- |
| parent: messages | own threads visible, can send, can mark read |
| parent: announcements | class notices visible |
| parent: quiz | questions load |
| parent: report card | comments visible |
| teacher: create announcement | works, and only for their classes |
| teacher: author a quiz / question | works, own items only |
| teacher: report comments | writes for their own exams |
| admin / office: students, marks, terms, subjects | reads unchanged |
| **anything opened without signing in** | sees nothing on these tables (that is the point) |

Rollback: `alter table <name> disable row level security;` puts a table back
exactly as it was, and that statement is safe to run on its own.

Order: apply this during a quiet moment, then walk the checklist above.
*/

-- ---------------------------------------------------------------------------
-- 1. Helpers this file adds (nothing existing is replaced)
-- ---------------------------------------------------------------------------

-- May the caller write to this person? Mirrors the school's own relationship
-- rules: admin anyone, teacher the families in their classes, parent the teachers
-- of their children's classes. Used by the messaging rules below, and by the
-- send_message() function when that lands.
CREATE OR REPLACE FUNCTION public.can_message(p_recipient text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_recipient IS NULL OR p_recipient = public.current_profile_id() THEN false
    WHEN public.current_profile_role() = 'admin' THEN true
    WHEN public.current_profile_role() IN ('teacher', 'supervisor') THEN EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE s."parentId" = p_recipient
        AND cs."teacherId" = public.current_profile_id()
    )
    WHEN public.current_profile_role() = 'parent' THEN EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE s."parentId" = public.current_profile_id()
        AND cs."teacherId" = p_recipient
    )
    ELSE false
  END
$$;

-- May the caller read this class? Their children's classes, or the classes they teach.
CREATE OR REPLACE FUNCTION public.can_reach_class(p_class text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_class IS NULL THEN false
    WHEN public.current_profile_role() IN ('admin', 'supervisor', 'office') THEN true
    WHEN public.current_profile_role() = 'parent' THEN EXISTS (
      SELECT 1 FROM public.students s
      WHERE s."parentId" = public.current_profile_id() AND s."className" = p_class
    )
    WHEN public.current_profile_role() = 'teacher' THEN EXISTS (
      SELECT 1 FROM public.class_subjects cs
      WHERE cs."teacherId" = public.current_profile_id() AND cs."className" = p_class
    )
    ELSE false
  END
$$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY['public.can_message(text)', 'public.can_reach_class(text)']
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. messages — conversations are between the two participants
--    RLS was off: every thread in the school was readable and writable.
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- The private tables lose the anon grant outright as well: belt and braces, in
-- case a future policy is added carelessly.
REVOKE ALL ON TABLE public.messages FROM anon;
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;

-- Only the read receipt may be written on an existing message. The table-level
-- UPDATE grant has to be removed first, otherwise a column grant adds nothing and
-- a participant could rewrite the text of a conversation ("readAt" is the only
-- thing the app ever updates; edits and deletes are not a feature).
REVOKE UPDATE ON TABLE public.messages FROM authenticated;
GRANT UPDATE ("readAt") ON TABLE public.messages TO authenticated;

-- Reading: the participant rule that already exists (20260923101000) is kept.

DROP POLICY IF EXISTS messages_send_participant ON public.messages;
CREATE POLICY messages_send_participant ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    "senderId" = current_profile_id()
    AND public.can_message("recipientId")
  );

-- Marking read: only the recipient, and only that single column is writable.
DROP POLICY IF EXISTS messages_mark_read ON public.messages;
CREATE POLICY messages_mark_read ON public.messages
  FOR UPDATE TO authenticated
  USING ("recipientId" = current_profile_id())
  WITH CHECK ("recipientId" = current_profile_id());

-- ---------------------------------------------------------------------------
-- 3. announcements / announcement_recipients
-- ---------------------------------------------------------------------------

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.announcements FROM anon;
REVOKE ALL ON TABLE public.announcement_recipients FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.announcement_recipients TO authenticated;

-- Parents: the class rule already added in 20260923101000 (announcements_parent_read).

DROP POLICY IF EXISTS announcements_staff_read ON public.announcements;
CREATE POLICY announcements_staff_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    current_profile_role() IN ('admin', 'supervisor', 'office')
    OR (current_profile_role() = 'teacher' AND public.can_reach_class("className"))
  );

DROP POLICY IF EXISTS announcements_staff_insert ON public.announcements;
CREATE POLICY announcements_staff_insert ON public.announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    "createdBy" = current_profile_id()
    AND (
      current_profile_role() IN ('admin', 'supervisor', 'office')
      OR (current_profile_role() = 'teacher' AND public.can_reach_class("className"))
    )
  );

DROP POLICY IF EXISTS announcements_author_modify ON public.announcements;
CREATE POLICY announcements_author_modify ON public.announcements
  FOR UPDATE TO authenticated
  USING ("createdBy" = current_profile_id() OR current_profile_role() = 'admin')
  WITH CHECK ("createdBy" = current_profile_id() OR current_profile_role() = 'admin');

DROP POLICY IF EXISTS announcements_author_delete ON public.announcements;
CREATE POLICY announcements_author_delete ON public.announcements
  FOR DELETE TO authenticated
  USING ("createdBy" = current_profile_id() OR current_profile_role() = 'admin');

-- Targeted announcement recipients: a parent sees their own row (added in
-- 20260923101000); staff manage the rows of announcements they may write.
DROP POLICY IF EXISTS announcement_recipients_staff_write ON public.announcement_recipients;
CREATE POLICY announcement_recipients_staff_write ON public.announcement_recipients
  FOR ALL TO authenticated
  USING (
    current_profile_role() IN ('admin', 'supervisor', 'office')
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = "announcementId" AND a."createdBy" = current_profile_id()
    )
  )
  WITH CHECK (
    current_profile_role() IN ('admin', 'supervisor', 'office')
    OR EXISTS (
      SELECT 1 FROM public.announcements a
      WHERE a.id = "announcementId" AND a."createdBy" = current_profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 4. questions / quiz_questions — the question bank and quiz contents
-- ---------------------------------------------------------------------------

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.questions FROM anon;
REVOKE ALL ON TABLE public.quiz_questions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.quiz_questions TO authenticated;

DROP POLICY IF EXISTS questions_owner_read ON public.questions;
CREATE POLICY questions_owner_read ON public.questions
  FOR SELECT TO authenticated
  USING (
    "teacherId" = current_profile_id()
    OR current_profile_role() IN ('admin', 'supervisor')
  );

DROP POLICY IF EXISTS questions_owner_write ON public.questions;
CREATE POLICY questions_owner_write ON public.questions
  FOR ALL TO authenticated
  USING ("teacherId" = current_profile_id() OR current_profile_role() = 'admin')
  WITH CHECK ("teacherId" = current_profile_id() OR current_profile_role() = 'admin');

-- Parents read the questions of a quiz set for their child's class (policy added
-- in 20260923101000); staff read the questions of quizzes they own or oversee.
DROP POLICY IF EXISTS quiz_questions_staff_read ON public.quiz_questions;
CREATE POLICY quiz_questions_staff_read ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    current_profile_role() IN ('admin', 'supervisor', 'office')
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = "quizId"
        AND (q."teacherId" = current_profile_id() OR public.can_reach_class(q."className"))
    )
  );

DROP POLICY IF EXISTS quiz_questions_owner_write ON public.quiz_questions;
CREATE POLICY quiz_questions_owner_write ON public.quiz_questions
  FOR ALL TO authenticated
  USING (
    current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = "quizId" AND q."teacherId" = current_profile_id()
    )
  )
  WITH CHECK (
    current_profile_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = "quizId" AND q."teacherId" = current_profile_id()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. report_comments — teachers' and the principal's comments about a child
-- ---------------------------------------------------------------------------

ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.report_comments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.report_comments TO authenticated;

-- Parents: report_comments_parent_read (added in 20260923103000, which fixed the
-- rule that compared the auth uid and therefore never matched).

DROP POLICY IF EXISTS report_comments_staff_read ON public.report_comments;
CREATE POLICY report_comments_staff_read ON public.report_comments
  FOR SELECT TO authenticated
  USING (
    current_profile_role() IN ('admin', 'supervisor', 'office')
    OR "teacherId" = current_profile_id()
  );

DROP POLICY IF EXISTS report_comments_teacher_write ON public.report_comments;
CREATE POLICY report_comments_teacher_write ON public.report_comments
  FOR ALL TO authenticated
  USING ("teacherId" = current_profile_id() OR current_profile_role() = 'admin')
  WITH CHECK ("teacherId" = current_profile_id() OR current_profile_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 6. Reference data: reads were deliberately public in the live policies
--    (`Read terms`, `Read subjects`, `Read grades`, `Read config` are
--    `TO public USING (true)`), so switching RLS on changes nothing for readers.
--    It does stop the tables being writable by everyone, which they were.
-- ---------------------------------------------------------------------------

ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_scales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS terms_admin_write ON public.terms;
CREATE POLICY terms_admin_write ON public.terms
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS subjects_admin_write ON public.subjects;
CREATE POLICY subjects_admin_write ON public.subjects
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS grade_scales_admin_write ON public.grade_scales;
CREATE POLICY grade_scales_admin_write ON public.grade_scales
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

DROP POLICY IF EXISTS report_config_admin_write ON public.report_config;
CREATE POLICY report_config_admin_write ON public.report_config
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 7. The school calendar: readable when signed in (policy added in
--    20260923101000), writable by the office.
-- ---------------------------------------------------------------------------

ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS academic_years_admin_write ON public.academic_years;
CREATE POLICY academic_years_admin_write ON public.academic_years
  FOR ALL TO authenticated
  USING (current_profile_role() = 'admin')
  WITH CHECK (current_profile_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 8. Staff-internal tables whose policies already exist — switching RLS on is
--    the whole fix here, because the rules were written and just never applied.
-- ---------------------------------------------------------------------------

ALTER TABLE public.ai_reviews ENABLE ROW LEVEL SECURITY;              -- admin_all, supervisor_manage, teacher_select_own
ALTER TABLE public.ai_review_logs ENABLE ROW LEVEL SECURITY;          -- admin_all, teacher_select_own_ai_logs
ALTER TABLE public.lesson_period_ai_reviews ENABLE ROW LEVEL SECURITY; -- admin_all, supervisor_manage, teacher_select_own

REVOKE ALL ON TABLE public.ai_reviews FROM anon;
REVOKE ALL ON TABLE public.ai_review_logs FROM anon;
REVOKE ALL ON TABLE public.lesson_period_ai_reviews FROM anon;

-- A bookkeeping table that also contains profile emails. Nothing but a server-side
-- key has any business reading it, so RLS goes on with no policy at all: only the
-- service role (which bypasses RLS) can see it from now on.
ALTER TABLE public.id_migration_map ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.id_migration_map FROM anon;
REVOKE ALL ON TABLE public.id_migration_map FROM authenticated;

-- ---------------------------------------------------------------------------
-- 9. Deliberately NOT touched: student_lesson_progress
--
--    RLS is off there too, but its `student_id` is `uuid` while `students.id` is
--    `text`, so there is no way to tell whose progress a row is. Switching RLS on
--    without knowing that mapping would break whatever reads it; leaving it off
--    keeps per-student learning progress public. Two questions decide it:
--      * which app reads this table (student device? parent device?)
--      * what is `student_id` — a profile id, an auth uid, or something else?
--    Once answered, the rule is two lines and follows the pattern above.
-- ---------------------------------------------------------------------------
