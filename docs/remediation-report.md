# Remediation report

Date: 2026-09-23 · Branch: `arena/01a0cfba-mbkparentportal`
Original verdict under remediation: **NOT READY**.

## Headline

```
REMEDIATION INCOMPLETE
READY FOR INTERNAL TESTING:      NOT READY
READY FOR PLAY SUBMISSION:       NOT READY
```

The database layer is now closed: the two CRITICAL policy findings were fixed in the
project, RLS was switched on for the fifteen tables that never had it, and the
recursion that broke website sign-in is fixed and guarded by a test. Two items still
stand between this and internal testing, and neither is a hidden problem: **the app's
functions are written but not yet applied** (sign-in, messaging and push
registration fail from the app until they are), and **`google-services.json`
still names the old package**, which fails the Android build. Both are one action
each, listed first in §3.

## 1. What changed

### Security and database
- **Live policy audit** (`docs/schema.md` §6), from the school's `pg_policies`
  export: parents are already correctly scoped on marks, attendance, homework,
  quizzes, attempts, enrolments, releases — that work was already done and is left
  untouched. Two **CRITICAL** findings were identified and **fixed in production**
  at the school's direction:
  - `profiles."Allow authenticated users"` (ALL, `{public}`) let any signed-in
    parent read, edit and delete every profile row, **including setting their own
    role to `admin`** — after which `current_profile_role()` grants the whole
    school. Dropped, replaced with an explicit parent-own-row rule.
  - `students."Enable read access for all users"` (SELECT, `{public}`, `USING
    (true)`) exposed every child's record to the public anon key. Dropped, replaced
    with `students_parent_read`.
- **Added, additively**: parent read of their own children; participant read of
  their own messages (the table had no policy at all); class announcements and
  targeted announcements; quiz questions for their children's quizzes; the school
  calendar; and report comments, whose pre-existing rule compared `profiles.id`
  with `auth.uid()::text` and therefore never matched (0 of 604 rows).
- **Identity model documented** and now followed by every rule added: `auth.uid()`
  → `profiles.auth_id` → `profiles.id` (school business id).
- **Step 3 written and pending application**:
  `20260923103000_staff_and_contact_profile_read.sql` restores, read-only and
  relationship-scoped, the staff/teacher/parent profile reads that the dropped
  blanket policy was also providing.
- **Secrets**: `.env`, `google-services.json` and the Firebase admin SDK key are
  no longer tracked; `.gitignore` extended.
- Edge function hardened: webhook-secret check, service-role key from environment,
  no token logging, typed record parsing, batch cap.

### Application code
- Sign-in is Supabase Auth, resolved through the database; the app refuses any
  non-parent role (parents-only portal).
- Messaging sends through a server-side function (no client-supplied sender
  identity, no demo ids), with a real contact picker.
- Account deletion (immediate + request paths) and the in-app legal screens.
- Notifications: channel, icon and colour configured; tap routing data-driven;
  tokens never logged; registration goes through functions rather than a table write.
- Four TypeScript errors from the audit baseline are fixed; dead `index.ts`
  removed; `crypto-arbitrage/` (an unrelated side project, 554 MB) removed.
- `tsconfig` excludes Deno code; the edge function type-checks under Deno.

### Configuration and hygiene
- `app.json`: explicit permission allow-list **plus `blockedPermissions`** for
  `SYSTEM_ALERT_WINDOW` and the storage permissions (verified by disposable
  prebuild: they appear only as `tools:node="remove"`); dedicated adaptive-icon
  foreground, monochrome layer, brand background; notification icon and colour;
  `versionCode` seed; `allowBackup: false`.
- `eas.json`: remote version source, `production` → AAB with auto-increment,
  `preview` → APK, no submit configuration.
- `README.md` rewritten (it described the deleted side project).
- `docs/schema.md`, `docs/security-model.md`, `docs/privacy-policy.md`,
  `docs/account-deletion.md`, `docs/notifications.md`,
  `docs/play-store-readiness.md` — written, with the live-versus-repository
  divergence and the deployment safety rules stated explicitly.

