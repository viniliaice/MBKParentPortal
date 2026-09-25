/*
 * PENDING REWRITE — NOT RUN BY `npm test`.
 *
 * These suites were written against the schema this repository recreates
 * (uuid ids, no pre-existing policies). The live database is different: text
 * primary keys, `profiles.id` as a school business id unrelated to auth,
 * roles including supervisor/office, and existing policies. A suite that passes
 * against a schema the school does not have proves nothing, so the file is kept
 * as reference (it documents the behaviour we still want to verify) and is
 * excluded from the suite until it is rewritten on tests/db/fixtures/
 * production-baseline.sql. See tests/db/README.md.
 */
/**
 * Schema contract tests.
 *
 * The app is a PostgREST client: a query that names a column the database does
 * not have fails at runtime, on a phone, in front of a parent. These tests
 * execute every query shape the application issues — as the role that issues it
 * — against a disposable database built from the migrations, so a schema/query
 * mismatch is caught here instead of in production.
 */
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, seed, asAnon, asUser, asOwner, q, attempt, PEOPLE, STUDENTS } from './harness.mjs';

/** Every query below is copied from the app (context/AppContext.tsx and app/**). */
const APP_QUERIES = [
  // AppContext load
  ['from students', `SELECT * FROM public.students WHERE "parentId" = $1`, (u) => [u.id]],
  ['from lesson_progress', `SELECT * FROM public.lesson_progress WHERE parent_id = $1`, (u) => [u.id]],
  ['from gamification', `SELECT * FROM public.gamification WHERE parent_id = $1 LIMIT 1`, (u) => [u.id]],
  ['from lesson_attempts', `SELECT * FROM public.lesson_attempts WHERE parent_id = $1 ORDER BY completed_at ASC`, (u) => [u.id]],
  ['from exams', `SELECT * FROM public.exams WHERE "studentId" = ANY($1::uuid[])`, () => [[STUDENTS.childA.id]]],
  ['from attendance', `SELECT * FROM public.attendance WHERE "studentId" = ANY($1::uuid[])`, () => [[STUDENTS.childA.id]]],
  ['from messages (inbox)', `SELECT * FROM public.messages WHERE "recipientId" = $1`, (u) => [u.id]],
  ['from messages (sent)', `SELECT * FROM public.messages WHERE "senderId" = $1`, (u) => [u.id]],
  ['from announcements', `SELECT * FROM public.announcements`, () => []],
  ['from homework', `SELECT * FROM public.homework WHERE "studentId" = ANY($1::uuid[])`, () => [[STUDENTS.childA.id]]],
  // results screen
  ['from academic_years', `SELECT * FROM public.academic_years ORDER BY "startDate" DESC`, () => []],
  // quiz list (app/quizzes/index.tsx)
  [
    'quizzes for a class window',
    `SELECT * FROM public.quizzes WHERE "className" = $1 AND status = 'active' AND "openDate" <= $2 AND "dueDate" >= $2`,
    () => ['Grade 4A', new Date().toISOString()],
  ],
  ['quiz question count', `SELECT "quizId" FROM public.quiz_questions WHERE "quizId" = ANY($1::uuid[])`, () => [[STUDENTS.childA.id]]],
  ['attempts for a student', `SELECT "quizId" FROM public.quiz_attempts WHERE "studentId" = $1`, () => [STUDENTS.childA.id]],
  // take quiz (app/quizzes/[id].tsx)
  ['one quiz by id', `SELECT * FROM public.quizzes WHERE id = $1 LIMIT 1`, () => [STUDENTS.childA.id]],
  ['questions by order', `SELECT * FROM public.quiz_questions WHERE "quizId" = $1 ORDER BY "orderIndex" ASC`, () => [STUDENTS.childA.id]],
  // results + history
  ['attempt by id', `SELECT * FROM public.quiz_attempts WHERE id = $1 LIMIT 1`, () => [STUDENTS.childA.id]],
  [
    'history by student',
    `SELECT * FROM public.quiz_attempts WHERE "studentId" = $1 ORDER BY "submittedAt" DESC`,
    () => [STUDENTS.childA.id],
  ],
  [
    'one attempt for quiz+student',
    `SELECT id FROM public.quiz_attempts WHERE "quizId" = $1 AND "studentId" = $2 LIMIT 1`,
    () => [STUDENTS.childA.id, STUDENTS.childA.id],
  ],
];

