-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Messaging and identity RPCs — the only way a client writes these rows

1. Why RPCs instead of table policies
- The messaging screen used to insert a row into `messages` with
  `senderId: 'parent1'`, `senderName: 'You'`, `recipientId: 'teacher1'` — demo
  values that do not exist in the school's data (and, with `messages."senderId"`
  typed as text, they were accepted). Identity must come from the session, not
  from the request body, so the write path is:
    * the client sends only recipient + subject + body,
    * send_message() derives the sender, the sender's name/role and the
      recipient's name/role on the server,
    * the relationship (parent <-> teacher of that parent's class) is re-checked
      inside the function, for every message, regardless of what the client
      believes.

2. Functions (all SECURITY DEFINER, empty search_path, authenticated only)
- link_profile()            sign-in bootstrap: links the verified email to the
                            school-provisioned profile on first use and returns
                            the caller's own profile row (id/name/email/role/class).
- set_push_token(text)      stores the device token on the caller's own row.
- clear_push_token()        removes it on sign-out.
- list_contacts()           who the caller is allowed to write to, for the
                            compose screen. Parents get the teachers of their
                            children's classes; teachers get the parents in their
                            class; admins get everybody.
- send_message(...)         validates and stores the message, returns its id.
- mark_message_read(uuid)   only the recipient can mark a message read.

3. Error codes (stable, translated to user-facing text in the app)
- not_authenticated, no_profile, recipient_required, empty_message,
  subject_too_long, body_too_long, recipient_not_authorized, empty_token.

4. What this does not do
- It does not add policies to `messages`: with no INSERT/UPDATE policy, a direct
  PostgREST write is rejected even if somebody replays the RPC's SQL by hand.
- It does not let an admin impersonate a sender: an admin may write to anyone,
  but the row is still stamped with the admin's own identity.
*/

-- ---------------------------------------------------------------------------
-- 1. Columns the RPCs store (display names captured server-side)
-- ---------------------------------------------------------------------------

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS "senderName" text,
  ADD COLUMN IF NOT EXISTS "recipientName" text,
  ADD COLUMN IF NOT EXISTS "senderRole" text,
  ADD COLUMN IF NOT EXISTS "recipientRole" text;

COMMENT ON COLUMN public.messages."senderName" IS
  'Name captured by send_message() at send time; never supplied by a client.';

-- ---------------------------------------------------------------------------
-- 2. Sign-in bootstrap
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.link_profile()
RETURNS TABLE (id uuid, name text, email text, role text, class_name text)
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
  -- Only an unlinked profile is claimed, and the email match is exact, so this
  -- cannot steal a profile that another auth user already owns.
  IF v_email <> '' THEN
    UPDATE public.profiles p
    SET auth_id = v_uid
    WHERE p.auth_id IS NULL
      AND lower(p.email) = v_email;
  END IF;

  RETURN QUERY
  SELECT p.id, p.name, p.email, p.role, p.class_name
  FROM public.profiles p
  WHERE p.auth_id = v_uid
  LIMIT 1;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Push token, self-service
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_push_token(p_token text)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile uuid := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'empty_token';
  END IF;

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
  v_profile uuid := public.current_profile_id();
BEGIN
  IF v_profile IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.profiles SET expo_push_token = NULL WHERE id = v_profile;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Contacts the caller may write to
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.list_contacts()
RETURNS TABLE (id uuid, name text, role text, class_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me public.profiles;
BEGIN
  SELECT * INTO v_me FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1;

  IF v_me.id IS NULL THEN
    RETURN;
  END IF;

  IF v_me.role IN ('teacher', 'supervisor') THEN
    RETURN QUERY
    SELECT DISTINCT p.id, p.name, p.role, p.class_name
    FROM public.profiles p
    JOIN public.students s ON s."parentId" = p.id
    WHERE p.role = 'parent'
      AND v_me.class_name IS NOT NULL
      AND s."className" = v_me.class_name
    ORDER BY p.name;
    RETURN;
  END IF;

  IF v_me.role = 'admin' THEN
    RETURN QUERY
    SELECT p.id, p.name, p.role, p.class_name
    FROM public.profiles p
    WHERE p.id <> v_me.id
    ORDER BY p.name;
    RETURN;
  END IF;

  -- Parent: the teachers responsible for their children's classes.
  RETURN QUERY
  SELECT DISTINCT p.id, p.name, p.role, p.class_name
  FROM public.profiles p
  JOIN public.students s ON s."className" = p.class_name
  WHERE p.role IN ('teacher', 'supervisor')
    AND p.id <> v_me.id
    AND s."parentId" = v_me.id
  ORDER BY p.name;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Sending
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.send_message(p_recipient uuid, p_subject text, p_body text)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me public.profiles;
  v_recipient public.profiles;
  v_authorized boolean := false;
  v_clean_subject text := btrim(coalesce(p_subject, ''));
  v_clean_body text := btrim(coalesce(p_body, ''));
  v_id uuid;
BEGIN
  SELECT * INTO v_me FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  IF p_recipient IS NULL THEN
    RAISE EXCEPTION 'recipient_required';
  END IF;

  IF v_clean_subject = '' OR v_clean_body = '' THEN
    RAISE EXCEPTION 'empty_message';
  END IF;

  IF length(v_clean_subject) > 200 THEN
    RAISE EXCEPTION 'subject_too_long';
  END IF;

  IF length(v_clean_body) > 5000 THEN
    RAISE EXCEPTION 'body_too_long';
  END IF;

  SELECT * INTO v_recipient FROM public.profiles p WHERE p.id = p_recipient LIMIT 1;
  IF v_recipient.id IS NULL THEN
    RAISE EXCEPTION 'recipient_not_authorized';
  END IF;

  -- The relationship is re-derived here, exactly as in list_contacts().
  IF v_me.role = 'admin' THEN
    v_authorized := v_recipient.id <> v_me.id;
  ELSIF v_me.role IN ('teacher', 'supervisor') THEN
    v_authorized := v_recipient.role = 'parent'
      AND v_me.class_name IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s."parentId" = v_recipient.id AND s."className" = v_me.class_name
      );
  ELSIF v_me.role = 'parent' THEN
    v_authorized := v_recipient.role IN ('teacher', 'supervisor')
      AND EXISTS (
        SELECT 1 FROM public.students s
        WHERE s."parentId" = v_me.id AND s."className" = v_recipient.class_name
      );
  END IF;

  IF NOT v_authorized THEN
    RAISE EXCEPTION 'recipient_not_authorized';
  END IF;

  INSERT INTO public.messages (
    "senderId", "recipientId", "senderName", "recipientName",
    "senderRole", "recipientRole", subject, body, "readAt"
  )
  VALUES (
    v_me.id::text, v_recipient.id::text, v_me.name, v_recipient.name,
    v_me.role, v_recipient.role, v_clean_subject, v_clean_body, NULL
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Reading state
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.mark_message_read(p_message uuid)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me text := public.current_profile_id_text();
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Only the recipient marks a message read; a sender cannot fake the state of
  -- somebody else's inbox, and RLS keeps the row invisible to third parties.
  UPDATE public.messages
  SET "readAt" = now()
  WHERE id = p_message
    AND "recipientId" = v_me
    AND "readAt" IS NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 7. Lock the RPCs down
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
    'public.send_message(uuid, text, text)',
    'public.mark_message_read(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
