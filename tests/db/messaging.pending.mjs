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
 * Messaging tests: the identity of a sender must come from the session, the
 * recipient must be an authorized contact, and only the participants may read a
 * thread. Everything runs against the disposable PGlite database built from the
 * real migrations (harness.mjs) and talks to PostgreSQL directly, so nothing
 * depends on the app's own filtering.
 */
import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('messaging', () => {
  let h;
  let ids;

  before(async () => {
    h = await createDb({ legacyQuizTables: true });
    ids = h.ids;
  });

  after(async () => {
    await h.db.close();
  });

  describe('sign-in bootstrap (link_profile)', () => {
    beforeEach(async () => {
      await h.asOwner();
    });

    it('binds the school-provisioned profile to the verified email once', async () => {
      const authId = '99999999-0000-4000-8000-0000000000ff';
      await h.q(`insert into auth.users (id, email) values ($1, 'parent.new@example.com')`, [authId]);

      await h.asUser('parent.new@example.com');
      const first = await h.q('select id, name, email, role from public.link_profile()');
      assert.equal(first.length, 1);
      assert.equal(first[0].id, ids.unlinkedParent);
      assert.equal(first[0].role, 'parent');

      // Idempotent: a second call returns the same profile and changes nothing.
      const second = await h.q('select id from public.link_profile()');
      assert.deepEqual(second.map(r => r.id), [ids.unlinkedParent]);

      await h.asOwner();
      const linked = await h.q('select auth_id from public.profiles where id = $1', [ids.unlinkedParent]);
      assert.equal(linked[0].auth_id, authId);
    });

    it('refuses to re-point a profile that another auth user already owns', async () => {
      await h.asOwner();
      // parent.a@example.com is already linked to parent A's auth user.
      await h.q(`insert into auth.users (id, email) values ('88888888-0000-4000-8000-0000000000ee', 'other@example.com')`);

      await h.asUser('other@example.com');
      const rows = await h.q('select id from public.link_profile()');
      assert.equal(rows.length, 0, 'an unknown email gets no profile at all');

      await h.asOwner();
      const stillMine = await h.q('select auth_id from public.profiles where id = $1', [ids.parentA]);
      assert.equal(stillMine[0].auth_id, ids.parentA);
    });
  });

  describe('sending a message', () => {
    it('stamps the sender from the session, not from the request', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q(`select public.send_message($1, 'Homework', 'Could we talk about the homework?') as id`, [ids.teacherA]);
      const messageId = rows[0].id;
      assert.match(messageId, UUID_RE, 'the RPC returns a real uuid');

      await h.asOwner();
      const stored = await h.q(
        `select "senderId", "recipientId", "senderName", "recipientName", "senderRole", "recipientRole", subject, body, "readAt"
         from public.messages where id = $1`,
        [messageId],
      );
      assert.equal(stored.length, 1);
      assert.equal(stored[0].senderId, ids.parentA);
      assert.equal(stored[0].recipientId, ids.teacherA);
      assert.equal(stored[0].senderName, 'Amina Yusuf');
      assert.equal(stored[0].recipientName, 'Teacher A');
      assert.equal(stored[0].senderRole, 'parent');
      assert.equal(stored[0].recipientRole, 'teacher');
      assert.equal(stored[0].readAt, null);
    });

    it('allows a teacher to write to a parent in their own class', async () => {
      await h.asUser(ids.emails.teacherA);
      const rows = await h.q(`select public.send_message($1, 'Attendance', 'Yusuf was in class today') as id`, [ids.parentA]);
      assert.match(rows[0].id, UUID_RE);

      await h.asOwner();
      const stored = await h.q(`select "senderRole" from public.messages where id = $1`, [rows[0].id]);
      assert.equal(stored[0].senderRole, 'teacher');
    });

    it('rejects a recipient the sender has no relationship with', async () => {
      await h.asUser(ids.emails.parentA);
      const cases = [
        [ids.teacherB, 'the other class’s teacher'],
        [ids.parentB, 'an unrelated parent'],
        ['77000000-0000-4000-8000-000000000021', 'a profile id that does not exist'],
      ];
      for (const [recipient, label] of cases) {
        const res = await h.attempt(`select public.send_message($1, 'Hi', 'Body')`, [recipient]);
        assert.equal(res.ok, false, `${label} must be refused`);
        assert.match(res.error.message, /recipient_not_authorized/);
      }
    });

    it('rejects a teacher writing outside their class', async () => {
      await h.asUser(ids.emails.teacherB);
      const res = await h.attempt(`select public.send_message($1, 'Hi', 'Body')`, [ids.parentA]);
      assert.equal(res.ok, false);
      assert.match(res.error.message, /recipient_not_authorized/);
    });

    it('refuses demo ids and invalid uuids', async () => {
      await h.asUser(ids.emails.parentA);
      for (const bogus of ['teacher1', 'parent1', 'not-a-uuid']) {
        const res = await h.attempt(`select public.send_message($1::uuid, 'Hi', 'Body')`, [bogus]);
        assert.equal(res.ok, false, `${bogus} must not be a valid recipient`);
      }
    });

    it('refuses an empty message and enforces length limits', async () => {
      await h.asUser(ids.emails.parentA);
      const empty = await h.attempt(`select public.send_message($1, '   ', 'Body')`, [ids.teacherA]);
      assert.match(empty.error.message, /empty_message/);

      const longSubject = await h.attempt(`select public.send_message($1, repeat('s', 201), 'Body')`, [ids.teacherA]);
      assert.match(longSubject.error.message, /subject_too_long/);

      const longBody = await h.attempt(`select public.send_message($1, 'Subject', repeat('b', 5001))`, [ids.teacherA]);
      assert.match(longBody.error.message, /body_too_long/);
    });

    it('cannot be written directly, bypassing the RPC', async () => {
      await h.asUser(ids.emails.parentA);
      const insert = await h.attempt(
        `insert into public.messages ("senderId", "recipientId", subject, body) values ('parent1', 'teacher1', 'Demo', 'Demo')`,
      );
      assert.equal(insert.ok, false, 'there is no INSERT policy on messages');

      const spoof = await h.attempt(
        `insert into public.messages ("senderId", "recipientId", subject, body) values ($1, $2, 'Spoof', 'Spoof')`,
        [ids.parentB, ids.teacherA],
      );
      assert.equal(spoof.ok, false, 'not even with real ids');
    });
  });

  describe('reading a thread', () => {
    it('shows a message only to its two participants', async () => {
      await h.asUser(ids.emails.teacherA);
      const rows = await h.q(`select public.send_message($1, 'Trip', 'Permission slip needed') as id`, [ids.parentA]);
      const messageId = rows[0].id;

      const seen = {};
      for (const who of ['parentA', 'teacherA', 'parentB', 'teacherB', 'admin']) {
        await h.asUser(ids.emails[who]);
        const visible = await h.q('select id from public.messages where id = $1', [messageId]);
        seen[who] = visible.length;
      }
      assert.equal(seen.parentA, 1, 'the recipient sees it');
      assert.equal(seen.teacherA, 1, 'the sender sees it');
      assert.equal(seen.parentB, 0, 'an unrelated family does not');
      assert.equal(seen.teacherB, 0, 'another class does not');
      assert.equal(seen.admin, 1, 'the school administrator can, as part of running the school');
    });

    it('lets only the recipient mark a message read', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q(`select public.send_message($1, 'Read me', 'Please read') as id`, [ids.teacherA]);
      const messageId = rows[0].id;

      // The sender cannot mark their own message read.
      const asSender = await h.q('select public.mark_message_read($1)', [messageId]);
      assert.equal(asSender.length, 1);
      await h.asOwner();
      assert.equal((await h.q('select "readAt" from public.messages where id = $1', [messageId]))[0].readAt, null);

      // A third party cannot either.
      await h.asUser(ids.emails.parentB);
      await h.q('select public.mark_message_read($1)', [messageId]);
      await h.asOwner();
      assert.equal((await h.q('select "readAt" from public.messages where id = $1', [messageId]))[0].readAt, null);

      // The recipient can.
      await h.asUser(ids.emails.teacherA);
      await h.q('select public.mark_message_read($1)', [messageId]);
      await h.asOwner();
      assert.notEqual((await h.q('select "readAt" from public.messages where id = $1', [messageId]))[0].readAt, null);
    });

    it('rejects direct updates and deletes', async () => {
      await h.asUser(ids.emails.teacherA);
      assert.equal(await h.affected(`update public.messages set "readAt" = now()`), 0);
      assert.equal(await h.affected(`delete from public.messages`), 0);
    });
  });

  describe('contacts and push tokens', () => {
    it('lists only the contacts a parent may write to', async () => {
      await h.asUser(ids.emails.parentA);
      const contacts = await h.q('select id, name, role, class_name from public.list_contacts()');
      assert.deepEqual(contacts.map(c => c.id), [ids.teacherA]);
      assert.equal(contacts[0].class_name, 'Grade 4A');
    });

    it('lists only the parents in a teacher’s own class', async () => {
      await h.asUser(ids.emails.teacherA);
      const contacts = await h.q('select id from public.list_contacts()');
      assert.deepEqual(contacts.map(c => c.id), [ids.parentA]);
    });

    it('lists everybody for an admin, but never the admin themselves', async () => {
      await h.asUser(ids.emails.admin);
      const contacts = await h.q('select id from public.list_contacts()');
      assert.equal(contacts.length, 5);
      assert.ok(!contacts.some(c => c.id === ids.admin));
    });

    it('stores the push token on the caller’s own row only', async () => {
      await h.asUser(ids.emails.parentA);
      await h.q(`select public.set_push_token('ExponentPushToken[test-a]')`);

      const empty = await h.attempt(`select public.set_push_token('   ')`);
      assert.match(empty.error.message, /empty_token/);

      await h.asOwner();
      const rows = await h.q('select id, expo_push_token from public.profiles where expo_push_token is not null');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, ids.parentA);

      // Signing out clears it again.
      await h.asUser(ids.emails.parentA);
      await h.q('select public.clear_push_token()');
      await h.asOwner();
      assert.equal((await h.q('select count(*)::int c from public.profiles where expo_push_token is not null'))[0].c, 0);
    });

    it('does not let a client write its own profile row directly', async () => {
      await h.asUser(ids.emails.parentA);
      assert.equal(await h.affected(`update public.profiles set expo_push_token = 'x'`), 0);
      assert.equal(await h.affected(`update public.profiles set name = 'Someone else'`), 0);
      assert.equal(await h.affected(`update public.profiles set role = 'admin'`), 0);
    });
  });

  describe('anon', () => {
    it('cannot send, read or mark messages', async () => {
      await h.asAnon();
      for (const sql of [
        `select public.send_message($1, 'Hi', 'Body')`,
        `select * from public.messages`,
        `select public.mark_message_read($1)`,
        `select * from public.list_contacts()`,
      ]) {
        const res = await h.attempt(sql, [ids.teacherA]);
        assert.equal(res.ok, false, `${sql} must not work for anon`);
      }
    });
  });
});
