-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Account deletion — separate the account from the school record

1. The two things this migration must keep apart
- *Account data* (the parent's login, name, contact details, private messages,
  learning progress, device token) is the family's, and deleting the account
  must really delete it.
- *School records* (the child's enrolment, attendance, homework and marks) are
  the school's, and are kept under its record-keeping duty. They must survive
  the account, and must stop being linked to it.
- The historical schema did the opposite: `students."parentId"` and
  `exams."parentId"` were `ON DELETE CASCADE`, so deleting a parent profile
  silently destroyed the child's enrolment row and, through it, attendance,
  homework and every exam mark. That hazard is removed here: both foreign keys
  become ON DELETE SET NULL, and the deletion function de-links the rows
  explicitly before the profile goes.

2. Flow implemented
- `delete_my_account()` (in-app "Delete my account now"):
    1. snapshot the child's school records into `retained_academic_records`
       (school-readable audit trail, so nothing is lost even if a later step is
       rolled back by hand);
    2. delete the family's own data: messages in both directions, lesson
       progress, lesson attempts, gamification, quiz attempts;
    3. de-link the school records: exams lose the parent link, students keep
       their rows with "parentId" = NULL and "retentionStatus" = 'retained';
    4. delete the profile row (which is what the app's session resolves to);
    5. delete the Supabase Auth user if the database role is allowed to; the
       outcome is recorded as `authUserDeleted` either way, so a school
       administrator can finish the job from the dashboard when it is not.
    The last remaining admin cannot delete itself this way (a school must not be
    able to lock itself out).
- `request_account_deletion(reason)` records a request for the school to action
  instead (for families who would rather have the office confirm first). The
  request is visible to admins only; it never grants a client access to the
  records themselves.

3. What families are told (must match app/account.tsx and docs/privacy-policy.md)
- Deleted with the account: login and password, name/email/phone, messages,
  learning progress and XP, quiz attempts, push token.
- Kept by the school, no longer linked to the account: enrolment row,
  attendance, homework, exam marks. A family can ask the school to correct or
  remove those records; that decision belongs to the school, not to the app.

4. Retention tables
- `account_deletion_requests`: audit row per request/deletion (reason, status,
  who, when, whether the auth user was removed).
- `retained_academic_records`: the per-child snapshot described above.
- Both are readable by admins only and writable by nobody through the API (the
  functions above are SECURITY DEFINER; direct inserts are rejected).

5. Verification
- tests/db/account-deletion.test.mjs asserts every statement above against a
  disposable PGlite database built from the real migrations, including that
  another family's records are untouched.
*/

-- ---------------------------------------------------------------------------
-- 1. School records stop cascading away, and say when they are retained
-- ---------------------------------------------------------------------------

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS "retentionStatus" text NOT NULL DEFAULT 'active';

COMMENT ON COLUMN public.students."retentionStatus" IS
  'active = linked to a family account; retained = school record kept after the family account was deleted.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_retention_status_check') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_retention_status_check
      CHECK ("retentionStatus" IN ('active', 'retained'));
  END IF;
END $$;

-- A child's school record must survive the family account. The historical
-- constraint was ON DELETE CASCADE, which deleted the child's enrolment, and
-- with it attendance/homework/exams.
ALTER TABLE public.students ALTER COLUMN "parentId" DROP NOT NULL;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND rel.relname = 'students'
      AND frel.relname = 'profiles'
      AND con.conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid = rel.oid AND attname = 'parentId')
      ]::smallint[]
  LOOP
    EXECUTE format('ALTER TABLE public.students DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'account deletion: dropped cascading FK % on students', r.conname;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_parent_fkey') THEN
    ALTER TABLE public.students
      ADD CONSTRAINT students_parent_fkey
      FOREIGN KEY ("parentId") REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_class frel ON frel.oid = con.confrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND rel.relname = 'exams'
      AND frel.relname = 'profiles'
  LOOP
    EXECUTE format('ALTER TABLE public.exams DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'account deletion: dropped cascading FK % on exams', r.conname;
  END LOOP;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'exams_parent_fkey') THEN
    ALTER TABLE public.exams
      ADD CONSTRAINT exams_parent_fkey
      FOREIGN KEY ("parentId") REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Retention tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" uuid,
  email text,
  name text,
  role text,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  "requestedAt" timestamptz NOT NULL DEFAULT now(),
  "completedAt" timestamptz,
  "authUserDeleted" boolean NOT NULL DEFAULT false,
  "recordsRetained" integer NOT NULL DEFAULT 0
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'account_deletion_requests_status_check') THEN
    ALTER TABLE public.account_deletion_requests
      ADD CONSTRAINT account_deletion_requests_status_check
      CHECK (status IN ('pending', 'processing', 'completed', 'declined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS account_deletion_requests_profile_idx
  ON public.account_deletion_requests ("profileId");

CREATE TABLE IF NOT EXISTS public.retained_academic_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "profileId" uuid,
  "studentId" uuid,
  "studentName" text,
  "className" text,
  exams jsonb NOT NULL DEFAULT '[]'::jsonb,
  attendance jsonb NOT NULL DEFAULT '[]'::jsonb,
  homework jsonb NOT NULL DEFAULT '[]'::jsonb,
  "reason" text NOT NULL DEFAULT 'account_deletion',
  "retainedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retained_academic_records_student_idx
  ON public.retained_academic_records ("studentId");

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retained_academic_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_deletion_requests_admin ON public.account_deletion_requests;
CREATE POLICY account_deletion_requests_admin ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS retained_academic_records_admin ON public.retained_academic_records;
CREATE POLICY retained_academic_records_admin ON public.retained_academic_records
  FOR SELECT TO authenticated
  USING (public.is_admin());

REVOKE ALL ON TABLE public.account_deletion_requests FROM anon;
REVOKE ALL ON TABLE public.retained_academic_records FROM anon;
GRANT SELECT ON TABLE public.account_deletion_requests TO authenticated;
GRANT SELECT ON TABLE public.retained_academic_records TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. The destructive flow
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me public.profiles;
  v_request uuid;
  v_retained integer := 0;
  v_auth_deleted boolean := false;
  v_admins integer;
BEGIN
  SELECT * INTO v_me FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  -- The school must not be able to lock itself out of its own data.
  IF v_me.role = 'admin' THEN
    SELECT count(*) INTO v_admins FROM public.profiles p WHERE p.role = 'admin';
    IF v_admins <= 1 THEN
      RAISE EXCEPTION 'last_admin';
    END IF;
  END IF;

  -- 1. Snapshot the school records before anything is unlinked, so the school
  --    keeps an auditable copy of what it retained and why.
  INSERT INTO public.retained_academic_records (
    "profileId", "studentId", "studentName", "className", exams, attendance, homework, reason
  )
  SELECT
    v_me.id,
    s.id,
    s.name,
    s."className",
    COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM public.exams e WHERE e."studentId" = s.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(a)) FROM public.attendance a WHERE a."studentId" = s.id), '[]'::jsonb),
    COALESCE((SELECT jsonb_agg(to_jsonb(h)) FROM public.homework h WHERE h."studentId" = s.id), '[]'::jsonb),
    'account_deletion'
  FROM public.students s
  WHERE s."parentId" = v_me.id;

  GET DIAGNOSTICS v_retained = ROW_COUNT;

  -- 2. The family's own data goes.
  DELETE FROM public.messages
  WHERE "senderId" = v_me.id::text OR "recipientId" = v_me.id::text;

  DELETE FROM public.lesson_attempts WHERE parent_id = v_me.id;
  DELETE FROM public.lesson_progress WHERE parent_id = v_me.id;
  DELETE FROM public.gamification WHERE parent_id = v_me.id;
  DELETE FROM public.quiz_attempts WHERE "parentId" = v_me.id;

  -- 3. The school records stay, without the family link.
  UPDATE public.exams SET "parentId" = NULL WHERE "parentId" = v_me.id;
  UPDATE public.students
  SET "parentId" = NULL, "retentionStatus" = 'retained'
  WHERE "parentId" = v_me.id;

  -- 4. Record the request, then remove the profile itself.
  INSERT INTO public.account_deletion_requests ("profileId", email, name, role, status, "recordsRetained")
  VALUES (v_me.id, v_me.email, v_me.name, v_me.role, 'processing', v_retained)
  RETURNING id INTO v_request;

  DELETE FROM public.profiles WHERE id = v_me.id;

  -- 5. Remove the login as well. The function runs as the migration owner; on a
  --    Supabase project that normally may delete from auth.users. When it may
  --    not (or the Auth schema is not reachable), the data deletion still
  --    stands and the flag tells a school administrator to finish it in the
  --    dashboard.
  BEGIN
    EXECUTE 'DELETE FROM auth.users WHERE id = ' || quote_literal(auth.uid()::text);
    v_auth_deleted := true;
  EXCEPTION
    WHEN insufficient_privilege THEN
      v_auth_deleted := false;
    WHEN undefined_table OR invalid_schema_name THEN
      v_auth_deleted := false;
    WHEN OTHERS THEN
      v_auth_deleted := false;
  END;

  UPDATE public.account_deletion_requests
  SET status = 'completed',
      "completedAt" = now(),
      "authUserDeleted" = v_auth_deleted
  WHERE id = v_request;
END $$;

CREATE OR REPLACE FUNCTION public.request_account_deletion(p_reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_me public.profiles;
  v_id uuid;
BEGIN
  SELECT * INTO v_me FROM public.profiles p WHERE p.auth_id = auth.uid() LIMIT 1;
  IF v_me.id IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  INSERT INTO public.account_deletion_requests ("profileId", email, name, role, reason, status)
  VALUES (
    v_me.id,
    v_me.email,
    v_me.name,
    v_me.role,
    nullif(btrim(coalesce(p_reason, '')), ''),
    'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END $$;

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.delete_my_account()',
    'public.request_account_deletion(text)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
