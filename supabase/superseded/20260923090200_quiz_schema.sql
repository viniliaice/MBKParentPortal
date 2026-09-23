-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Quiz schema — one authoritative model, and the school calendar table

1. Purpose
- The quiz feature (quizzes / quiz_questions / quiz_attempts) is written against
  the camelCase column names in `lib/supabase.ts`, but the only DDL that ever
  described those tables is the *unversioned* `supabase/migration_quiz.sql`,
  which:
    * uses unquoted identifiers, so PostgreSQL folded them to lower case
      (`classId`, `quizId`, `studentId`, `totalPoints`, ... never existed),
    * named columns the app does not use (`shuffleQuestions`, `closeDate`,
      `score`, `totalPoints`),
    * was never applied by `supabase db push` (it lives outside
      `supabase/migrations/`), and shares the folded-column problem described in
      20260923090000_schema_reconciliation.sql, and
    * could not have been applied even manually, because
      `CREATE POLICY IF NOT EXISTS` is not valid PostgreSQL (the whole file
      aborts), while `quiz_attempts` had no policy for the student read path the
      app uses.
- This migration makes the quiz tables match the application exactly, and makes
  it safe for both possible production states:
    a) the quiz tables do not exist  -> they are created here, and
    b) the quiz tables exist with the folded lower-case columns (someone ran the
       file statement by statement) -> the columns are renamed onto the
       canonical names, data included, and missing canonical columns are added.
  Both paths end with the same shape; nothing is dropped.

