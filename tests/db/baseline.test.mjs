/**
 * Baseline tests: the fixture really is the production shape.
 *
 * Everything else in tests/db/ runs on top of this. If these fail, the harness
 * is testing a schema the school does not have, and the other suites prove
 * nothing.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, APP_TABLES, MISSING_MIGRATIONS } from './harness.mjs';

describe('production baseline', () => {
  let h;

  before(async () => {
    h = await createDb({ migrations: false });
  });

  after(async () => {
    await h.db.close();
  });

  it('uses text primary keys, as production does', async () => {
    const rows = await h.q(
      `select table_name, data_type from information_schema.columns
       where table_schema = 'public' and column_name = 'id'
         and table_name = any($1)
       order by table_name`,
      [['profiles', 'students', 'exams', 'quizzes', 'quiz_questions', 'quiz_attempts', 'attendance', 'homework', 'announcements', 'messages']],
    );
    assert.equal(rows.length, 10);
    for (const row of rows) {
      assert.equal(row.data_type, 'text', `${row.table_name}.id must be text`);
    }
  });

  it('keeps the real role vocabulary', async () => {
    const roles = await h.q(`select pg_get_constraintdef(oid) as def from pg_constraint where conname = 'profiles_role_check'`);
    assert.equal(roles.length, 1);
    for (const role of ['admin', 'teacher', 'parent', 'supervisor', 'office']) {
      assert.match(roles[0].def, new RegExp(role));
    }
  });

  it('stores staff classes as jsonb, not as a column', async () => {
    const rows = await h.q(
      `select column_name, data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles'
         and column_name in ('assignedClasses', 'class_name')`,
    );
    const assigned = rows.find(r => r.column_name === 'assignedClasses');
    assert.ok(assigned, 'assignedClasses exists');
    assert.equal(assigned.data_type, 'jsonb');
    assert.ok(!rows.some(r => r.column_name === 'class_name'), 'there is no class_name in production');
  });

  it('takes the staff assignment from the data', async () => {
    await h.asOwner();
    const rows = await h.q(`select id, "assignedClasses" from public.profiles where id = 'p-teacher-a'`);
    assert.deepEqual(rows[0].assignedClasses, ['Grade 4A']);
  });

  it('has the foreign keys the access model depends on', async () => {
    const rows = await h.q(
      `select conname from pg_constraint where contype = 'f'
       and conname = any($1)`,
      [['messages_senderId_fkey', 'messages_recipientId_fkey', 'students_parentId_fkey', 'fk_users_auth_id', 'exams_parentId_fkey']],
    );
    assert.equal(rows.length, 5, 'messages, students, exams and profiles keep their real FKs');
  });

  it('reproduces the reported RLS state, table by table', async () => {
    // This is the state *before* the remediation migrations run (this suite
    // loads the fixture without applying them). `tests/db/rls.test.mjs` asserts
    // the state afterwards.
    const expectedOn = [
      'attendance', 'exams', 'homework', 'profiles', 'quiz_attempts', 'quizzes',
      'students', 'student_enrollments', 'class_subjects', 'grade_uploads',
      'lesson_plans', 'lesson_plan_periods', 'release_log',
    ];
    const expectedOff = [
      'academic_years', 'ai_review_logs', 'ai_reviews', 'announcement_recipients',
      'announcements', 'grade_scales', 'id_migration_map', 'lesson_period_ai_reviews',
      'messages', 'questions', 'quiz_questions', 'report_comments', 'report_config',
      'student_lesson_progress', 'subjects', 'terms',
    ];

    await h.asOwner();
    const rows = await h.q(
      `select relname, relrowsecurity from pg_class
       where relname = any($1) and relkind = 'r'`,
      [[...expectedOn, ...expectedOff]],
    );
    const state = new Map(rows.map(r => [r.relname, r.relrowsecurity]));

    for (const table of expectedOn) {
      assert.equal(state.get(table), true, `RLS is on for ${table} (as reported)`);
    }
    for (const table of expectedOff) {
      assert.equal(state.get(table), false, `RLS is off for ${table} (as reported — the leak)`);
    }
  });

  it('holds one attempt per student per quiz in the seeded data', async () => {
    await h.asOwner();
    const rows = await h.q(`select "quizId", "studentId", status from public.quiz_attempts`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quizId, 'q-4a');
    assert.equal(rows[0].studentId, 's-child-a');
  });

  it('reports which migrations under test are still to be written', async () => {
    // Not an assertion about production: it keeps the rework visible. The
    // migration set is being rewritten for the production schema (text ids), so
    // the old repository-shaped files are no longer applied.
    assert.ok(Array.isArray(MISSING_MIGRATIONS));
  });
});