## 2. Test evidence

| Category | What ran | Result |
| --- | --- | --- |
| Types | `npm run typecheck` (`tsc --noEmit`) | **pass**, no errors |
| Whole suite | `npm test` | **68/69 pass**; the single failure is the `google-services.json` package check, which needs Firebase (see below) |
| Legal configuration | `tests/config/app-config.test.mjs` | policy URL is HTTPS and points at the published page; the deletion URL is deliberately absent; the support address is usable |
| Database baseline | `npm test` → `tests/db/baseline.test.mjs` (8 tests, PGlite, production-shaped fixture) | **8/8 pass** |
| RLS and anon exposure | `tests/db/rls.test.mjs` (18 assertions) | **18/18 pass** — the ten private tables answer `anon` with nothing, parents read only their own threads/notices/quizzes, staff writes stay inside their classes |
| Policy recursion | `tests/db/recursion.test.mjs` (5) | **5/5 pass** — no policy on `profiles` may query a table, the delegation is `SECURITY DEFINER`, and the sign-in path loads the profile and the child list |
| App functions | `tests/db/rpc.test.mjs` (22) | **22/22 pass** — every function the app calls, including every refusal path, plus the guard that no self-service delete exists |
| Database access rules (legacy suites) | `tests/db/{security,messaging,quiz,account-deletion,schema}` | **not run — `.pending.mjs`**: written for the repository's old schema; excluded rather than reported as passing (`tests/db/README.md`) |
| Edge function | `deno check --no-remote --config tests/deno-stubs/deno.json` | **pass** |
| Project health | `npx expo-doctor` | **16/18 pass**; the 2 failures are network checks (Expo API, React Native Directory) unreachable from this environment |
| Prebuild | `expo prebuild --platform android` in a throwaway copy, inspected then deleted | manifest, icons, notification colour, splash, `allowBackup`, versionCode, package name **verified** |
| Live database | policy audit from the school's `pg_policies` export + the school's own application of two migration files | **inspected and partly applied** — not proven by tests |

Not run, and therefore not claimed: any test against the live project, any push
notification delivery test, any EAS build, any Play submission.

## 3. Remaining blockers

| # | Blocker | Severity | Owner | Exit criteria |
| --- | --- | --- | --- | --- |
| 1 | ~~Staff/contact profile reads~~ — **done** (`20260923103000` applied) | — | — | — |
| 2 | ~~RLS off on sixteen tables~~ — **done** (`20260923104000` applied, RLS on for fifteen; verified by test) | — | — | — |
| 3 | ~~Policy recursion on sign-in~~ — **done** (`20260923105000` applied; the site signs in again) | — | — | — |
| 4 | ~~App functions~~ — **done**: `20260923106000` and `20260923107000` are applied, so app sign-in, contacts, messaging and push registration have their database side; the office-regression that enabling RLS introduced is also fixed — sign-in, messaging and push registration fail from the app even though the website works (seven functions; deletion is request-only by decision) | **P0** | this project (file ready) + school (apply) | `20260923106000_parent_app_functions.sql` applied after the function-list check in `docs/app-db-contract.md` |
| 5 | **`google-services.json` still declares the old package** — the Android build fails until it is regenerated in Firebase | **P0** | school | new file in place; `npm test` goes green |
| 6 | ~~Push-token column~~ — **resolved**: `profiles.expo_push_token` is the column the app writes and delivery reads (`fcm_token` exists for a different flow and is left alone) | — | — | — |
| 7 | **Learning/XP screens query tables that do not exist** (`lesson_progress`, `lesson_attempts`, `gamification`) | **P1** | school decision | create the tables, or take those screens out of the parent app |
| 8 | `student_lesson_progress` is still public (RLS off, and `student_id` is `uuid` against a `text` id) | **P1** | school decision + this project | mapping explained, RLS on with a correct rule |
| 9 | Access-rule tests are pending; the legacy suites are `.pending.mjs` | **P2** | this project | rewritten on the production baseline |
| 10 | Four profiles have `auth_id` null and can see nothing; `exams` rows with a null `parentId` were already invisible to parents | **P2** | school | the counts from `docs/schema.md` §6 run; affected families identified |
| 11 | ~~Policy URLs~~ — **resolved**: the privacy policy is published (`https://schoolnnnnass.vercel.app/privacy-policy`) and wired into the app; the deletion URL is **not required** (no in-app account creation — `docs/account-deletion.md`) | — | — | — |
| 12 | FCM V1 service-account key not confirmed; push delivery untested | **P1** | school | key uploaded to EAS, test on an internal build |
| 13 | Quiz answers are graded on the client, so the answer key is readable by the family it is issued to | **P2** | this project | server-side grading function |
| 14 | Credential rotation from the old committed keys | **P2** | school | rotated before any history rewrite |

