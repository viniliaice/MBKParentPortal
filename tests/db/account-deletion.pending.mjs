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
 * Account deletion tests.
 *
 * The rule being tested is the one in docs/account-deletion.md: deleting the
 * family's *account* must really delete the account data, while the child's
 * *school records* stay with the school and simply stop being linked to it.
 *
 * Runs against the disposable PGlite database built from the real migrations.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';

describe('account deletion', () => {
  let h;
  let ids;

  before(async () => {
    h = await createDb({ legacyQuizTables: false });
    ids = h.ids;

    // One attempt and one message from parent A, so several tables have
    // account-owned rows to remove.
    await h.asUser(ids.emails.parentA);
    await h.q('select public.send_message($1, \'Bus\', \'Which bus? \')', [ids.teacherA]);
    await h.q(
      `insert into public.quiz_attempts ("quizId", "studentId", answers, "totalEarned", "totalPossible", status)
       values ($1, $2, '[]'::jsonb, 1, 2, 'submitted')`,
      [ids.quizA, ids.childA],
    );
  });

  after(async () => {
    await h.db.close();
  });

  it('does not expose the retention tables to anon', async () => {
    await h.asAnon();
    for (const table of ['account_deletion_requests', 'retained_academic_records']) {
      const res = await h.attempt(`select * from public.${table}`);
      assert.equal(res.ok, false, `anon must not read ${table}`);
    }
  });

  it('records a request for the school instead of deleting anything', async () => {
    await h.asUser(ids.emails.parentB);
    const rows = await h.q(`select public.request_account_deletion('Moving abroad') as id`);
    assert.equal(rows.length, 1);

    // The requester cannot read the audit table ...
    assert.equal((await h.q('select id from public.account_deletion_requests')).length, 0);
    // ... and nothing was deleted.
    await h.asOwner();
    assert.equal((await h.q('select count(*)::int c from public.profiles where id = $1', [ids.parentB]))[0].c, 1);
    const requests = await h.q(
      `select "profileId", email, reason, status from public.account_deletion_requests order by "requestedAt" desc limit 1`,
    );
    assert.equal(requests[0].profileId, ids.parentB);
    assert.equal(requests[0].reason, 'Moving abroad');
    assert.equal(requests[0].status, 'pending');
  });

  it('lets an admin see the requests', async () => {
    await h.asUser(ids.emails.admin);
    const rows = await h.q('select id, status from public.account_deletion_requests');
    assert.ok(rows.length >= 1);
  });

  it('refuses anon the deletion RPCs', async () => {
    await h.asAnon();
    for (const sql of ['select public.delete_my_account()', `select public.request_account_deletion('x')`]) {
      const res = await h.attempt(sql);
      assert.equal(res.ok, false);
    }
  });

  it('refuses to delete the last administrator', async () => {
    await h.asUser(ids.emails.admin);
    const res = await h.attempt('select public.delete_my_account()');
    assert.equal(res.ok, false);
    assert.match(res.error.message, /last_admin/);

    await h.asOwner();
    assert.equal((await h.q('select count(*)::int c from public.profiles where role = \'admin\''))[0].c, 1);
  });

  describe('deleting a parent account', () => {
    let snapshot;
    let request;

    before(async () => {
      await h.asUser(ids.emails.parentA);
      await h.q('select public.delete_my_account()');
      await h.asOwner();

      snapshot = (await h.q(
        `select "studentId", "studentName", "className", exams, attendance, homework, reason
         from public.retained_academic_records where "profileId" = $1 order by "studentName"`,
        [ids.parentA],
      ));
      request = (await h.q(
        `select "profileId", email, status, "completedAt", "authUserDeleted", "recordsRetained"
         from public.account_deletion_requests where "profileId" = $1`,
        [ids.parentA],
      ))[0];
    });

    it('removes the family account itself', async () => {
      assert.equal((await h.q('select id from public.profiles where id = $1', [ids.parentA])).length, 0);
    });

    it('removes the account-owned data', async () => {
      const tables = [
        ['messages', '"senderId" = $1 or "recipientId" = $1'],
        ['lesson_progress', 'parent_id = $1'],
        ['lesson_attempts', 'parent_id = $1'],
        ['gamification', 'parent_id = $1'],
        ['quiz_attempts', '"parentId" = $1'],
      ];
      for (const [table, where] of tables) {
        const count = (await h.q(`select count(*)::int c from public.${table} where ${where}`, [ids.parentA]))[0].c;
        assert.equal(count, 0, `${table} must not keep the deleted account's rows`);
      }
    });

    it('keeps the children as school records, unlinked', async () => {
      const children = await h.q(
        'select id, "parentId", "retentionStatus" from public.students where id = any($1) order by id',
        [[ids.childA, ids.childA2]],
      );
      assert.equal(children.length, 2, 'the enrolment rows are kept');
      for (const child of children) {
        assert.equal(child.parentId, null, 'the family link is gone');
        assert.equal(child.retentionStatus, 'retained');
      }
    });

    it('keeps attendance, homework and marks, unlinked', async () => {
      const attendance = await h.q('select "studentId" from public.attendance where "studentId" = $1', [ids.childA]);
      assert.equal(attendance.length, 1, 'attendance survives');

      const homework = await h.q('select "studentId" from public.homework where "studentId" = $1', [ids.childA]);
      assert.equal(homework.length, 1, 'homework survives');

      const exams = await h.q('select "studentId", "parentId", score from public.exams where "studentId" = $1', [ids.childA]);
      assert.equal(exams.length, 1, 'the mark survives');
      assert.equal(exams[0].parentId, null, 'and no longer points at the deleted account');
    });

    it('snapshots what was retained, so the school has an audit trail', async () => {
      assert.equal(snapshot.length, 2, 'one snapshot row per child');
      const first = snapshot.find(r => r.studentId === ids.childA);
      assert.equal(first.studentName, 'Yusuf A');
      assert.equal(first.className, 'Grade 4A');
      assert.equal(first.exams.length, 1, 'the snapshot carries the marks');
      assert.equal(first.attendance.length, 1);
      assert.equal(first.homework.length, 1);
      assert.equal(first.reason, 'account_deletion');
    });

    it('closes the request record and reports the outcome', async () => {
      assert.ok(request, 'a request row records the deletion');
      assert.equal(request.status, 'completed');
      assert.notEqual(request.completedAt, null);
      assert.equal(request.recordsRetained, 2);
      assert.equal(typeof request.authUserDeleted, 'boolean', 'the school can see whether the login was removed too');
      assert.match(request.email, /parent\.a@example\.com/);
    });

    it('leaves the login only when the database role was not allowed to remove it', async () => {
      const stillThere = (await h.q('select id from auth.users where email = $1', ['parent.a@example.com'])).length;
      if (request.authUserDeleted) {
        assert.equal(stillThere, 0, 'the flag says the login is gone, so it must be');
      } else {
        assert.equal(stillThere, 1, 'otherwise the row stays for the school to remove manually, as documented');
      }
    });

    it('does not touch another family’s records', async () => {
      assert.equal((await h.q('select count(*)::int c from public.students where "parentId" = $1', [ids.parentB]))[0].c, 1);
      assert.equal((await h.q('select count(*)::int c from public.exams where "parentId" = $1', [ids.parentB]))[0].c, 1);
      const bThreads = (await h.q(
        'select count(*)::int c from public.messages where "senderId" = $1 or "recipientId" = $1',
        [ids.parentB],
      ))[0].c;
      assert.ok(bThreads >= 1, 'the other family keeps its messages');
      assert.equal((await h.q('select count(*)::int c from public.profiles where id = $1', [ids.parentB]))[0].c, 1);
    });

    it('leaves the retained child invisible to everybody but the school', async () => {
      await h.asUser(ids.emails.teacherA);
      const visible = await h.q('select id, "parentId" from public.students where id = $1', [ids.childA]);
      assert.equal(visible.length, 1, 'the class teacher still needs the child for attendance and marks');
      assert.equal(visible[0].parentId, null);

      const exams = await h.q('select id from public.exams where "studentId" = $1', [ids.childA]);
      assert.equal(exams.length, 1, 'the teacher can still see and grade the mark');
    });
  });

  describe('an admin may delete themselves when another admin exists', () => {
    it('succeeds, and the school keeps exactly one admin', async () => {
      await h.asOwner();
      const secondAdminAuth = '55555555-0000-4000-8000-000000000010';
      await h.q(`insert into auth.users (id, email) values ($1, 'deputy@example.com')`, [secondAdminAuth]);
      await h.q(
        `insert into public.profiles (id, name, email, role, auth_id)
         values ($1, 'Deputy', 'deputy@example.com', 'admin', $1)`,
        [secondAdminAuth],
      );

      await h.asUser('deputy@example.com');
      await h.q('select public.delete_my_account()');

      await h.asOwner();
      assert.equal((await h.q(`select count(*)::int c from public.profiles where role = 'admin'`))[0].c, 1);
      assert.equal((await h.q('select id from public.profiles where email = $1', ['deputy@example.com'])).length, 0);
      assert.equal((await h.q('select id from public.profiles where id = $1', [ids.admin])).length, 1, 'the principal remains');
    });
  });
});
