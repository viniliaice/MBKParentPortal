-- ============================================================================
-- NOT VERIFIED AGAINST PRODUCTION. This migration was written against the schema
-- this repository recreates (uuid ids, no pre-existing policies). Production is
-- different: text primary keys, quoted camelCase columns already in place, live
-- roles supervisor/office, and RLS policies that already exist. Review
-- docs/schema.md before running this anywhere but a disposable database.
-- ============================================================================
/*
# Schema reconciliation — make the database match the application's columns

1. The problem this migration fixes
- The two historical migrations that created the application tables declare the
  camelCase columns *unquoted*:

      CREATE TABLE students (
        ...
        className text NOT NULL,      -- PostgreSQL folds this to "classname"
        parentId  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        ...

- PostgreSQL folds unquoted identifiers to lower case, so the columns that
  actually exist are `classname`, `parentid`, `studentid`, `createdat`,
  `readat`, `examtype`, `duedate`, ... The application (lib/supabase.ts and
  every screen) asks for `className`, `parentId`, `studentId`, `createdAt` —
  which is why those queries fail with 42703 "column does not exist" against
  the deployed database. The audit's quiz finding is the same bug: the
  unversioned quiz file is folded the same way.
- The fix is a rename, not a second column: exactly one column per concept, the
  data, the indexes and the foreign keys all follow, and the application's
  spelling becomes the database's spelling.

2. Scope
- Renames are performed only when the folded column exists and the canonical
  column does not, so the migration is safe to re-run and cannot destroy a
  correctly named column.
- Covered here: students, exams, attendance, homework, announcements, messages.
  The quiz tables (quizzes, questions, quiz_questions, quiz_attempts) are
  reconciled by 20260923090200_quiz_schema.sql, which runs next.
- Not touched: profiles (its columns are already the ones the app uses, e.g.
  `created_at`), and lesson_progress / lesson_attempts / gamification (the app
  reads those in snake_case, which is what they have).
- Nothing is dropped, no data is copied between columns, and no table is
  recreated.

3. Security note
- Renaming keeps every constraint, trigger and index attached, so the cascading
  `students."parentId" -> profiles(id) ON DELETE CASCADE` still exists after this
  migration. That hazard is removed deliberately in
  20260923092000_account_deletion.sql (ON DELETE SET NULL + retention), not by
  accident here.

4. Rollback
- The reverse statement for each table is the same RENAME with the arguments
  swapped; it is intentionally not automated, because a rollback after new rows
  have been written would need the same care.
*/

-- ---------------------------------------------------------------------------
-- 1. Folded column names -> the names the application uses
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      -- table,          folded column, canonical column
      ('students',      'classname',   'className'),
      ('students',      'parentid',    'parentId'),
      ('students',      'createdat',   'createdAt'),

      ('exams',         'studentid',   'studentId'),
      ('exams',         'parentid',    'parentId'),
      ('exams',         'examtype',    'examType'),
      ('exams',         'createdat',   'createdAt'),
      ('exams',         'teacherid',   'teacherId'),
      ('exams',         'termid',      'termId'),
      ('exams',         'subjectid',   'subjectId'),

      ('attendance',    'studentid',   'studentId'),

      ('homework',      'studentid',   'studentId'),
      ('homework',      'duedate',     'dueDate'),
      ('homework',      'createdat',   'createdAt'),

      ('announcements', 'classname',   'className'),
      ('announcements', 'createdby',   'createdBy'),
      ('announcements', 'createdat',   'createdAt'),

      ('messages',      'senderid',    'senderId'),
      ('messages',      'recipientid', 'recipientId'),
      ('messages',      'readat',      'readAt'),
      ('messages',      'createdat',   'createdAt')
    ) AS t(tbl, folded, canonical)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.folded
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tbl AND column_name = r.canonical
    ) THEN
      EXECUTE format('ALTER TABLE public.%I RENAME COLUMN %I TO %I', r.tbl, r.folded, r.canonical);
      RAISE NOTICE 'schema reconciliation: renamed %.% to %', r.tbl, r.folded, r.canonical;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. The parent link must stop destroying school records
--    (the FK itself is replaced in 20260923092000_account_deletion.sql, which
--    is where the retention decision is documented; here the column only has to
--    exist, which the rename above guarantees).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS students_parent_idx
  ON public.students ("parentId");
CREATE INDEX IF NOT EXISTS students_class_idx
  ON public.students ("className");
CREATE INDEX IF NOT EXISTS exams_student_idx
  ON public.exams ("studentId");
CREATE INDEX IF NOT EXISTS attendance_student_idx
  ON public.attendance ("studentId");
CREATE INDEX IF NOT EXISTS homework_student_idx
  ON public.homework ("studentId");
CREATE INDEX IF NOT EXISTS announcements_class_idx
  ON public.announcements ("className");
CREATE INDEX IF NOT EXISTS messages_recipient_idx
  ON public.messages ("recipientId", "readAt");
CREATE INDEX IF NOT EXISTS messages_sender_idx
  ON public.messages ("senderId");

-- ---------------------------------------------------------------------------
-- 3. A note for whoever reads the schema next
--    (column comments are the cheapest place to record why the names look the
--    way they do, and they show up in the Supabase dashboard).
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.students."parentId" IS
  'profiles.id of the family account. Renamed from the folded "parentid" column; becomes NULL when the family account is deleted (see 20260923092000_account_deletion.sql).';
COMMENT ON COLUMN public.messages."senderId" IS
  'profiles.id of the sender, stored as text (historical schema). Always written server-side by send_message(); never supplied by a client.';
COMMENT ON COLUMN public.messages."recipientId" IS
  'profiles.id of the recipient, stored as text. Only the recipient may mark a message read.';
