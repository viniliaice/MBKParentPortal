/*
# Mastery-based progression + spaced repetition schema

1. Purpose
- Adds per-lesson mastery tracking and Leitner-style spaced repetition to the
  existing learning system. Today `lesson_progress` is overwritten on each
  attempt (upsert), so accuracy history is lost. This migration adds an
  append-only `lesson_attempts` log and extends `lesson_progress` with
  derived mastery + SRS scheduling fields so the app can gate lessons by
  mastery and resurface old skills before they decay.

2. New Tables
- `lesson_attempts` (append-only attempt log)
  - id (uuid PK)
  - parent_id (uuid, references profiles) — the parent/owner
  - lesson_id (text) — which lesson was attempted
  - attempt_number (int) — 1-based, increments per parent+lesson
  - correct_count (int) — correct answers this attempt
  - total_activities (int) — total questions this attempt
  - accuracy_pct (int) — round(correct/total*100)
  - activity_results (jsonb) — per-question results
  - completed_at (timestamptz) — when the attempt finished
  - Unique constraint on (parent_id, lesson_id, attempt_number)

3. Modified Tables
- `lesson_progress` (the summary row, still upserted)
  - mastery_level (int, default 0) — 0-100, computed from recent attempts
    (last 3 weighted, recent > old). 0 until first attempt.
  - attempts_count (int, default 0) — how many attempts logged for this lesson
  - last_attempt_at (timestamptz, nullable) — when the last attempt finished
  - srs_due_at (date, nullable) — when this lesson is due for review
  - srs_correct_streak (int, default 0) — consecutive correct reviews (Leitner box)

4. Security
- RLS enabled on `lesson_attempts`, same anon+authenticated full CRUD pattern
  as the rest of the app (the app uses custom profile auth with the anon key;
  application code scopes by parent_id). Four separate policies (select/insert/
  update/delete), no FOR ALL.
- No changes to existing table policies; only columns added.

5. Notes
- Existing `lesson_progress` rows get mastery_level=0, attempts_count=0,
  srs_correct_streak=0, srs_due_at/last_attempt_at=null. They populate on the
  next attempt; no backfill is performed (old `activity_results` lack the
  attempt boundaries needed for accurate mastery).
- No destructive operations; only additive ALTER TABLE + new table.
*/

CREATE TABLE IF NOT EXISTS lesson_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  attempt_number integer NOT NULL,
  correct_count integer NOT NULL DEFAULT 0,
  total_activities integer NOT NULL DEFAULT 0,
  accuracy_pct integer NOT NULL DEFAULT 0,
  activity_results jsonb,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_id, lesson_id, attempt_number)
);
ALTER TABLE lesson_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_lesson_attempts" ON lesson_attempts;
CREATE POLICY "anon_select_lesson_attempts" ON lesson_attempts FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_lesson_attempts" ON lesson_attempts;
CREATE POLICY "anon_insert_lesson_attempts" ON lesson_attempts FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_lesson_attempts" ON lesson_attempts;
CREATE POLICY "anon_update_lesson_attempts" ON lesson_attempts FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_lesson_attempts" ON lesson_attempts;
CREATE POLICY "anon_delete_lesson_attempts" ON lesson_attempts FOR DELETE
  TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lesson_progress' AND column_name = 'mastery_level') THEN
    ALTER TABLE lesson_progress ADD COLUMN mastery_level integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lesson_progress' AND column_name = 'attempts_count') THEN
    ALTER TABLE lesson_progress ADD COLUMN attempts_count integer NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lesson_progress' AND column_name = 'last_attempt_at') THEN
    ALTER TABLE lesson_progress ADD COLUMN last_attempt_at timestamptz;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lesson_progress' AND column_name = 'srs_due_at') THEN
    ALTER TABLE lesson_progress ADD COLUMN srs_due_at date;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'lesson_progress' AND column_name = 'srs_correct_streak') THEN
    ALTER TABLE lesson_progress ADD COLUMN srs_correct_streak integer NOT NULL DEFAULT 0;
  END IF;
END $$;
