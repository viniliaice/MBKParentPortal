/*
# Step 2 (GATED): close the two open doors

Run this only after step 1 (20260923101000_parent_app_access.sql) is in place,
and only after the two confirmations in docs/schema.md §6 — because each of these
statements can change what a page that works today is allowed to read.

## Finding A — every parent can promote themselves to admin  (CRITICAL)

    profiles | Allow authenticated users | {public} | ALL
    USING (auth.role() = 'authenticated')

Any signed-in user — a parent — gets SELECT, INSERT, UPDATE and DELETE on every
row of `profiles`. `role` is a column on that table, so a parent can set their own
role to 'admin' (or 'supervisor'/'office'), and from that moment every other
policy in the database that keys off `current_profile_role()` hands them the whole
school: all students, all marks, all messages. It also lets one parent edit or
delete any other parent's account row.

This is the single most serious issue in the live policy set: it is privilege
escalation, reachable from the app itself.

## Finding B — every child's record is world-readable  (CRITICAL)

    students | Enable read access for all users | {public} | SELECT
    USING (true)

`{public}` includes `anon`, and the anon key ships inside the web page and the app
bundle, so this row set is readable by anyone who opens the tools and copies a
key: children's names, classes, parent ids, parent phone numbers, government ids,
family ids. It is the audit's "deny anon all access to student data" finding, in
its exact form.

## What replaces them

Nothing that a legitimate user needs is lost:

- profiles: `Profiles can read own profile` (auth.uid() = auth_id) and
  `Users see own profile` (id = (auth.uid())::text) already let every user read
  their own row, and `Admins full access` keeps the office working. Both policies
  are left untouched.
- students: step 1 adds `students_parent_read`; the live set already contains
  `students_admin_supervisor_office_read`, `Office can read all students` and
  `students_teacher_read` for staff.

## Before running: two confirmations

1. Staff tooling: does anything besides administration read *other* people's
   `profiles` rows (for example a teacher screen listing parent names)? If yes,
   tell me which screen, and step 2 gets a narrow staff rule instead of the
   blanket one — a guess here would either break that screen or leave a hole.
2. The website must sign users in *before* it reads `students` (Supabase Auth
   with the user's own token). If any page reads student data without a session,
   that page loses access on this change — deliberately, but it should be a
   decision, not a surprise.

## Rollback

Both policies can be recreated verbatim from the definitions in this file's
comment block (`CREATE POLICY "Allow authenticated users" ON public.profiles FOR
ALL TO public USING (auth.role() = 'authenticated');` and the students one), but a
backup taken before the change is the real rollback.
*/

-- ---------------------------------------------------------------------------
-- A. profiles: no more blanket write access for every signed-in user
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated users" ON public.profiles;

-- The rule that replaces it, stated positively: a parent reads their own row.
-- (Staff rows are covered by the policies already in place.)
DROP POLICY IF EXISTS profiles_parent_read_own ON public.profiles;
CREATE POLICY profiles_parent_read_own ON public.profiles
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND id = current_profile_id()
  );

-- ---------------------------------------------------------------------------
-- B. students: no more world-readable children
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Enable read access for all users" ON public.students;
