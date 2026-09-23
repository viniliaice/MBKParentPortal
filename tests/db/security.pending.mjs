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
 * Database authorization tests: anon / parent / teacher / admin / service_role.
 *
 * These are the tests the audit asked for: they talk to PostgreSQL directly with
 * a session role and JWT claims, without React, without the Supabase client, and
 * without any client-side filtering — so what they prove is what the database
 * actually enforces.
 *
 * Everything runs against a throw-away PGlite database built from the real
 * migration files (see harness.mjs). Nothing touches the school's project.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, APP_TABLES } from './harness.mjs';

for (const legacyQuizTables of [false, true]) {
  const scenario = legacyQuizTables ? 'existing quiz tables' : 'fresh database';

  describe(`security boundaries (${scenario})`, () => {
    let h;
    let ids;

    before(async () => {
      h = await createDb({ legacyQuizTables });
      ids = h.ids;
    });

    after(async () => {
      await h.db.close();
    });

    // ---------------------------------------------------------------------
    // anon — the role a request gets with only the shipped anon key
    // ---------------------------------------------------------------------

    describe('anon', () => {
      beforeEach(async () => {
        await h.asAnon();
      });
      it('holds no table privileges at all', async () => {
        await h.asOwner();
        const rows = await h.q(
          `select tablename, has_table_privilege('anon', 'public.' || quote_ident(tablename), 'SELECT') as can_select,
                  has_table_privilege('anon', 'public.' || quote_ident(tablename), 'INSERT') as can_insert,
                  has_table_privilege('anon', 'public.' || quote_ident(tablename), 'UPDATE') as can_update,
                  has_table_privilege('anon', 'public.' || quote_ident(tablename), 'DELETE') as can_delete
           from pg_tables where schemaname = 'public'`,
        );
        assert.ok(rows.length >= APP_TABLES.length, 'all application tables are present');
        for (const row of rows) {
          assert.equal(row.can_select, false, `anon must not SELECT ${row.tablename}`);
          assert.equal(row.can_insert, false, `anon must not INSERT ${row.tablename}`);
          assert.equal(row.can_update, false, `anon must not UPDATE ${row.tablename}`);
          assert.equal(row.can_delete, false, `anon must not DELETE ${row.tablename}`);
        }
      });

      it('cannot read student, exam, attendance, message or profile data', async () => {
        await h.asAnon();
        for (const table of ['students', 'exams', 'attendance', 'homework', 'messages', 'profiles', 'announcements', 'quiz_attempts']) {
          const result = await h.attempt(`select * from public.${table}`);
          if (result.ok) {
            assert.equal(result.rows.length, 0, `anon must not see rows in ${table}`);
          } else {
            assert.match(result.error.message, /permission denied|does not exist/i);
          }
        }
      });

      it('cannot write anything', async () => {
        await h.asAnon();
        const writes = [
          `insert into public.students (name, "className", "parentId") values ('X', 'Grade 1A', null)`,
          `update public.students set name = 'X'`,
          `delete from public.students`,
          `insert into public.messages ("senderId", "recipientId", subject, body) values ('a', 'b', 's', 'b')`,
          `update public.profiles set role = 'admin'`,
        ];
        for (const sql of writes) {
          const result = await h.attempt(sql);
          assert.equal(result.ok, false, `anon must not be able to run: ${sql}`);
        }
      });

      it('cannot execute the RPCs', async () => {
        await h.asAnon();
        const calls = [
          `select * from public.link_profile()`,
          `select public.send_message(gen_random_uuid(), 'subject', 'body')`,
          `select public.delete_my_account()`,
          `select public.set_push_token('token')`,
          `select public.list_contacts()`,
          `select public.mark_message_read(gen_random_uuid())`,
          `select public.is_admin()`,
          `select public.can_read_student(gen_random_uuid())`,
        ];
        for (const sql of calls) {
          const result = await h.attempt(sql);
          assert.equal(result.ok, false, `anon must not execute: ${sql}`);
        }
      });
    });

    // ---------------------------------------------------------------------
    // parent
    // ---------------------------------------------------------------------

    describe('parent', () => {
      beforeEach(async () => {
        await h.asUser(ids.emails.parentA);
      });

      it('sees only their own children', async () => {
        const rows = await h.q('select id, name, "parentId" from public.students order by name');
        assert.equal(rows.length, 2, 'parent A has two children and must not see the third');
        assert.ok(rows.every(r => r.parentId === ids.parentA));
        assert.ok(!rows.some(r => r.id === ids.childB));
      });

      it('sees exams, attendance and homework only for their own children', async () => {
        const exams = await h.q('select "studentId" from public.exams');
        assert.equal(exams.length, 1);
        assert.equal(exams[0].studentId, ids.childA);

        const attendance = await h.q('select "studentId" from public.attendance');
        assert.deepEqual(attendance.map(r => r.studentId), [ids.childA]);

        const homework = await h.q('select "studentId" from public.homework');
        assert.deepEqual(homework.map(r => r.studentId), [ids.childA]);
      });

      it('sees only messages they participate in', async () => {
        const rows = await h.q('select "senderId", "recipientId" from public.messages');
        assert.equal(rows.length, 2, 'the message between the other two adults must stay invisible');
        assert.ok(rows.every(r => r.senderId === ids.parentA || r.recipientId === ids.parentA));
      });

      it('sees only their own learning records', async () => {
        assert.equal((await h.q('select parent_id from public.lesson_progress')).length, 1);
        assert.equal((await h.q('select parent_id from public.lesson_attempts')).length, 1);
        assert.equal((await h.q('select parent_id from public.gamification')).length, 1);
      });

      it('cannot promote themselves to teacher or admin', async () => {
        const result = await h.attempt(`update public.profiles set role = 'admin' where id = $1`, [ids.parentA]);
        assert.equal(result.affectedRows, 0, 'no policy lets a client update profiles');

        await h.asOwner();
        const row = await h.q('select role from public.profiles where id = $1', [ids.parentA]);
        assert.equal(row[0].role, 'parent', 'the stored role is unchanged');
      });

      it('cannot write to school records', async () => {
        const student = await h.attempt(`update public.students set "className" = 'Grade 9Z' where id = $1`, [ids.childA]);
        assert.equal(student.affectedRows, 0);

        const exam = await h.attempt(`update public.exams set score = 100`);
        assert.equal(exam.affectedRows, 0);

        const attendance = await h.attempt(`delete from public.attendance`);
        assert.equal(attendance.affectedRows, 0);

        const homework = await h.attempt(`insert into public.homework ("studentId", subject, title, "dueDate") values ($1, 's', 't', '2026-01-01')`, [ids.childA]);
        assert.equal(homework.ok, false, 'with no INSERT policy the write is rejected');

        const newStudent = await h.attempt(`insert into public.students (name, "className", "parentId") values ('New', 'Grade 4A', $1)`, [ids.parentA]);
        assert.equal(newStudent.ok, false, 'a parent cannot enrol a child');

        const deleteStudent = await h.attempt(`delete from public.students`);
        assert.equal(deleteStudent.affectedRows, 0);
      });

      it('cannot write messages directly', async () => {
        const insert = await h.attempt(
          `insert into public.messages ("senderId", "recipientId", subject, body) values ($1, $2, 'Hi', 'There')`,
          [ids.parentA, ids.teacherB],
        );
        assert.equal(insert.ok, false);

        const update = await h.attempt(`update public.messages set subject = 'Changed'`);
        assert.equal(update.affectedRows, 0);

        const del = await h.attempt(`delete from public.messages`);
        assert.equal(del.affectedRows, 0);
      });

      it('sees only their own class announcements and the school calendar', async () => {
        const announcements = await h.q('select "className" from public.announcements');
        assert.deepEqual(announcements.map(r => r.className), ['Grade 4A']);
        assert.equal((await h.q('select name from public.academic_years')).length, 1);
      });
    });

    // ---------------------------------------------------------------------
    // teacher
    // ---------------------------------------------------------------------

    describe('teacher', () => {
      beforeEach(async () => {
        await h.asUser(ids.emails.teacherA);
      });

      it('sees only their own class', async () => {
        const rows = await h.q('select id from public.students');
        assert.equal(rows.length, 2);
        assert.ok(!rows.some(r => r.id === ids.childB));

        assert.equal((await h.q('select count(*)::int c from public.exams'))[0].c, 1);
        assert.equal((await h.q('select count(*)::int c from public.homework'))[0].c, 1);
      });

      it('can keep their own class attendance but not another class', async () => {
        const own = await h.attempt(
          `insert into public.attendance ("studentId", date, status) values ($1, '2026-09-15', 'present')`,
          [ids.childA],
        );
        assert.equal(own.ok, true, 'a teacher may record attendance for their own class');

        const foreign = await h.attempt(
          `insert into public.attendance ("studentId", date, status) values ($1, '2026-09-15', 'present')`,
          [ids.childB],
        );
        assert.equal(foreign.ok, false, 'and not for somebody else’s class');
      });

      it('cannot delete school records', async () => {
        const del = await h.attempt(`delete from public.attendance`);
        assert.equal(del.affectedRows, 0, 'delete stays with the school admin');
      });

      it('sees only messages they participate in', async () => {
        const rows = await h.q('select "senderId", "recipientId" from public.messages');
        assert.equal(rows.length, 1);
        assert.equal(rows[0].senderId, ids.teacherA);
      });

      it('cannot read another class’s quizzes or attempts', async () => {
        const quizzes = await h.q('select id, "className" from public.quizzes');
        assert.ok(quizzes.length > 0, 'the own-class quiz is visible');
        assert.ok(quizzes.every(q => q.className === 'Grade 4A'), 'only the teacher’s own class is reachable');
        assert.ok(!quizzes.some(q => q.id === ids.quizB), 'the other class’s quiz is not');

        const visibleIds = new Set(quizzes.map(q => q.id));
        const questions = await h.q('select "quizId" from public.quiz_questions');
        assert.ok(questions.every(r => visibleIds.has(r.quizId)));

        const attempts = await h.q('select id from public.quiz_attempts');
        assert.equal(attempts.length, 0, 'no attempt for the other class is reachable');
      });

      it('cannot read the profile of an unrelated family', async () => {
        const rows = await h.q('select id from public.profiles');
        assert.ok(rows.some(r => r.id === ids.teacherA), 'own profile is visible');
        assert.ok(!rows.some(r => r.id === ids.parentB), 'the other class’s parent is not');
      });
    });

    // ---------------------------------------------------------------------
    // admin
    // ---------------------------------------------------------------------

    describe('admin', () => {
      beforeEach(async () => {
        await h.asUser(ids.emails.admin);
      });

      it('sees the whole school', async () => {
        assert.equal((await h.q('select count(*)::int c from public.students'))[0].c, 3);
        assert.equal((await h.q('select count(*)::int c from public.exams'))[0].c, 2);
        assert.equal((await h.q('select count(*)::int c from public.messages'))[0].c, 3);
        assert.equal((await h.q('select count(*)::int c from public.profiles'))[0].c, 6);
      });

      it('can correct and remove records', async () => {
        const update = await h.attempt(`update public.exams set score = 19 where "studentId" = $1`, [ids.childA]);
        assert.equal(update.affectedRows, 1);
      });

      it('an unknown role fails closed', async () => {
        // profiles.role is deliberately not constrained to a fixed list: the
        // school may introduce a tier without a migration. What must never
        // happen is that an unrecognised value inherits staff powers.
        await h.asOwner();
        await h.q(`update public.profiles set role = 'principal' where id = $1`, [ids.parentA]);

        await h.asUser(ids.emails.parentA);
        assert.equal((await h.q('select public.is_admin() as v'))[0].v, false);
        assert.equal((await h.q('select public.is_staff() as v'))[0].v, false);
        assert.equal((await h.q('select public.teacher_class() as v'))[0].v, null);
        // The account is still this person's own family account, so it keeps its
        // two children — but nothing beyond them and no staff power.
        assert.equal((await h.q('select count(*)::int c from public.students'))[0].c, 2);
        assert.ok(!(await h.q('select id from public.students')).some(r => r.id === ids.childB));

        await h.asOwner();
        await h.q(`update public.profiles set role = 'parent' where id = $1`, [ids.parentA]);
      });
    });

    // ---------------------------------------------------------------------
    // service_role (server-side tooling only)
    // ---------------------------------------------------------------------

    describe('service_role', () => {
      it('bypasses RLS, as it does on Supabase (never shipped in the app)', async () => {
        await h.asServiceRole();
        assert.equal((await h.q('select count(*)::int c from public.students'))[0].c, 3);
      });
    });

    // ---------------------------------------------------------------------
    // Structural guarantees
    // ---------------------------------------------------------------------

    describe('identity helpers', () => {
      it('resolve the caller from the JWT, never from the client', async () => {
        await h.asUser(ids.emails.teacherA);
        const t = (await h.q('select public.current_profile_id() as id, public.current_profile_role() as role, public.teacher_class() as cls, public.is_staff() as staff'))[0];
        assert.equal(t.id, ids.teacherA);
        assert.equal(t.role, 'teacher');
        assert.equal(t.cls, 'Grade 4A');
        assert.equal(t.staff, true);
        assert.equal((await h.q('select public.current_profile_id_text() as id'))[0].id, ids.teacherA);

        await h.asUser(ids.emails.parentA);
        const parent = (await h.q('select public.current_profile_id() as id, public.teacher_class() as cls, public.is_staff() as staff'))[0];
        assert.equal(parent.id, ids.parentA);
        assert.equal(parent.cls, null);
        assert.equal(parent.staff, false);
        assert.deepEqual((await h.q('select public.my_class_names() as c'))[0].c, ['Grade 4A']);
        assert.equal((await h.q('select public.can_read_student($1) as v', [ids.childB]))[0].v, false);
        assert.equal((await h.q('select public.can_write_student_record($1) as v', [ids.childA]))[0].v, false);
        assert.equal((await h.q('select public.can_read_student($1) as v', [ids.childA]))[0].v, true);
      });
    });

    describe('policy inventory', () => {
      beforeEach(async () => {
        await h.asOwner();
      });
      it('has row level security enabled on every application table', async () => {
        await h.asOwner();
        const rows = await h.q(
          `select relname, relrowsecurity from pg_class where relname = any($1) and relkind = 'r'`,
          [APP_TABLES],
        );
        assert.equal(rows.length, APP_TABLES.length);
        for (const row of rows) {
          assert.equal(row.relrowsecurity, true, `RLS must be enabled on ${row.relname}`);
        }
      });

      it('grants nothing to anon by policy', async () => {
        await h.asOwner();
        const rows = await h.q(
          `select tablename, policyname, roles::text as roles from pg_policies where schemaname = 'public'`,
        );
        assert.ok(rows.length > 0);
        for (const row of rows) {
          assert.ok(!row.roles.includes('anon'), `${row.tablename}.${row.policyname} must not target anon`);
          assert.ok(!row.roles.includes('= {0}') && !row.roles.includes('{public}'), `${row.policyname} must not target PUBLIC`);
        }
      });

      it('keeps the push trigger function out of the public API', async () => {
        await h.asOwner();
        const rows = await h.q(
          `select has_function_privilege('anon', 'public.call_push_notification()', 'EXECUTE') as anon_can,
                  has_function_privilege('authenticated', 'public.call_push_notification()', 'EXECUTE') as auth_can`,
        );
        assert.equal(rows[0].anon_can, false);
        assert.equal(rows[0].auth_can, false);
      });
    });
  });
}
