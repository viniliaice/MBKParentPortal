/**
 * The functions the parent app calls, exercised the way the app calls them.
 *
 * Eight functions carry the app's writes (sign-in, messaging, push registration,
 * deletion). None of them existed in the live project, because the drafts were
 * written for the schema this repository used to recreate. This suite runs them on
 * the production-shaped fixture and checks both directions: the family can do what
 * the app promises, and nothing reaches past the relationship.
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';

describe('parent app functions', () => {
  let h;
  let ids;

  before(async () => {
    h = await createDb();
    ids = h.ids;
  });

  after(async () => {
    await h.db.close();
  });

  describe('link_profile — the sign-in path', () => {
    it('returns the signed-in parent’s own profile', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q('select * from public.link_profile()');
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, ids.parentA);
      assert.equal(rows[0].role, 'parent');
    });

    it('claims a school-provisioned profile on first sign-in', async () => {
      // The parent the school created but who has never signed in. Read as the
      // owner: a signed-in parent cannot see other profile rows, by design.
      await h.asOwner();
      const before = await h.q('select auth_id from public.profiles where id = $1', [ids.pendingParent]);
      assert.equal(before[0].auth_id, null, 'starts unclaimed');

      await h.asUser(ids.emails.pendingParent);
      const rows = await h.q('select * from public.link_profile()');
      assert.equal(rows.length, 1, 'the profile is claimed by the matching email');

      await h.asOwner();
      const after = await h.q('select auth_id from public.profiles where id = $1', [ids.pendingParent]);
      assert.ok(after[0].auth_id, 'and is now bound to the auth user');
    });

    it('returns nothing when the auth user has no school profile', async () => {
      await h.asUser(ids.emails.pendingParent);
      const rows = await h.q(`select * from public.link_profile()`);
      assert.equal(rows.length, 1, 'the already-linked profile is returned');

      // An auth user whose email matches no profile row.
      await h.asOwner();
      const { rows: [authUser] } = await h.db.query(
        `insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@example.com') returning id`,
      );
      await h.asUser('stranger@example.com');
      assert.equal((await h.q('select * from public.link_profile()')).length, 0);
      assert.ok(authUser.id);
    });

    it('refuses to run for an anonymous caller', async () => {
      await h.asAnon();
      const res = await h.attempt('select * from public.link_profile()');
      assert.equal(res.ok, false);
    });
  });

  describe('list_contacts — who the app may write to', () => {
    it('gives a parent their child’s teachers, and the school office', async () => {
      await h.asUser(ids.emails.parentA);
      const rows = await h.q('select * from public.list_contacts()');
      // Their child's teacher, the office, and the administration — the people a
      // parent may write to. Never another family.
      assert.deepEqual(
        rows.map(r => r.id).sort(),
        [ids.teacherA, ids.office, ids.admin].sort(),
      );
      assert.equal(rows.filter(r => r.role === 'parent').length, 0, 'never another family');
      assert.ok(!rows.some(r => r.id === ids.teacherB), 'nor another class’s teacher');
    });

    it('gives a teacher their families and the rest of the staff', async () => {
      await h.asUser(ids.emails.teacherA);
      const rows = await h.q('select * from public.list_contacts()');
      const parents = rows.filter(r => r.role === 'parent').map(r => r.id);
      assert.deepEqual(parents, [ids.parentA], 'their own class only');
      assert.ok(rows.some(r => r.role === 'office'), 'and the office is reachable');
      assert.ok(!rows.some(r => r.id === ids.parentB), 'never another class’s families');
    });

    it('gives a teacher the families in their class only', async () => {
      await h.asUser(ids.emails.teacherA);
      const rows = await h.q("select * from public.list_contacts() where role = 'parent'");
      assert.deepEqual(rows.map(r => r.id), [ids.parentA]);
    });

    it('gives the office the directory', async () => {
      await h.asUser(ids.emails.office);
      assert.ok((await h.q('select * from public.list_contacts()')).length >= 5);
    });

    it('excludes the caller from their own contact list', async () => {
      await h.asUser(ids.emails.office);
      const rows = await h.q('select * from public.list_contacts()');
      assert.ok(!rows.some(r => r.id === ids.office));
    });
  });

  describe('send_message', () => {
    it('stamps the sender from the session and returns the new id', async () => {
      await h.asUser(ids.emails.parentA);
      const [row] = await h.q('select public.send_message($1, $2, $3) as id', [
        ids.teacherA, 'Uniform', 'Can we collect it on Friday?',
      ]);
      assert.ok(row.id, 'an id comes back to the app');

      await h.asOwner();
      const [stored] = await h.q('select "senderId", "recipientId", subject from public.messages where id = $1', [row.id]);
      assert.equal(stored.senderId, ids.parentA, 'the sender is the caller, not what the client sent');
      assert.equal(stored.recipientId, ids.teacherA);
    });

    it('lets a parent write to the school office and back', async () => {
      await h.asUser(ids.emails.parentA);
      const toOffice = await h.attempt('select public.send_message($1, $2, $3)', [
        ids.office, 'Account request', 'Please close my account.',
      ]);
      assert.equal(toOffice.ok, true, toOffice.error?.message);

      await h.asUser(ids.emails.office);
      const toParent = await h.attempt('select public.send_message($1, $2, $3)', [
        ids.parentA, 'Re: Account request', 'We will call you this week.',
      ]);
      assert.equal(toParent.ok, true, toParent.error?.message);
    });

    it('refuses a recipient outside the caller’s relationships', async () => {
      await h.asUser(ids.emails.parentA);
      const cases = [
        [ids.teacherB, 'not_allowed', 'another class’s teacher'],
        [ids.parentB, 'not_allowed', 'another parent'],
        ['no-such-profile', 'unknown_recipient', 'an id that does not exist'],
        [ids.parentA, 'invalid_recipient', 'themselves'],
      ];
      for (const [recipient, expected, description] of cases) {
        const res = await h.attempt('select public.send_message($1, $2, $3)', [recipient, 'Subject', 'Body']);
        assert.equal(res.ok, false, `${description} must be refused`);
        assert.match(res.error.message, new RegExp(expected), `${description}: ${res.error.message}`);
      }
    });

    it('rejects empty content and over-long content', async () => {
      await h.asUser(ids.emails.parentA);
      const empty = await h.attempt('select public.send_message($1, $2, $3)', [ids.teacherA, '   ', 'Body']);
      assert.match(empty.error.message, /empty_subject/);

      const long = await h.attempt('select public.send_message($1, $2, $3)', [ids.teacherA, 'Subject', 'x'.repeat(5001)]);
      assert.match(long.error.message, /too_long/);
    });

    it('refuses to run for an anonymous caller', async () => {
      await h.asAnon();
      const res = await h.attempt('select public.send_message($1, $2, $3)', [ids.teacherA, 'S', 'B']);
      assert.equal(res.ok, false);
    });
  });

  describe('mark_message_read', () => {
    it('marks only the caller’s own incoming message', async () => {
      await h.asOwner();
      await h.q(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-to-parent', $1, $2, 'Notice', 'Body')`,
        [ids.teacherA, ids.parentA],
      );

      await h.asUser(ids.emails.parentA);
      await h.q('select public.mark_message_read($1)', ['m-to-parent']);
      await h.asOwner();
      const [marked] = await h.q(`select "readAt" from public.messages where id = 'm-to-parent'`);
      assert.ok(marked.readAt, 'the recipient can mark it read');
    });

    it('does nothing when the caller is not the recipient', async () => {
      await h.asOwner();
      await h.q(
        `insert into public.messages (id, "senderId", "recipientId", subject, body)
         values ('m-other', $1, $2, 'Not yours', 'Body')`,
        [ids.teacherA, ids.parentB],
      );

      await h.asUser(ids.emails.parentA);
      await h.q('select public.mark_message_read($1)', ['m-other']);
      await h.asOwner();
      const [row] = await h.q(`select "readAt" from public.messages where id = 'm-other'`);
      assert.equal(row.readAt, null, 'another family’s message is untouched');
    });
  });

  describe('push token', () => {
    it('stores and clears the caller’s own token, in the column delivery reads', async () => {
      // The project has two token columns. The app registers an *Expo* token
      // (getExpoPushTokenAsync) and the delivery function reads `expo_push_token`,
      // so that is the one the app writes. `fcm_token` belongs to another flow and
      // must be left untouched.
      await h.asOwner();
      await h.q(`update public.profiles set fcm_token = 'legacy-fcm-token' where id = $1`, [ids.parentA]);

      await h.asUser(ids.emails.parentA);
      await h.q(`select public.set_push_token($1)`, ['ExponentPushToken[test]']);
      await h.asOwner();
      const [stored] = await h.q('select expo_push_token, fcm_token from public.profiles where id = $1', [ids.parentA]);
      assert.equal(stored.expo_push_token, 'ExponentPushToken[test]', 'the Expo token goes to expo_push_token');
      assert.equal(stored.fcm_token, 'legacy-fcm-token', 'and fcm_token is not ours to write');

      await h.asUser(ids.emails.parentA);
      await h.q('select public.clear_push_token()');
      await h.asOwner();
      const [cleared] = await h.q('select expo_push_token, fcm_token from public.profiles where id = $1', [ids.parentA]);
      assert.equal(cleared.expo_push_token, null, 'sign-out clears it, so a handed-on phone stops receiving');
      assert.equal(cleared.fcm_token, 'legacy-fcm-token', 'still untouched');
    });

    it('rejects an empty token', async () => {
      await h.asUser(ids.emails.parentA);
      const res = await h.attempt(`select public.set_push_token($1)`, ['   ']);
      assert.match(res.error.message, /empty_token/);
    });
  });

  describe('account deletion (request only)', () => {
    it('records a request without deleting anything', async () => {
      await h.asUser(ids.emails.parentB);
      await h.q('select public.request_account_deletion($1)', ['Moving abroad']);

      await h.asOwner();
      const rows = await h.q('select * from public.account_deletion_requests where "profileId" = $1', [ids.parentB]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].status, 'requested');
      assert.equal(rows[0].reason, 'Moving abroad');

      const [stillThere] = await h.q('select count(*)::int as n from public.profiles where id = $1', [ids.parentB]);
      assert.equal(stillThere.n, 1, 'the account is untouched until the office acts');
      const [kids] = await h.q(
        'select count(*)::int as n from public.students where "parentId" = $1', [ids.parentB],
      );
      assert.equal(kids.n, 1, 'and the family’s children stay linked');
    });

    it('refuses an empty or anonymous request', async () => {
      await h.asAnon();
      assert.equal((await h.attempt(`select public.request_account_deletion($1)`, ['x'])).ok, false);
    });

    it('keeps the request trail away from other families', async () => {
      await h.asUser(ids.emails.parentA);
      const res = await h.attempt('select * from public.account_deletion_requests');
      assert.ok(!res.ok || res.rows.length === 0, 'only administrators read the trail');

      await h.asUser(ids.emails.admin);
      assert.ok((await h.q('select id from public.account_deletion_requests')).length >= 1, 'an admin can');
    });

    it('offers no self-service delete, because the school manages accounts', async () => {
      // Guards the decision recorded in docs/account-deletion.md and in the
      // school's published privacy policy §11. If a future change adds a
      // self-service delete, this test should be the thing that stops it and
      // forces the Play requirement to be revisited first.
      await h.asOwner();
      const rows = await h.q(
        `select proname from pg_proc
         where pronamespace = 'public'::regnamespace
           and proname in ('delete_my_account', 'delete_account', 'close_my_account')`,
      );
      assert.deepEqual(rows.map(r => r.proname), [], 'no account-deleting function may exist');
    });
  });
});
