-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Auth identity model — link Supabase Auth users to app profiles

1. Purpose
- The app signs in with Supabase Auth (`signInWithPassword`) but every table was
  designed for the older "look up the email with the anon key" flow: the auth
  user id was never used by any policy, and the client was trusted to filter by
  parentId. This migration establishes the single mapping the whole security
  model depends on:

      auth.users.id  ==  profiles.auth_id        (1:1, enforced below)
      profiles.id    ==  the app-level user id used everywhere else
                         (students."parentId", messages."senderId",
                          lesson_progress.parent_id, exams."parentId", ...)

- No column is removed and no data moves. The helper functions below are the
  vocabulary the policies in 20260923090500_lockdown_rls.sql are phrased in, so
  "my child" / "my class" has exactly one definition in the database.

2. Roles (profiles.role)
- parent  : family account; sees its own children and its own rows.
- teacher : staff account; `profiles.class_name` is the class it is responsible
            for. This is also the supervisor tier the audit asked about — the
            school does not have a separate supervisor role today, so no
            invented role is given privileges. If one is ever introduced, add it
            to the allowlists here explicitly.
- admin   : school administration; full school-wide access.
- Any other value gets no staff privileges (fail closed).

3. Helpers
- Every helper is SECURITY DEFINER with an empty search_path (so a caller cannot
  shadow the tables it reads), STABLE, and executable by `authenticated` only.
  They are granted to authenticated because policies are evaluated with the
  caller's privileges — anon cannot execute them and therefore cannot probe.
- can_read_student()/can_write_student_record() are the only places where the
  parent-child and teacher-class relations are expressed; the tables then use
  them, rather than repeating (and drifting from) the rule.

4. Notes on the identity link
- `profiles.auth_id` was added by the first migration but never enforced; a
  partial UNIQUE index stops one auth user from being linked to two profiles.
- Linking happens in exactly one place, the link_profile() RPC
  (20260923091000_messaging_rpc.sql), which matches the signed-in user's verified
  email to a school-provisioned profile. Enable "Confirm email" in Supabase Auth
  so that a session can only be created by somebody who controls the mailbox.
- profiles.created_at is the real column name (both historical migrations agree).
  lib/supabase.ts used to claim `createdAt` and is corrected in this change.
*/

-- ---------------------------------------------------------------------------
-- 1. profiles: staff class + enforced 1:1 auth link
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS class_name text;

COMMENT ON COLUMN public.profiles.class_name IS
  'Class this staff account is responsible for (teacher/supervisor). NULL for parents and admins.';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_auth_id_key
  ON public.profiles (auth_id)
  WHERE auth_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email));

-- ---------------------------------------------------------------------------
-- 2. Identity helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1
$$;

-- messages."senderId"/"recipientId" are text columns (historical schema); this
-- keeps the comparison in policies free of scattered casts.
CREATE OR REPLACE FUNCTION public.current_profile_id_text()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id::text FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.role = 'admin' FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1),
    false)
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.role IN ('teacher', 'supervisor') FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1),
    false)
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT p.role IN ('teacher', 'supervisor', 'admin') FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1),
    false)
$$;

-- The class the calling teacher is responsible for; NULL for everybody else.
CREATE OR REPLACE FUNCTION public.teacher_class()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.class_name
  FROM public.profiles p
  WHERE p.auth_id = auth.uid()
    AND p.role IN ('teacher', 'supervisor')
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of_class(p_class text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.teacher_class() IS NOT NULL AND p_class = public.teacher_class()
$$;

-- The classes the calling parent's children are in.
CREATE OR REPLACE FUNCTION public.my_class_names()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(DISTINCT s."className"), ARRAY[]::text[])
  FROM public.students s
  WHERE s."parentId" = public.current_profile_id()
$$;

-- The two relations every child-record policy is built from.
CREATE OR REPLACE FUNCTION public.can_read_student(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student
      AND (
        s."parentId" = public.current_profile_id()
        OR (public.teacher_class() IS NOT NULL AND s."className" = public.teacher_class())
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_student_record(p_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = p_student
      AND public.teacher_class() IS NOT NULL
      AND s."className" = public.teacher_class()
  )
$$;

-- quiz_attempts."studentId" is a text column (historical schema), so the same
-- question is answered for text without ever forcing a bad cast.
CREATE OR REPLACE FUNCTION public.can_read_student(p_student text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_student ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_read_student(p_student::uuid)
    ELSE false
  END
$$;

CREATE OR REPLACE FUNCTION public.can_write_student_record(p_student text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_student ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN public.can_write_student_record(p_student::uuid)
    ELSE false
  END
$$;

-- Quiz visibility: the class it was set for, its author, admins.
CREATE OR REPLACE FUNCTION public.can_read_quiz(p_quiz uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = p_quiz
      AND (
        q."teacherId" = public.current_profile_id()
        OR q."className" = public.teacher_class()
        OR (q.status = 'active' AND q."className" = ANY (public.my_class_names()))
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_quiz(p_quiz uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = p_quiz
      AND q."teacherId" = public.current_profile_id()
  )
$$;

-- ---------------------------------------------------------------------------
-- 3. Only signed-in users may execute the helpers (PostgreSQL grants EXECUTE to
--    PUBLIC by default, which would hand anon the same vocabulary).
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.current_profile_id()',
    'public.current_profile_id_text()',
    'public.current_profile_role()',
    'public.is_admin()',
    'public.is_teacher()',
    'public.is_staff()',
    'public.teacher_class()',
    'public.is_teacher_of_class(text)',
    'public.my_class_names()',
    'public.can_read_student(uuid)',
    'public.can_read_student(text)',
    'public.can_write_student_record(uuid)',
    'public.can_write_student_record(text)',
    'public.can_read_quiz(uuid)',
    'public.can_write_quiz(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