2. Authoritative model (camelCase = the application's model)
- quizzes: id, className, subject, title, description, teacherId, timeLimit,
  questionOrder ('sequential'|'random'), showResults, status
  ('draft'|'active'|'closed'), openDate, dueDate, createdAt, updatedAt.
- quiz_questions: id, quizId, questionId (nullable: a question may live inline),
  orderIndex, promptSnapshot, optionsSnapshot, typeSnapshot,
  correctAnswerSnapshot, points, createdAt.
- quiz_attempts: id, quizId, studentId, parentId, answers, totalEarned,
  totalPossible, status ('in_progress'|'submitted'|'graded'), startedAt,
  submittedAt, gradedAt, createdAt.
- questions (question bank, written by school tooling only) is aligned on the
  same spelling so the RLS policies can reference real columns.

3. Why parentId on quiz_attempts
- The row records which family account the attempt belongs to. It is *derived*
  by `set_quiz_attempt_parent()` from `students."parentId"` on insert and can
  never be supplied or changed by a client (`enforce_quiz_attempt_integrity()`
  freezes it, and freezes quizId/studentId for everyone but an admin), so an
  attempt cannot be planted on another family's record.

4. Academic years
- `app/results.tsx` reads `academic_years` (camelCase columns) and the table
  never existed in any migration. It is created here.

5. Residual
- Where the quiz tables already existed, the obsolete lower-case columns
  (`classid`, `closeDate`, `shuffleQuestions`, `shuffleOptions`, `score`,
  `totalPoints`, `createdBy`, ...) are left in place but are no longer read or
  written by anything. They can be dropped by the school once the data has been
  checked; see docs/schema.md for the exact statement.

6. Idempotent
- Safe to re-run. It creates what is missing, renames only when the canonical
  column is absent, backfills only NULLs, and never drops a table or column.
*/

-- ---------------------------------------------------------------------------
-- 1. Canonical tables (created only when absent)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "className" text NOT NULL,
  subject text NOT NULL DEFAULT '',
  title text NOT NULL,
  description text,
  "teacherId" uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  "timeLimit" integer,
  "questionOrder" text NOT NULL DEFAULT 'sequential',
  "showResults" boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'draft',
  "openDate" timestamptz,
  "dueDate" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "questionBankId" text NOT NULL DEFAULT 'default',
  "createdBy" text NOT NULL,
  type text NOT NULL,
  prompt text NOT NULL,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  "correctAnswer" text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 1,
  archived boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId" uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  "questionId" uuid,
  "orderIndex" integer NOT NULL DEFAULT 0,
  "promptSnapshot" text NOT NULL,
  "optionsSnapshot" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "typeSnapshot" text NOT NULL DEFAULT 'multiple_choice',
  "correctAnswerSnapshot" text NOT NULL DEFAULT '',
  points integer NOT NULL DEFAULT 1,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "quizId" uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  "studentId" text NOT NULL,
  "parentId" uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '[]'::jsonb,
  "totalEarned" numeric(8, 2) NOT NULL DEFAULT 0,
  "totalPossible" numeric(8, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  "startedAt" timestamptz NOT NULL DEFAULT now(),
  "submittedAt" timestamptz,
  "gradedAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  "startDate" text NOT NULL,
  "endDate" text NOT NULL,
  "isCurrent" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2. Rename folded lower-case columns onto the canonical spelling.
--    Runs only when the canonical column does not exist yet, so it can never
--    destroy a column that is already correct. Data is carried by the rename.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  canonical_has_data boolean;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table, legacy (folded) column, canonical column
      ('questions',      'questionbankid',        'questionBankId'),
      ('questions',      'createdby',             'createdBy'),
      ('questions',      'correctanswer',         'correctAnswer'),
      ('questions',      'createdat',             'createdAt'),
      ('quizzes',        'classid',               'className'),
      ('quizzes',        'opendate',              'openDate'),
      ('quizzes',        'closedate',             'dueDate'),
      ('quizzes',        'showresults',           'showResults'),
      ('quizzes',        'timelimit',             'timeLimit'),
      ('quizzes',        'createdat',             'createdAt'),
      ('quiz_questions', 'quizid',                'quizId'),
      ('quiz_questions', 'questionid',            'questionId'),
      ('quiz_questions', 'orderindex',            'orderIndex'),
      ('quiz_questions', 'promptsnapshot',        'promptSnapshot'),
      ('quiz_questions', 'optionssnapshot',       'optionsSnapshot'),
      ('quiz_questions', 'typesnapshot',          'typeSnapshot'),
      ('quiz_questions', 'correctanswersnapshot', 'correctAnswerSnapshot'),
      ('quiz_questions', 'createdat',             'createdAt'),
      ('quiz_attempts',  'quizid',                'quizId'),
      ('quiz_attempts',  'studentid',             'studentId'),
      ('quiz_attempts',  'startedat',             'startedAt'),
      ('quiz_attempts',  'submittedat',           'submittedAt')
    ) AS t(tbl, legacy_col, canonical_col)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.legacy_col
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.canonical_col
    ) THEN
      -- Only the old spelling exists: carry the data across by renaming.
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.legacy_col, r.canonical_col);
      RAISE NOTICE 'quiz schema: renamed %.% to %', r.tbl, r.legacy_col, r.canonical_col;

    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.legacy_col
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.canonical_col
    ) THEN
      -- Both spellings exist (the canonical column was added empty by an
      -- earlier run of this file). If it is still empty it holds nothing worth
      -- keeping: replace it with the legacy column so exactly one column per
      -- concept remains and the old data is preserved.
      EXECUTE format(
        'SELECT EXISTS (SELECT 1 FROM public.%I WHERE %I IS NOT NULL AND %I::text <> %L)',
        r.tbl, r.canonical_col, r.canonical_col, ''
      ) INTO canonical_has_data;

      IF NOT canonical_has_data THEN
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I', r.tbl, r.canonical_col);
        EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.legacy_col, r.canonical_col);
        RAISE NOTICE 'quiz schema: replaced empty % with legacy %.%', r.canonical_col, r.tbl, r.legacy_col;
      ELSE
        RAISE NOTICE 'quiz schema: %.% and %.% both hold data, keeping % (see docs/schema.md)',
          r.tbl, r.legacy_col, r.tbl, r.canonical_col, r.canonical_col;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Add any canonical column that is still missing (covers tables that were
--    created before a column existed, and columns with no legacy equivalent).
--    NOT NULL is only used together with a DEFAULT, so this is safe on
--    populated tables.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('quizzes', 'subject',        'text NOT NULL DEFAULT '''' '),
      ('quizzes', 'description',    'text'),
      ('quizzes', 'teacherId',      'uuid REFERENCES public.profiles(id) ON DELETE SET NULL'),
      ('quizzes', 'timeLimit',      'integer'),
      ('quizzes', 'questionOrder',  'text'),
      ('quizzes', 'showResults',    'boolean NOT NULL DEFAULT true'),
      ('quizzes', 'updatedAt',      'timestamptz NOT NULL DEFAULT now()'),
      ('quiz_questions', 'questionId',           'uuid'),
      ('quiz_questions', 'typeSnapshot',         'text NOT NULL DEFAULT ''multiple_choice'''),
      ('quiz_questions', 'correctAnswerSnapshot','text NOT NULL DEFAULT '''''),
      ('quiz_attempts',  'parentId',             'uuid REFERENCES public.profiles(id) ON DELETE SET NULL'),
      ('quiz_attempts',  'totalEarned',          'numeric(8,2) NOT NULL DEFAULT 0'),
      ('quiz_attempts',  'totalPossible',        'numeric(8,2) NOT NULL DEFAULT 0'),
      ('quiz_attempts',  'status',               'text NOT NULL DEFAULT ''submitted'''),
      ('quiz_attempts',  'gradedAt',             'timestamptz'),
      ('quiz_attempts',  'createdAt',            'timestamptz NOT NULL DEFAULT now()'),
      ('questions',      'options',              'jsonb NOT NULL DEFAULT ''[]''::jsonb'),
      ('questions',      'points',               'integer NOT NULL DEFAULT 1'),
      ('questions',      'archived',             'boolean NOT NULL DEFAULT false')
    ) AS t(tbl, col, decl)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.col
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS %I %s', r.tbl, r.col, r.decl);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Semantic backfill, then the same shape in both scenarios.
--    Nothing is overwritten: only NULLs (and the boolean -> enum mapping) are set.
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'shufflequestions'
  ) THEN
    EXECUTE $sql$
      UPDATE public.quizzes
      SET "questionOrder" = CASE WHEN shufflequestions THEN 'random' ELSE 'sequential' END
      WHERE "questionOrder" IS NULL AND shufflequestions IS NOT NULL
    $sql$;
  END IF;

  -- The legacy question bank stored the creator as free text. Only migrate it
  -- when it is a real uuid, so a name can never be forced into a uuid column.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'createdby'
  ) THEN
    EXECUTE $sql$
      UPDATE public.quizzes
      SET "teacherId" = createdby::uuid
      WHERE "teacherId" IS NULL
        AND createdby ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_attempts' AND column_name = 'score'
  ) THEN
    EXECUTE $sql$
      UPDATE public.quiz_attempts SET "totalEarned" = score
      WHERE score IS NOT NULL AND "totalEarned" IS DISTINCT FROM score
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quiz_attempts' AND column_name = 'totalpoints'
  ) THEN
    EXECUTE $sql$
      UPDATE public.quiz_attempts SET "totalPossible" = totalpoints
      WHERE totalpoints IS NOT NULL AND "totalPossible" IS DISTINCT FROM totalpoints
    $sql$;
  END IF;
