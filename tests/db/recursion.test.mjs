/**
 * Regression test for the sign-in failure:
 *
 *   "Unable to load profile: infinite recursion detected in policy for relation profiles"
 *
 * Cause: rules added during remediation put queries on the `profiles` table
 * (`current_profile_role()`, and joins to `students`/`class_subjects`), so
 * deciding whether `profiles` may be read required reading `profiles`. The
 * project's helpers run as the caller, so row level security applies inside them,
 * and the loop never terminates.
 *
 * The pre-fix state cannot be *executed* in a test: the loop overflows Postgres'
 * own error stack and PANICs the in-process database, which took the other DB
 * suites down with it. So this suite asserts the shape statically (no policy on
 * `profiles` may query a table) and then exercises the paths the website uses on
 * sign-in, which is what broke. It runs on every test run.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDb, NEW_MIGRATIONS } from './harness.mjs';

const after = NEW_MIGRATIONS;

/** What the website does on sign-in: load the signed-in user's own profile. */
const loadOwnProfile = async h => {
  await h.asUser('parent.a@example.com');
  return h.attempt(`select id, name, role from public.profiles where auth_id = auth.uid()`);
};

/** The sign-in screen also builds the child list from the same session. */
const loadChildren = async h => {
  await h.asUser('parent.a@example.com');
  return h.attempt('select id, name from public.students');
};

describe('profile policy recursion', () => {
  it('guards the shape that caused it: no policy on profiles may read a table', async () => {
    // Running the pre-fix scenario is not an option: the recursion overflows
    // Postgres' own error stack and PANICs the test database, taking other test
    // files down with it. The defect is a *shape*, so assert the shape instead —
    // this is a static check of the policies that actually exist, and it fails
    // for any future rule that puts a query back on the policy path.
    const h = await createDb({ migrations: after });
    try {
      await h.asOwner();
      const policies = await h.q(
        `select policyname, qual, with_check from pg_policies
         where schemaname = 'public' and tablename = 'profiles'`,
      );
      assert.ok(policies.length > 0, 'profiles has policies');

      for (const policy of policies) {
        for (const expression of [policy.qual, policy.with_check].filter(Boolean)) {
          // A rule may not mention another relation. Calling a SECURITY DEFINER
          // helper is fine (it leaves row level security); a subquery is not.
          assert.ok(
            !/\b(select|from|join)\b/i.test(expression),
            `${policy.policyname} must not query a table: ${expression}`,
          );
        }
      }

      // And the delegation must exist, or the rules above have nothing to call.
      const [fn] = await h.q(
        `select prosecdef from pg_proc
         where proname = 'can_read_profile' and pronamespace = 'public'::regnamespace`,
      );
      assert.ok(fn, 'can_read_profile must exist');
      assert.equal(fn.prosecdef, true, 'and must run as its owner');
    } finally {
      await h.db.close();
    }
  });

  it('signs the parent in once the fix is applied', async () => {
    const h = await createDb({ migrations: after });
    try {
      const res = await loadOwnProfile(h);
      assert.equal(res.ok, true, res.error?.message);
      assert.equal(res.rows.length, 1);
      assert.equal(res.rows[0].id, h.ids.parentA);
    } finally {
      await h.db.close();
    }
  });

  it('resolves every screen that reads a profile through a relation', async () => {
    const h = await createDb({ migrations: after });
    try {
      // A parent reading their child's teacher (messages, contacts).
      await h.asUser(h.ids.emails.parentA);
      const teacher = await h.q(`select id from public.profiles where id = $1`, [h.ids.teacherA]);
      assert.equal(teacher.length, 1);

      // A teacher reading a family in their class.
      await h.asUser(h.ids.emails.teacherA);
      assert.equal((await h.q(`select id from public.profiles where id = $1`, [h.ids.parentA])).length, 1);

      // The office reading the directory.
      await h.asUser(h.ids.emails.office);
      assert.ok((await h.q('select id from public.profiles')).length >= 5);
    } finally {
      await h.db.close();
    }
  });

  it('still denies what it always denied', async () => {
    const h = await createDb({ migrations: after });
    try {
      // A parent must not reach another family or another class's teacher.
      await h.asUser(h.ids.emails.parentA);
      assert.equal((await h.q('select id from public.profiles where id = $1', [h.ids.parentB])).length, 0);
      assert.equal((await h.q('select id from public.profiles where id = $1', [h.ids.teacherB])).length, 0);

      // A teacher must not reach another class's families.
      await h.asUser(h.ids.emails.teacherA);
      assert.equal((await h.q('select id from public.profiles where id = $1', [h.ids.parentB])).length, 0);

      // Nobody signed in gets nothing.
      await h.asAnon();
      const anon = await h.attempt('select id from public.profiles');
      assert.ok(!anon.ok || anon.rows.length === 0, 'anon reads no profiles');
    } finally {
      await h.db.close();
    }
  });

  it('keeps the rule that decides profile reads out of the caller’s reach', async () => {
    const h = await createDb({ migrations: after });
    try {
      await h.asOwner();
      const [fn] = await h.q(
        `select prosecdef, proconfig from pg_proc
         where proname = 'can_read_profile' and pronamespace = 'public'::regnamespace`,
      );
      assert.ok(fn, 'can_read_profile must exist');
      assert.equal(fn.prosecdef, true, 'it must run as its owner, or the recursion returns');

      // And the project's helpers must stay exactly as they are: invoker.
      const [helper] = await h.q(
        `select prosecdef from pg_proc
         where proname = 'current_profile_role' and pronamespace = 'public'::regnamespace`,
      );
      assert.equal(helper.prosecdef, false, 'the fixture models the helpers as the caller runs them');
    } finally {
      await h.db.close();
    }
  });
});