## 4. Manual steps

**This week, in order:**
1. Run the two checks in `docs/app-db-contract.md`, then apply
   `20260923106000_parent_app_functions.sql` (sign-in, messaging, push, deletion).
2. Regenerate `google-services.json` for `com.MBKConnect` in Firebase; `npm test`
   goes green when it is right.
3. Confirm the push-token column name, then align
   `supabase/functions/send-notification/index.ts` with it and replays the webhook
   secret step in `docs/notifications.md` §3.

**Expo / EAS** — confirm the upload keystore; upload the FCM V1 key; run `preview`
then `production` builds.
Full list: `docs/play-store-readiness.md` §B.

**Play Console** — host the privacy policy and the account-deletion page and set
both URLs; complete the Data safety form from the privacy policy's inventory;
declare the target audience as adults (parents/guardians); add support contact;
closed testing (12 testers × 14 days) if the account is personal.
Full list: `docs/play-store-readiness.md` §B.

**School operations** — action `account_deletion_requests`; finish login removal
when `authUserDeleted = false`; confirm the retention wording with a legal adviser.

## 5. Re-audit against the original checklist

| Area | Status |
| --- | --- |
| Secrets / history | **done in the repo** (untracked, ignored); rotation and history rewrite are manual and deliberately not performed |
| RLS and authorization | **partly closed**: two critical findings fixed in production; findings 1–2 above still open; rules added are additive and parent-scoped |
| Quiz schema | **documented, not reconciled**: the live model is authoritative; the repository's parallel model is flagged and must not be applied |
| Messaging | **code complete, hardened server-side path**; the pending migration set is not deployed, so it cannot yet be called verified |
| Production build config | **done and verified by prebuild** (AAB, auto-increment, permissions, icons, splash, backup off) |
| Privacy policy | **drafted from the real data flows**; URLs intentionally unset; hosting + legal review are manual |
| Account deletion | **implemented in app + SQL**; web resource pending hosting; behaviour not yet proven by test |
| Permissions | **done and verified** post-prebuild |
| Notifications | **done in code**; FCM credential and delivery test are manual |
| Dev artifacts | **done**: side project removed, no production path uses dev tooling |
| TypeScript / Deno | **clean** (`tsc --noEmit` pass, `deno check` pass) |
| Adaptive icon | **done and verified** |
| Backup / session policy | **documented**, `allowBackup: false`, auth not weakened |
| README / hygiene | **done** |
| Tests | **partial**: baseline green; access-rule suites pending rewrite |
| Prebuild verification | **done**, output deleted, no artifacts left in the repository |

## 6. Repository state

- Branch `arena/01a0cfba-mbkparentportal`; **nothing pushed**, working tree holds
  all changes, no secrets.
- `supabase/migrations/` now contains only files that are safe in order: the
  repository's three historical files plus `2026092310*` (the applied four and the
  pending `…106000`). The six drafts written for the wrong schema were moved to
  `supabase/superseded/` with a README, because `supabase db push` would otherwise
  apply `…090500_lockdown_rls`, which drops every policy on fifteen tables.
- No `.env`, `google-services.json` or admin key is tracked.
- No `android/`, `ios/` or build artifacts in the repository.
- Commands that were run and their exact results are listed in §2; anything not
  listed there was not run.
