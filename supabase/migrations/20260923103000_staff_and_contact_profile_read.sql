/*
# Step 3 (ADDITIVE): restore the visibility the blanket policy was also providing

Applying 20260923102000_tighten_open_policies.sql removed
`profiles."Allow authenticated users"` (ALL, `auth.role() = 'authenticated'`).
That policy was a privilege-escalation hole, but it was also the *only* thing
letting staff read other people's profile rows, and the only thing letting a
parent resolve the name of a teacher. This file restores exactly those reads —
read-only, role-guarded, scoped to the relationship — and nothing else.

Why it is safe: it only adds policies. No existing rule is dropped, so no working
path can lose access; the worst case is that it grants a little more than needed,
which is then narrowed on review.

## What each rule is for

1. `profiles_staff_read` — the administration tiers: admin, supervisor, office.
   They run the school and need the whole directory. Read-only: writing profiles
   is now impossible for any client role, which is the point of step 2.
2. `profiles_teacher_read_class_parents` — a teacher needs the contact details of
   the families in their classes (that is who they message). Derived from
   `class_subjects` + `students`, the same relation the live policies already use.
3. `profiles_parent_read_class_teachers` — the parent side of the same thing: a
   parent must be able to resolve the name of the teachers who teach their child.
   Without this, message and contact screens lose their names, because production
   `messages` stores only `senderId` / `recipientId`.
4. `report_comments_parent_read` — the live rule
   `Parents see own comments` compares `students."parentId"` with
   `(auth.uid())::text`, and in this database `profiles.id` is never the auth uid
   text (0 of 604 rows). That rule therefore never matches, so parents cannot see
   report comments at all. This adds the same rule written the way the working
   parent policies are written.

## Note on the two identity conventions

See docs/schema.md §6, finding F: the data says `profiles.auth_id` is the link
(`current_profile_id()`), and `profiles.id = auth.uid()::text` is never true. New
rules here follow `current_profile_id()` / `current_profile_role()` only.
*/

-- ---------------------------------------------------------------------------
-- 1. Administration tiers may read the whole directory
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_staff_read ON public.profiles;
CREATE POLICY profiles_staff_read ON public.profiles
  FOR SELECT TO authenticated
  USING (current_profile_role() = ANY (ARRAY['admin', 'supervisor', 'office']));

-- ---------------------------------------------------------------------------
-- 2. A teacher may read the families in their own classes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_teacher_read_class_parents ON public.profiles;
CREATE POLICY profiles_teacher_read_class_parents ON public.profiles
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'teacher'
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE cs."teacherId" = current_profile_id()
        AND s."parentId" = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 3. A parent may read the teachers of their children's classes
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS profiles_parent_read_class_teachers ON public.profiles;
CREATE POLICY profiles_parent_read_class_teachers ON public.profiles
  FOR SELECT TO authenticated
  USING (
    current_profile_role() = 'parent'
    AND EXISTS (
      SELECT 1
      FROM public.students s
      JOIN public.class_subjects cs ON cs."className" = s."className"
      WHERE s."parentId" = current_profile_id()
        AND cs."teacherId" = profiles.id
    )
  );

-- ---------------------------------------------------------------------------
-- 4. Report comments, written the way the working parent rules are written
-- ---------------------------------------------------------------------------

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
