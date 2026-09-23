# Security model

Status of this document: it describes the model the code and the database rules
are written against, what is verified, and what is still open. It is reviewed
whenever a policy, a function or an access rule changes.
Last updated: 2026-09-23.

## 1. Identity

```
auth.uid()             the signed-in Supabase Auth user (uuid)
profiles.auth_id       the ONLY link between an auth user and a school profile
profiles.id            the school's business id (text). Every reference in the
                       database points here: students."parentId", exams."parentId",
                       messages."senderId"/"recipientId", class_subjects."teacherId"
current_profile_id()   auth.uid() -> profiles.id      (helper, SECURITY DEFINER)
current_profile_role() auth.uid() -> profiles.role    (helper)
```

`profiles.id` is deliberately unrelated to auth. Rules that compare
`profiles.id = auth.uid()::text` never match in this data (0 of 604 rows), which
is why new rules use `current_profile_id()`.

Sign-in is real Supabase Auth (`signInWithPassword`). Passwords are never stored
by the app. The session is kept in `AsyncStorage` (see §5), and the app resolves
its own profile through the database rather than trusting anything stored locally.

## 2. Who uses this app

**Parents only.** The database also holds `teacher`, `supervisor`, `office` and
`admin` accounts, but those belong to the school's own systems. Consequences:

- the app refuses to complete a sign-in for any role other than `parent`, and
  signs the session back out (`context/AuthContext.tsx`);
- every rule this project adds is scoped to the parent of the child, or to the
  parent's own rows — nothing is added to widen access for staff tiers;
- staff policies are left exactly as the school has them (additive rule).

## 3. The parent's reachability

A signed-in parent can reach:

| Data | Rule |
| --- | --- |
| their own profile row | policy on `profiles.auth_id = auth.uid()` / own row |
| their own children | `students_parent_read` (`"parentId" = current_profile_id()`) |
| marks | `exams."exam_select_authorized"` (`"parentId" = current_profile_id()`) — pre-existing, unchanged |
| attendance, homework, quizzes, quiz attempts, enrolments, releases | pre-existing parent policies, unchanged |
| report comments | `report_comments_parent_read` (added: the pre-existing rule compared against the auth uid and never matched) |
| their own messages | `messages_participant_read` (added: the table had no policy at all) |
| class announcements | `announcements_parent_read` + `announcement_recipients_parent_read` (added) |
| quiz questions of their children's quizzes | `quiz_questions_parent_read` (added) |
| the school calendar | `academic_years_read` (added) |

Writes by a parent are limited to their own learning progress and quiz attempts.
Messages are written only through the `send_message()` function, never by direct
table write, because a sender identity must not come from the client.

## 4. What is verified, and what is not

- **Verified by test only against a fixture.** `tests/db/baseline.test.mjs`
  proves the fixture is the real shape; the suites that assert rule behaviour
  (`security`, `messaging`, `quiz`, `account-deletion`, `schema`) are marked
  `.pending.mjs` because they were written for the repository's old schema. They
  are not counted as evidence until rewritten on the production baseline.
- **Verified against the live project by inspection only.** The policy audit in
  `docs/schema.md` §6 is based on the `pg_policies` export the school provided.
  Two critical findings were closed by the files listed there; the rest of the
  findings are open and documented.
- **Not verified:** whether RLS is switched *on* for every table
  (`docs/schema.md` §7 needs one more query). A policy on a table with RLS off
  does nothing, so this determines whether the messages/announcements data is
  actually protected.

## 5. Device storage, backup and session policy

- **Session storage.** Supabase session (access + refresh token) lives in
  `AsyncStorage`, which is unencrypted app-private storage. It is readable by
  another process only on a rooted device or via device backup — see below.
- **`android.allowBackup` is set to `false`** in `app.json` (Android default is
  `true`). Reason: with backup on, a parent's cloud backup contains the stored
  session, and restoring that backup onto a second-hand phone with the same
  Google account restores the session too. The cost is small and visible: after
  switching phones a parent signs in again, and the push token is re-registered
  on first launch. If the school would rather have backup (for example to restore
  lesson progress), the alternative is to keep `allowBackup: true`, store nothing
  auth-bearing in `AsyncStorage`, and rely on refresh-token rotation — that is a
  bigger change than it sounds, so the current choice is the conservative one.
- **Sign-out** clears the cache in `AsyncStorage`, calls `clear_push_token` so a
  used phone stops receiving the previous parent's notifications, and ends the
  Supabase session.
- **Auth strength is not weakened anywhere.** No `expo-dev-client` shortcut is in
  a production path (the package is inert in release builds), no security flag is
  relaxed, and no client can write the `profiles` table at all after
  `20260923102000_tighten_open_policies.sql`.

## 6. Known limitations (stated, not hidden)

1. **Quiz answer keys ship to the client.** The quiz screen grades answers in the
   app, so `quiz_questions."correctAnswerSnapshot"` is readable by the family it
   is issued to. Fixing it means server-side grading (an RPC that compares answers
   and returns a score). Row access is already class-scoped, so no other class's
   data is reachable.
2. **The live project's remaining open findings** are listed in
   `docs/schema.md` §6 — notably tables with no policy at all and the possibility
   that RLS is off for them.
3. **Web and app share one database.** Any change to who can read a row changes
   the website too. All changes so far were additive for that reason; the two
   drops were paired with replacements in the same change set.
4. **The full test matrix is pending** (`tests/db/README.md`). Until those suites
   are rewritten on the production baseline, treat rule-level behaviour as
   inspected, not proven.

## 7. Secrets

- `.env`, `google-services.json` and the Firebase admin SDK key are **not** in the
  repository (removed, and `.gitignore` extended). They exist on the developer
  machine only.
- The edge function reads its service-role key from the environment
  (`SUPABASE_SERVICE_ROLE_KEY`), never from a file in the repo, and refuses to log
  tokens.
- Rotation of the exposed keys is a manual step and must be done before any
  history rewrite: see `docs/play-store-readiness.md` §Manual tasks.
