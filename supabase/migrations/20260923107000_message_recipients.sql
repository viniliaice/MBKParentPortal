/*
# Fix: who may send a message to whom

## What this corrects

`20260923104000_enable_rls_close_public_tables.sql` switched RLS on for `messages`
and added `messages_send_participant`, which calls `public.can_message()`. That
function, as it shipped, only allowed:

- `admin` → anyone
- `teacher` / `supervisor` → the parents of the students in classes they teach
- `parent` → the teachers of their children's classes

Two legitimate paths were therefore taken away:

1. **The office could not send a message at all.** `office` was not in any branch,
   so `can_message()` returned false for every recipient. Before RLS was switched
   on, `messages` had no policy at all, so an office account could write — this is
   a regression that file introduced, not a tightening anyone asked for.
2. **A parent could not reach the school office.** The school's published privacy
   policy §11 says: *"Signed-in parents and guardians can also send a request from
   the Messages section of the portal."* With the office unable to be a recipient,
   that sentence described something the database would refuse.

Neither restores anything unsafe: before this remediation `messages` had row level
security switched off, so **every** authenticated account could write to **any**
recipient. What is written here is still narrower than that — parents can never
write to another parent, and a teacher can never write to another class's families.

## The rules after this file

| Caller | May write to |
| --- | --- |
| `admin`, `supervisor`, `office` | anyone (they run the school) |
| `teacher` | the families of the students in their classes, plus other staff accounts |
| `parent` | the teachers of their children's classes, plus `office` and `admin` |
| anyone | never themselves |

This matches `list_contacts()` in `20260923106000_parent_app_functions.sql`, so the
contact list a parent sees is exactly the list they can write to — the app cannot
offer a name that then fails to send.

## Apply this even if you have not applied 20260923106000

It is independent: it replaces one function that is already live, and it is
`CREATE OR REPLACE`, so re-running is harmless. Either order is fine.
*/

CREATE OR REPLACE FUNCTION public.can_message(p_recipient text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_recipient IS NULL OR p_recipient = public.current_profile_id() THEN false

    -- The tiers that run the school may write to anyone.
    WHEN public.current_profile_role() = ANY (ARRAY['admin', 'supervisor', 'office']) THEN true

    -- A teacher: the families in their classes, and the staff they work with.
    WHEN public.current_profile_role() = 'teacher' THEN
      EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.class_subjects cs ON cs."className" = s."className"
        WHERE s."parentId" = p_recipient
          AND cs."teacherId" = public.current_profile_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_recipient
          AND p.role = ANY (ARRAY['admin', 'supervisor', 'office', 'teacher'])
      )

    -- A parent: their children's teachers, and the office (see §11 of the
    -- school's published privacy policy — parents request account changes there).
    WHEN public.current_profile_role() = 'parent' THEN
      EXISTS (
        SELECT 1
        FROM public.students s
        JOIN public.class_subjects cs ON cs."className" = s."className"
        WHERE s."parentId" = public.current_profile_id()
          AND cs."teacherId" = p_recipient
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = p_recipient
          AND p.role = ANY (ARRAY['office', 'admin'])
      )

    ELSE false
  END
$$;

REVOKE ALL ON FUNCTION public.can_message(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_message(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_message(text) TO authenticated;
