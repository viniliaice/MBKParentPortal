/*
# Fix: "infinite recursion detected in policy for relation profiles"

## What broke

Two files applied during this remediation put rules on `profiles` whose bodies
read other tables or call the project's helper functions:

| File | Rule | Why it closes a loop |
| --- | --- | --- |
| `20260923102000` | `profiles_parent_read_own` | calls `current_profile_role()`, which reads `profiles` |
| `20260923103000` | `profiles_staff_read` | calls `current_profile_role()` — same loop |
| `20260923103000` | `profiles_teacher_read_class_parents` | reads `students` + `class_subjects`, whose own policies call the helper, which reads `profiles` |
| `20260923103000` | `profiles_parent_read_class_teachers` | same |

The project's helpers (`current_profile_id()`, `current_profile_role()`) run as the
**caller**, so row level security applies inside them. A rule on `profiles` that
makes the database read `profiles` in order to decide whether `profiles` may be
read never terminates — which is what the website hit on sign-in while loading the
profile.

Before these files, no policy on `profiles` read anything, so the same helpers were
safe everywhere else. That is the property this file restores.

## The fix, and the rule it establishes

Every rule on `profiles` now delegates to **one** function that resolves the whole
question as a `SECURITY DEFINER` owner-privileged read, so nothing it does can
re-enter the policies:

    profiles_read_authorized  ->  can_read_profile(id)   [SECURITY DEFINER]

Inside `can_read_profile` the nested reads run as the function owner, where row
level security does not apply, so the loop cannot form. The access it grants is
exactly what the four dropped rules granted, in one place and readable in one
breath:

| Caller | May read |
| --- | --- |
| anyone | their own profile row |
| admin, supervisor, office | any profile (the directory) |
| teacher | the families of the students in their classes |
| parent | the teachers of their children's classes |

Nothing else changes: `authenticated` access stays, `anon` gets nothing (it was
never in any of the dropped rules either), and the project's own policies are left
alone (`Profiles can read own profile`, `Users see own profile`).

**Rule going forward:** a policy on `profiles` must not query a table. Put the
relationship in a `SECURITY DEFINER` function and call it — that is what the
recursion was telling us, and `tests/db/recursion.test.mjs` asserts it from now on.

## Order

Apply this straight away; it is the file that makes sign-in work again. It replaces
policies this remediation added (nothing of the school's is dropped), and the
access each one granted is preserved by the function above.
*/

-- ---------------------------------------------------------------------------
-- 1. One owner-privileged rule for "may this caller read this profile?"
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.can_read_profile(p_profile_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_profile_id IS NULL THEN false

    -- their own row
    WHEN EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.auth_id = auth.uid() AND me.id = p_profile_id
    ) THEN true

    -- the tiers that run the school keep the whole directory
    WHEN EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.auth_id = auth.uid() AND me.role = ANY (ARRAY['admin', 'supervisor', 'office'])
    ) THEN true

    -- a teacher may read the families of the students in their classes
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles me
      JOIN public.students s ON s."parentId" = p_profile_id
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE me.auth_id = auth.uid()
        AND me.role = 'teacher'
        AND cs."teacherId" = me.id
    ) THEN true

    -- a parent may read the teachers of their children's classes
    WHEN EXISTS (
      SELECT 1
      FROM public.profiles me
      JOIN public.students s ON s."parentId" = me.id
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE me.auth_id = auth.uid()
        AND me.role = 'parent'
        AND cs."teacherId" = p_profile_id
    ) THEN true

    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.can_read_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_profile(text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Replace the four self-referential rules with the delegating one
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_parent_read_own ON public.profiles;
DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
DROP POLICY IF EXISTS profiles_teacher_read_class_parents ON public.profiles;
DROP POLICY IF EXISTS profiles_parent_read_class_teachers ON public.profiles;

DROP POLICY IF EXISTS profiles_read_authorized ON public.profiles;
CREATE POLICY profiles_read_authorized ON public.profiles
  FOR SELECT TO authenticated
  USING (public.can_read_profile(id));

-- ---------------------------------------------------------------------------
-- 3. The same shape for the two tables whose rules read other tables, so the
--    loops cannot come back through them either. Both keep the access their
--    replacements had; only the nesting changes.
-- ---------------------------------------------------------------------------

-- students: nothing to change (its rules belong to the school and call the
-- helpers, which is safe because no profiles rule reads anything now).

-- report_comments: the parent rule read `students`. It is fine today (nothing
-- re-enters profiles), but this keeps it to one indexed hop.
DROP POLICY IF EXISTS report_comments_parent_read ON public.report_comments;
CREATE POLICY report_comments_parent_read ON public.report_comments
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND "studentId" IN (
      SELECT s.id FROM public.students s
      WHERE s."parentId" = current_profile_id()
    )
  );
