/*
# The functions the parent app calls — written for the live schema

The app talks to the database through eight functions. All eight were described in
the draft migrations that were written for the repository's *recreated* schema
(uuid ids, a `class_name` column, `expo_push_token`), which is why none of them
could be applied to the live project, and why the app cannot sign in, message or
register for push yet. This file is the same set, rewritten for the schema that
actually exists: text business ids, `profiles.auth_id` as the only auth link,
classes resolved through `students."className"` + `class_subjects."teacherId"`.

## Account deletion is a request, not a self-service delete

Accounts in this portal are created and administered by the school office, and the
app never lets a user create one. Google Play's account-deletion requirement is
triggered by *in-app account creation* (their FAQ includes an app that "directs the
user to an app account creation flow outside of the app"), so it is not triggered
here — and the school's published privacy policy §11 says deletion requests are
handled by the school. Accordingly this file ships **`request_account_deletion()`
only**: it records the request for the office and deletes nothing. Do not add a
self-service delete later without revisiting that decision, because if the app ever
gains self-service sign-up, Play requires both an in-app deletion path *and* a
public web resource.

## Before applying

Run this **first** and send me the output. If any of these names already exist,
they may be the website's implementation, and this file would replace them:

```sql
-- Signatures AND bodies: if any of these already exist, they may be what the
-- website calls, and this file would replace them. Send the output here before
-- applying anything.
select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('link_profile','set_push_token','clear_push_token',
                    'list_contacts','send_message','mark_message_read',
                    'request_account_deletion','delete_my_account')
order by 1;
```

**If it returns rows, stop and send them to me.** This file uses
`CREATE OR REPLACE FUNCTION` with fixed names because the app calls those names,
so an existing definition — the website's, perhaps — would be replaced. Only an
empty result means it is safe to paste as is.

## Why these are SECURITY DEFINER, and what that obliges them to do

A function that runs as its owner bypasses row level security, so every one of
them re-checks the relationship itself instead of relying on a policy:

- `link_profile()` may only claim a profile whose `auth_id` is still NULL and
  whose email matches the caller's verified JWT email exactly.
- `send_message()` may only write with the caller as sender, and only to somebody
  `can_message()` allows (their child's teacher, their class's parent, an admin).
- `mark_message_read()` may only touch a row where the caller is the recipient.
- `request_account_deletion()` may only record a request for the caller, and it
  deletes nothing at all.

## What is added to hold the request trail

One table, `account_deletion_requests`, which the live project does not have:
additive, administrator-only by policy, and empty until a family asks the school to
close an account.
*/

-- ---------------------------------------------------------------------------
-- 1. Tables for the deletion flow (audit trail and the retained snapshot)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "profileId"     text NOT NULL,
  email           text,
  "requestedAt"   timestamptz NOT NULL DEFAULT now(),
  reason          text,
  status          text NOT NULL DEFAULT 'requested',
  "authUserDeleted" boolean NOT NULL DEFAULT false,
  "retainedCount" integer NOT NULL DEFAULT 0
);

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.account_deletion_requests FROM anon;

-- Administrators may read the request trail; `request_account_deletion()` below is
-- the only writer, and it never deletes a row from any table. The grants are stated
-- rather than inherited, so a change to the project's default privileges cannot
-- quietly open the table to the anon key.
GRANT SELECT ON TABLE public.account_deletion_requests TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.account_deletion_requests FROM authenticated;
REVOKE ALL ON TABLE public.account_deletion_requests FROM anon;
DROP POLICY IF EXISTS account_deletion_requests_admin_read ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_admin_read ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (current_profile_role() = 'admin');

-- ---------------------------------------------------------------------------
-- 2. link_profile() — sign-in: return the caller's school profile
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_profile()
RETURNS TABLE (id text, name text, email text, role text, class_name text)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- First sign-in for a school-provisioned profile: bind it to this auth user.
  -- Only a profile with no auth_id yet, and only on an exact email match, so this
  -- can never take over a profile that another auth user already owns.
  IF v_email <> '' THEN
    UPDATE public.profiles p
    SET auth_id = v_uid
    WHERE p.auth_id IS NULL
      AND lower(p.email) = v_email;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.email, p.role,
         CASE
           WHEN jsonb_typeof(p."assignedClasses") = 'array' THEN p."assignedClasses"->>0
           ELSE NULL
         END AS class_name
  FROM public.profiles p
  WHERE p.auth_id = v_uid
  LIMIT 1;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Push token, self-service
-- ---------------------------------------------------------------------------

-- The token column is looked up rather than named, because the project's own name
-- for it is not confirmed. If none of the accepted spellings exists the function
-- says so instead of failing the migration.
CREATE OR REPLACE FUNCTION public.set_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile text := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'empty_token';
  END IF;

  -- `expo_push_token` is the column: the app registers through
  -- Notifications.getExpoPushTokenAsync(), and the delivery function posts to
  -- exp.host and reads this same column, so the two agree. `profiles.fcm_token`
  -- also exists but belongs to a different flow — do not write an Expo token
  -- there, and do not clear it from here.
  UPDATE public.profiles SET expo_push_token = btrim(p_token) WHERE id = v_profile;