/** Writes the app performs, with the transformed values it now produces. */
const APP_WRITES = [
  [
    'quiz attempt insert (canonical)',
    `INSERT INTO public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status, "startedAt", "submittedAt")
     VALUES ($1, $2, '[]'::jsonb, 1, 2, 'submitted', now(), now())`,
    () => [CURRENT_QUIZ_ID, STUDENTS.childA.id],
  ],
  [
    'lesson_progress upsert shape',
    `INSERT INTO public.lesson_progress (parent_id, lesson_id, completed, xp_earned, correct_count, total_activities, activity_results, mastery_level, attempts_count, srs_correct_streak)
     VALUES ($1, 'lesson-x', false, 0, 0, 0, '[]'::jsonb, 0, 0, 0)`,
    (u) => [u.id],
  ],
  [
    'lesson_attempts insert shape',
    `INSERT INTO public.lesson_attempts (parent_id, lesson_id, attempt_number, correct_count, total_activities, accuracy_pct, activity_results, completed_at)
     VALUES ($1, 'lesson-x', 1, 1, 2, 50, '[]'::jsonb, now())`,
    (u) => [u.id],
  ],
];

/** The quiz id created by seed(), needed by the write contract test. */
let CURRENT_QUIZ_ID = null;

for (const legacyQuizTables of [false, true]) {
  const label = legacyQuizTables ? 'legacy database' : 'fresh database';

  describe(`schema contract (${label})`, () => {
    let db;

    before(async () => {
      db = await createDb({ legacyQuizTables });
      ({ quizId: CURRENT_QUIZ_ID } = await seed(db));
    });

    after(async () => {
      await db?.close();
    });

    test('every read the app performs compiles for a parent', async () => {
      await asUser(db, PEOPLE.parentA.id, PEOPLE.parentA.email);
      for (const [name, sql, params] of APP_QUERIES) {
        const res = await attempt(db, sql, params(PEOPLE.parentA));
        assert.equal(res.ok, true, `query "${name}" failed: ${res.error}`);
      }
    });

    test('every read the app performs compiles for a teacher and an admin', async () => {
      for (const user of [PEOPLE.teacherA, PEOPLE.admin]) {
        await asUser(db, user.id, user.email);
        for (const [name, sql, params] of APP_QUERIES) {
          const res = await attempt(db, sql, params(user));
          assert.equal(res.ok, true, `query "${name}" failed for ${user.role}: ${res.error}`);
        }
      }
    });

    test('every write the app performs is accepted from the role that performs it', async () => {
      await asUser(db, PEOPLE.parentA.id, PEOPLE.parentA.email);
      for (const [name, sql, params] of APP_WRITES) {
        const res = await attempt(db, sql, params(PEOPLE.parentA));
        assert.equal(res.ok, true, `write "${name}" failed: ${res.error}`);
      }
    });

    test('the messaging RPCs the app calls exist and are callable', async () => {
      await asUser(db, PEOPLE.parentA.id, PEOPLE.parentA.email);
      for (const sql of [`SELECT public.list_contacts()`, `SELECT public.link_profile()`, `SELECT public.set_push_token('t')`]) {
        const res = await attempt(db, sql);
        assert.equal(res.ok, true, `${sql} failed: ${res.error}`);
      }
      const msg = await attempt(db, `SELECT public.send_message($1,'Subject','Body')`, [PEOPLE.teacherA.id]);
      assert.equal(msg.ok, true, `send_message failed: ${msg.error}`);
      const id = msg.rows[0].send_message;
      assert.equal((await attempt(db, `SELECT public.mark_message_read($1)`, [id])).ok, true);
    });

    test('row level security is enabled on every application table', async () => {
      await asOwner(db);
      const rows = await q(
        db,
        `SELECT c.relname, c.relrowsecurity
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r'
          ORDER BY c.relname`,
      );
      assert.ok(rows.length > 0);
      const withoutRls = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
      assert.deepEqual(withoutRls, [], `tables without RLS: ${withoutRls.join(', ')}`);
    });

    test('no policy grants access to the anonymous role', async () => {
      await asOwner(db);
      const rows = await q(
        db,
        `SELECT tablename, policyname, roles::text AS roles FROM pg_policies WHERE schemaname = 'public'`,
      );
      assert.ok(rows.length >= 40, 'the canonical policy set is in place');
      const anon = rows.filter((r) => /anon|public=/.test(r.roles.replace(/authenticated/g, '')));
      assert.deepEqual(anon, [], `policies still exposed to anon: ${JSON.stringify(anon)}`);
    });

    test('the anonymous role has no table privileges and no RPC EXECUTE', async () => {
      await asOwner(db);
      const priv = await q(
        db,
        `SELECT
           has_table_privilege('anon','public.students','SELECT') AS students_select,
           has_table_privilege('anon','public.profiles','SELECT') AS profiles_select,
           has_table_privilege('anon','public.messages','SELECT') AS messages_select,
           has_function_privilege('anon','public.send_message(uuid,text,text)','EXECUTE') AS send_message,
           has_function_privilege('anon','public.current_profile_id()','EXECUTE') AS current_profile_id,
           has_function_privilege('anon','public.call_push_notification()','EXECUTE') AS push_trigger`,
      );
      assert.deepEqual(Object.values(priv[0]), [false, false, false, false, false, false]);
    });

    test('the push triggers are still attached after reconciliation', async () => {
      await asOwner(db);
      const rows = await q(
        db,
        `SELECT c.relname AS tbl, t.tgname
           FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
          WHERE NOT t.tgisinternal AND c.relname IN ('messages','announcements','quiz_attempts')
          ORDER BY c.relname, t.tgname`,
      );
      assert.deepEqual(
        rows.map((r) => `${r.tbl}.${r.tgname}`),
        ['announcements.on_new_announcement', 'messages.on_new_message', 'quiz_attempts.quiz_attempts_freeze_identity', 'quiz_attempts.quiz_attempts_set_parent'],
      );
    });

    test('parent links survive a profile deletion instead of cascading', async () => {
      await asOwner(db);
      const rows = await q(
        db,
        `SELECT conname, confdeltype FROM pg_constraint
          WHERE conname IN ('students_parent_fk','exams_parent_fk','quiz_attempts_parent_fk') ORDER BY conname`,
      );
      assert.equal(rows.length, 3, 'the canonical parent links exist');
      // 'n' = SET NULL, 'c' = CASCADE
      assert.deepEqual(rows.map((r) => r.confdeltype), ['n', 'n', 'n'], 'parent links must not cascade-delete school records');
    });

    test('the migrations are idempotent: re-running them changes nothing', async () => {
      await asOwner(db);
      const snapshot = async () => {
        const cols = await q(
          db,
          `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
            WHERE table_schema = 'public' ORDER BY c`,
        );
        const pol = await q(db, `SELECT tablename || '.' || policyname AS p FROM pg_policies WHERE schemaname = 'public' ORDER BY p`);
        const cons = await q(db, `SELECT conname FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY conname`);
        return JSON.stringify([cols.map((r) => r.c), pol.map((r) => r.p), cons.map((r) => r.conname)]);
      };

      const before = await snapshot();
      const { readFileSync } = await import('node:fs');
      const path = await import('node:path');
      const dir = path.join(process.cwd(), 'supabase', 'migrations');
      for (const file of [
        '20260923090000_schema_reconciliation.sql',
        '20260923090300_auth_identity_model.sql',
        '20260923090500_lockdown_rls.sql',
        '20260923091000_messaging_rpc.sql',
        '20260923092000_account_deletion.sql',
      ]) {
        await db.exec(readFileSync(path.join(dir, file), 'utf8').replace(/CREATE EXTENSION IF NOT EXISTS pg_net;/gi, '-- stub'));
      }
      const after = await snapshot();
      assert.equal(after, before, 'a second run must be a no-op');
    });
  });
}

describe('fresh database starts clean', () => {
  test('no lower-case duplicates remain in a fresh database', async () => {
    const db = await createDb({ legacyQuizTables: false });
    const rows = await q(
      db,
      `SELECT table_name || '.' || column_name AS c FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name IN ('parentid','classname','studentid','senderid','recipientid','readat','createdat','examtype','duedate','classid','quizid','totalpoints','startedat','submittedat','orderindex','promptsnapshot')
        ORDER BY c`,
    );
    assert.deepEqual(rows.map((r) => r.c), []);
    await db.close();
  });
});

describe('anonymous access attempt from the public anon key', () => {
  test('anon cannot read parent, child, exam, attendance or message data', async () => {
    const db = await createDb({ legacyQuizTables: true });
    await seed(db);
    await asAnon(db);
    for (const table of ['profiles', 'students', 'exams', 'attendance', 'messages', 'homework', 'quizzes', 'quiz_attempts']) {
      const res = await attempt(db, `SELECT * FROM public.${table} LIMIT 1`);
      assert.equal(res.ok, false, `anon reached ${table}`);
    }
    await db.close();
  });
});