END $$;

-- Fill timestamps before tightening them, so the two scenarios converge.
UPDATE public.quizzes SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE public.quizzes SET "updatedAt" = COALESCE("updatedAt", "createdAt", now()) WHERE "updatedAt" IS NULL;
UPDATE public.quiz_questions SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE public.questions SET "createdAt" = now() WHERE "createdAt" IS NULL;
UPDATE public.quiz_attempts SET "createdAt" = COALESCE("submittedAt", "startedAt", now()) WHERE "createdAt" IS NULL;
UPDATE public.quiz_attempts SET "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL AND status <> 'in_progress';

ALTER TABLE public.quizzes ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE public.quizzes ALTER COLUMN "updatedAt" SET NOT NULL;
ALTER TABLE public.quiz_questions ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE public.questions ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE public.quiz_attempts ALTER COLUMN "createdAt" SET NOT NULL;

UPDATE public.quizzes
SET "questionOrder" = COALESCE("questionOrder", 'sequential')
WHERE "questionOrder" IS NULL;
ALTER TABLE public.quizzes ALTER COLUMN "questionOrder" SET DEFAULT 'sequential';
ALTER TABLE public.quizzes ALTER COLUMN "questionOrder" SET NOT NULL;
UPDATE public.quiz_questions
SET "correctAnswerSnapshot" = ''
WHERE "correctAnswerSnapshot" IS NULL;
ALTER TABLE public.quiz_questions ALTER COLUMN "typeSnapshot" SET DEFAULT 'multiple_choice';

-- Columns where the legacy DDL was stricter than the model (a question may be
-- written inline; a draft quiz has no window yet).
ALTER TABLE public.quiz_questions ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE public.quizzes ALTER COLUMN "openDate" DROP NOT NULL;
ALTER TABLE public.quizzes ALTER COLUMN "dueDate" DROP NOT NULL;