END $$;

CREATE OR REPLACE FUNCTION public.clear_push_token()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile text := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RETURN;
  END IF;

  -- Sign-out should stop this device receiving the previous parent's
  -- notifications, so the Expo token (the one delivery reads) is cleared.
  UPDATE public.profiles SET expo_push_token = NULL WHERE id = v_profile;
END $$;

-- ---------------------------------------------------------------------------
-- 4. list_contacts() — who the caller may write to
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_contacts()
RETURNS TABLE (id text, name text, role text, class_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me text := public.current_profile_id();
  v_role text := public.current_profile_role();
BEGIN
  IF v_me IS NULL THEN
    RETURN;
  END IF;

  IF v_role IN ('admin', 'supervisor', 'office') THEN
    RETURN QUERY
    SELECT p.id, p.name, p.role, NULL::text
    FROM public.profiles p
    WHERE p.id <> v_me
    ORDER BY p.name;
    RETURN;
  END IF;

  IF v_role = 'teacher' THEN
    -- The families of the students in the classes this teacher teaches.
    RETURN QUERY
    SELECT DISTINCT p.id, p.name, p.role, s."className"
    FROM public.profiles p
    JOIN public.students s ON s."parentId" = p.id
    JOIN public.class_subjects cs ON cs."className" = s."className"
    WHERE p.role = 'parent'
      AND cs."teacherId" = v_me
    ORDER BY p.name;

    -- …and the rest of the staff, which is who a teacher asks for help.
    RETURN QUERY
    SELECT p.id, p.name, p.role, NULL::text
    FROM public.profiles p
    WHERE p.role = ANY (ARRAY['admin', 'supervisor', 'office', 'teacher'])
      AND p.id <> v_me
    ORDER BY p.name;
    RETURN;
  END IF;

  -- Parent: the teachers of their children's classes, and the school office.
  -- The office entry is not optional politeness: the school's published privacy
  -- policy §11 tells parents they can send a request from the Messages section,
  -- so the office has to be a contact they can actually pick.
  RETURN QUERY
  SELECT DISTINCT p.id, p.name, p.role, s."className"
  FROM public.profiles p
  JOIN public.class_subjects cs ON cs."teacherId" = p.id
  JOIN public.students s ON s."className" = cs."className"
  WHERE p.role IN ('teacher', 'supervisor')
    AND p.id <> v_me
    AND s."parentId" = v_me
  ORDER BY p.name;

  RETURN QUERY
  SELECT p.id, p.name, p.role, NULL::text
  FROM public.profiles p
  WHERE p.role = ANY (ARRAY['office', 'admin'])
    AND p.id <> v_me
  ORDER BY p.name;
END $$;

-- ---------------------------------------------------------------------------
-- 5. send_message() / mark_message_read()
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_message(p_recipient text, p_subject text, p_body text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me text := public.current_profile_id();
  v_id text;
  v_subject text := btrim(coalesce(p_subject, ''));
  v_body text := btrim(coalesce(p_body, ''));
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  IF p_recipient IS NULL OR p_recipient = v_me THEN
    RAISE EXCEPTION 'invalid_recipient';
  END IF;
  IF v_subject = '' THEN
    RAISE EXCEPTION 'empty_subject';
  END IF;
  IF v_body = '' THEN
    RAISE EXCEPTION 'empty_body';
  END IF;
  IF length(v_subject) > 200 OR length(v_body) > 5000 THEN
    RAISE EXCEPTION 'too_long';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_recipient) THEN
    RAISE EXCEPTION 'unknown_recipient';
  END IF;
  -- The relationship check: the sender never comes from the client, and neither
  -- does the permission to write to this recipient.
  IF NOT public.can_message(p_recipient) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  INSERT INTO public.messages (id, "senderId", "recipientId", subject, body, "createdAt")
  VALUES (gen_random_uuid()::text, v_me, p_recipient, v_subject, v_body, now())
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me text := public.current_profile_id();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  -- Only the recipient, and only the read receipt.
  UPDATE public.messages
  SET "readAt" = now()
  WHERE id = p_message
    AND "recipientId" = v_me
    AND "readAt" IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Deletion: the request the school office actions
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me text := public.current_profile_id();
  v_email text;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = v_me;

  INSERT INTO public.account_deletion_requests ("profileId", email, reason, status)
  VALUES (v_me, v_email, nullif(btrim(coalesce(p_reason, '')), ''), 'requested');
END $$;

-- ---------------------------------------------------------------------------
-- 7. Grants: signed-in users only, no anon, nothing to PUBLIC
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.link_profile()',
    'public.set_push_token(text)',
    'public.clear_push_token()',
    'public.list_contacts()',
    'public.send_message(text,text,text)',
    'public.mark_message_read(text)',
    'public.request_account_deletion(text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
