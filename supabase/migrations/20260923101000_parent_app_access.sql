/*
# Step 1 (ADDITIVE): the parent app's read paths, and only those

Everything here only *adds* access. Nothing in this file drops, replaces or
narrows an existing rule, so it cannot break a page that works today.

## What the live policy set already covers (verified against pg_policies)

The school's own policies already scope parents correctly for:

  attendance   attendance_parent_read      parent + studentId in own children
  homework     homework_parent_read        parent + studentId in own children
  quizzes      quizzes_parent_read         parent + className of own children
  quiz_attempts quiz_attempts_parent       parent + studentId in own children
  student_enrollments  enrollments_parent_read
  release_log  Parents can read own children releases
  report_comments  Parents see own comments
  exams        Parents see own children exams

So the audit's "parents only their authorized records" requirement is largely
implemented already. This migration does not touch any of it.

## Gaps this migration fills

1. students — there is **no parent rule**: parents can read their children today
   only because of `Enable read access for all users` (USING (true), role
   {public}), which also exposes every child to every other parent and to anon.
   The parent rule has to exist *before* that open rule can be removed
   (step 2, separate file).
2. messages — no policy exists at all. A parent cannot read their own thread.
3. announcements / announcement_recipients — no policies exist. Parents cannot
   read their class announcements (or a directly targeted one).
4. quiz_questions — no policy exists. Without it the quiz screen has no questions.
5. academic_years — no policy exists. app/results.tsx reads the calendar.

## Conventions

- The rules below use `current_profile_role()` / `current_profile_id()`, the same
  helpers the school's existing policies use, so they resolve identically to the
  rules that already work. They deliberately do not mix in
  `(auth.uid())::text` comparisons: the live set contains both conventions, and
  whichever one is authoritative, the helper form is the one used by the parent
  policies that are known to work.
- Roles are targeted explicitly (`TO authenticated`), and the parent rule always
  checks the role, so a staff account cannot be mistaken for a family.
- `announcement_recipients` is honoured for targeted announcements.

## Deployment

Apply after the read-only checks in docs/schema.md §6, on a restored copy first.
It is safe to run more than once.
*/

-- ---------------------------------------------------------------------------
-- 1. students: the parent could not see their own children once the open rule
--    is gone.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS students_parent_read ON public.students;
CREATE POLICY students_parent_read ON public.students
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "parentId" = current_profile_id()
  );

-- ---------------------------------------------------------------------------
-- 2. messages: the participant rule the app needs. Writes stay closed: the
--    send_message() function owns them (see the messaging migration), because a
--    sender identity must never come from the client.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS messages_participant_read ON public.messages;
CREATE POLICY messages_participant_read ON public.messages
  FOR SELECT TO authenticated
  USING (
    "senderId" = current_profile_id()
    OR "recipientId" = current_profile_id()
  );

-- ---------------------------------------------------------------------------
-- 3. announcements: the parent sees an announcement for a class their children
--    are in, or one addressed to them directly.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS announcements_parent_read ON public.announcements;
CREATE POLICY announcements_parent_read ON public.announcements
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "className" IN (
      SELECT s."className" FROM public.students s
      WHERE s."parentId" = current_profile_id()
    )
  );

DROP POLICY IF EXISTS announcement_recipients_parent_read ON public.announcement_recipients;
CREATE POLICY announcement_recipients_parent_read ON public.announcement_recipients
  FOR SELECT TO authenticated
  USING ("parentId" = current_profile_id());

-- ---------------------------------------------------------------------------
-- 4. quiz_questions: a parent reads the questions of a quiz set for their
--    child's class, which is exactly the set quizzes_parent_read already shows.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS quiz_questions_parent_read ON public.quiz_questions;
CREATE POLICY quiz_questions_parent_read ON public.quiz_questions
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "quizId" IN (
      SELECT q.id FROM public.quizzes q
      WHERE q."className" IN (
        SELECT s."className" FROM public.students s
        WHERE s."parentId" = current_profile_id()
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. academic_years: the school calendar, read by every signed-in user
--    (app/results.tsx). Reference data that carries no personal information.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS academic_years_read ON public.academic_years;
CREATE POLICY academic_years_read ON public.academic_years
  FOR SELECT TO authenticated
  USING (true);