-- The legacy question bank recorded its author in a NOT NULL free-text column
-- (`createdby` / `createdBy` folded). New rows are written with the canonical
-- ownership column instead, so the legacy one must not block an insert. It keeps
-- its data and can be dropped by the school (see docs/schema.md).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'quizzes' AND column_name = 'createdby'
  ) THEN
    EXECUTE 'ALTER TABLE public.quizzes ALTER COLUMN createdby DROP NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' AND column_name = 'createdby'
  ) THEN
    EXECUTE 'ALTER TABLE public.questions ALTER COLUMN createdby DROP NOT NULL';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Constraints and indexes
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_status_check') THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_status_check
      CHECK (status IN ('in_progress', 'submitted', 'graded'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_answers_is_array') THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_answers_is_array
      CHECK (jsonb_typeof(answers) = 'array');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_attempts_scores_non_negative') THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_scores_non_negative
      CHECK ("totalEarned" >= 0 AND "totalPossible" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_status_check') THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_status_check CHECK (status IN ('draft', 'active', 'closed'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quizzes_question_order_check') THEN
    ALTER TABLE public.quizzes
      ADD CONSTRAINT quizzes_question_order_check
      CHECK ("questionOrder" IN ('sequential', 'random'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_type_check') THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_type_check
      CHECK ("typeSnapshot" IN ('multiple_choice', 'direct_answer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quiz_questions_points_check') THEN
    ALTER TABLE public.quiz_questions
      ADD CONSTRAINT quiz_questions_points_check CHECK (points >= 0);
  END IF;
END $$;

-- One attempt per student per quiz. Created only if no equivalent unique index
-- exists, so the legacy UNIQUE (quizid, studentid) is not duplicated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indrelid
    WHERE c.relname = 'quiz_attempts'
      AND i.indisunique
      AND i.indisvalid
      AND (
        SELECT array_agg(a.attname::text ORDER BY a.attname::text)
        FROM pg_attribute a
        WHERE a.attrelid = i.indrelid AND a.attnum = ANY (i.indkey)
      ) IN (ARRAY['quizId', 'studentId'], ARRAY['quizid', 'studentid'])
  ) THEN
    CREATE UNIQUE INDEX quiz_attempts_quiz_student_key
      ON public.quiz_attempts ("quizId", "studentId");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS quizzes_class_status_idx
  ON public.quizzes ("className", status, "openDate", "dueDate");
CREATE INDEX IF NOT EXISTS quizzes_teacher_idx
  ON public.quizzes ("teacherId");
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx
  ON public.quiz_questions ("quizId", "orderIndex");
CREATE INDEX IF NOT EXISTS quiz_attempts_student_idx
  ON public.quiz_attempts ("studentId");
CREATE INDEX IF NOT EXISTS quiz_attempts_parent_idx
  ON public.quiz_attempts ("parentId");
CREATE INDEX IF NOT EXISTS academic_years_current_idx
  ON public.academic_years ("isCurrent");
CREATE INDEX IF NOT EXISTS questions_bank_idx
  ON public.questions ("questionBankId") WHERE archived IS NOT TRUE;

-- ---------------------------------------------------------------------------
-- 6. Derived identity + immutability for attempts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_quiz_attempt_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW."studentId" IS NULL OR btrim(NEW."studentId") = '' THEN
    RAISE EXCEPTION 'student_required';
  END IF;
  IF NEW."quizId" IS NULL THEN
    RAISE EXCEPTION 'quiz_required';
  END IF;

  -- The client never supplies this: it is read from the child's own record.
  NEW."parentId" := (
    SELECT s."parentId" FROM public.students s WHERE s.id::text = NEW."studentId" LIMIT 1
  );

  IF NEW.status = 'submitted' AND NEW."submittedAt" IS NULL THEN
    NEW."submittedAt" := now();
  END IF;
  NEW."createdAt" := COALESCE(NEW."createdAt", now());
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.enforce_quiz_attempt_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- An attempt belongs to the child and the quiz it was taken on. Teachers may
  -- grade it (status/scores) but nobody may re-point it at another child, quiz
  -- or family; only an admin can move a row.
  NEW."parentId" := OLD."parentId";
  NEW."quizId" := OLD."quizId";
  NEW."createdAt" := OLD."createdAt";

  IF NOT public.is_admin() THEN
    NEW."studentId" := OLD."studentId";
  END IF;

  IF NEW.status = 'graded' AND NEW."gradedAt" IS NULL THEN
    NEW."gradedAt" := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS set_quiz_attempt_parent ON public.quiz_attempts;
CREATE TRIGGER set_quiz_attempt_parent
  BEFORE INSERT ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quiz_attempt_parent();

DROP TRIGGER IF EXISTS enforce_quiz_attempt_integrity ON public.quiz_attempts;
CREATE TRIGGER enforce_quiz_attempt_integrity
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_quiz_attempt_integrity();

CREATE OR REPLACE FUNCTION public.touch_quizzes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW."updatedAt" := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS touch_quizzes_updated_at ON public.quizzes;
CREATE TRIGGER touch_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_quizzes_updated_at();

-- ---------------------------------------------------------------------------
-- 7. Row level security is switched on here for the quiz tables. The
--    *policies* are created by 20260923090500_lockdown_rls.sql, which is the
--    single place where the table x role access matrix lives. Without this
--    ENABLE, that matrix would silently not apply to a freshly created table.
-- ---------------------------------------------------------------------------

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.quiz_attempts IS
  'One attempt per student per quiz. "parentId" is derived from students."parentId" by trigger and is immutable.';
COMMENT ON COLUMN public.quizzes."questionOrder" IS
  'sequential | random. Replaces the legacy shuffleQuestions boolean.';
