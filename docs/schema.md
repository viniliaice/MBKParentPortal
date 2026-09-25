# Schema notes — production vs. this repository

**Status: the migration set under `supabase/migrations/20260923*` was written against
the schema this repository recreates, and is NOT verified against production. Do not
apply it to production until the rework in "Required rework" below is done.**

This file records what production actually looks like (from the schema dump the school
provided) and where that diverges from the repository, so the difference is documented
rather than discovered during a deploy.

## 1. What production actually is

- **Primary keys are `text`, not `uuid`,** on every application table that was pasted:
  `profiles`, `students`, `exams`, `quizzes`, `quiz_questions`, `quiz_attempts`,
  `attendance`, `homework`, `announcements`, `academic_years`, `messages`.
  (`auth.users.id` is still `uuid`, and `profiles.auth_id` is `uuid` with a real FK —
  `fk_users_auth_id`.)
- **Column names are already the quoted camelCase the app uses** (`students."className"`,
  `students."parentId"`, `exams."studentId"`, `messages."senderId"`, `profiles."createdAt"`).
  The folding problem described in `20260923090000_schema_reconciliation.sql` is therefore
  a repository artefact, not a production condition. Every rename in that migration is
  guarded and becomes a no-op on production, which is the safe outcome — but it means
  the reconciliation does not solve a production problem.
- **A `id_migration_map (old_id text, new_id uuid, email)` table exists**, which suggests
  an id-migration has already happened (or was attempted) outside this repository.
- **Roles are constrained** by `profiles.role`:
  `admin | teacher | parent | supervisor | office`. `supervisor` and `office` are real
  tiers; the repository and my helpers know only `parent | teacher | admin`.
- **Staff responsibilities are data, not a column:** `profiles."assignedClasses"` (jsonb)
  and `profiles."assignedSubjects"` (jsonb). There is no `class_name` column, so
  `teacher_class()` as written in `20260923090300_auth_identity_model.sql` has nothing to
  read on production.
- **Families are modelled explicitly:** `students."familyId"` plus `students."parentPhone"`,
  `students."govId"`, `students.transport`. Parent↔child is not only
  `students."parentId"`.
- **Grades have a workflow:** `exams.status ∈ {pending, approved, rejected}`,
  `exams."assessmentLabel"`, `exams."entryState"`, `exams."uploadedBy"`,
  `grade_uploads`, `grade_correction_audit`, `report_comments`, `report_config`,
  `grade_scales`, `subjects`, `terms`, `class_subjects`, `student_enrollments`,
  `student_promotions`.
- **Quizzes already exist and differ from the repository's quiz model:**
  `quizzes.id text`, `"openDate" date NOT NULL`, `"dueDate" date NOT NULL`,
  `"questionOrder" ∈ {created, randomized}` (not `sequential | random`),
  `lesson_plan_id`, `auto_generated`; `quiz_questions` has **no `createdAt`** and
  `questionId NOT NULL`; `quiz_attempts` has **no `parentId`, no `createdAt`, no
  `gradedAt`, and no UNIQUE (quizId, studentId)**.
  A separate `student_lesson_progress` (per student, PK `(student_id, lesson_id)`) exists
  alongside the repository's `lesson_progress`.
- **Messaging:** `messages."senderId"/"recipientId"` are `text` **with real FKs to
  `profiles(id)`**, and there are no `senderName/recipientName/senderRole/recipientRole`
  columns. `announcement_recipients` exists for targeted announcements.
- **Other production tables not in this repository at all:** `terms`, `subjects`,
  `class_subjects`, `grade_scales`, `report_comments`, `report_config`,
  `announcement_recipients`, `audit_logs`, `id_migration_map`, `student_lesson_progress`,
  `lesson_plans`, `lesson_plan_periods`, `ai_reviews`, `ai_review_logs`,
  `lesson_period_ai_reviews`, `unit_plans`, `student_promotions`, `grade_uploads`,
  `release_log`, `authorized_pickups`, `authorized_pickup_students`,
  `student_enrollments`, `grade_correction_audit`, `student_merge_audit`,
  `student_merge_audits`, `student_merge_batches`.

The dump was explicitly labelled "for context only and is not meant to be run", and some
constraints are truncated in it (`NOT VALI`), so it cannot be executed as-is. It is
evidence of shape, not a migration script.

## 2. Where the current migration set breaks on production

| Migration | Statement | Effect on production |
| --- | --- | --- |
| `090000_schema_reconciliation` | the rename loop; `CREATE INDEX`; `COMMENT` | Safe (renames all no-op), but does nothing useful for production. |
| `090200_quiz_schema` | `ADD COLUMN quiz_attempts."parentId" uuid REFERENCES profiles(id)` | **Fails** — `profiles.id` is `text`. |
| | `create trigger set_quiz_attempt_parent` | **Fails at runtime** — assigns a `text` student parent id into a `uuid` column. |
| | `CHECK ("questionOrder" IN ('sequential','random'))` | **Fails** — production values are `created`/`randomized`. |
| | `ALTER COLUMN "questionOrder" SET DEFAULT 'sequential'` | Silently changes production behaviour. |
| | `UNIQUE INDEX ("quizId","studentId")` | New product rule, not a security fix; fails if duplicates exist. |
| | `ALTER COLUMN quiz_questions."questionId" DROP NOT NULL` | Relaxes a production integrity rule without evidence. |
| `090300_auth_identity_model` | `current_profile_id() RETURNS uuid` and friends | **Wrong type** on production (`profiles.id` is `text`); every policy built on it fails. |
| | `profiles.class_name` | Production stores `assignedClasses` jsonb instead. |
| | role list `parent/teacher/admin` | Ignores the live `supervisor` and `office` tiers. |
| `090500_lockdown_rls` | `DROP POLICY` for **every** policy in `pg_policies` on the app tables | **Destructive on production.** Production already has RLS; this would delete the school's existing policies (including anything for `supervisor`/`office`, `announcement_recipients`, the approval workflow) and replace them with ones written against a different schema. |
| `090910_messaging_rpc` | `p_recipient uuid`, `link_profile()` matching on `profiles.email` | Type mismatch on `uuid` parameters; the email/link logic may be fine but is unverified against production data. |
| `092000_account_deletion` | `retained_academic_records."studentId" uuid`, `quiz_attempts."parentId"` | Type mismatch (`text` vs `uuid`). |

**Consequence: the RLS work must be additive on production, not a replacement.** The
standing rules already forbid weakening access or guessing relationships; deleting live
policies would do both.

## 3. Required rework (before anything is applied)

1. **Re-baseline the test harness on the production shape.** The PGlite harness must be
   built from a sanitised production baseline (text ids, quoted camelCase, real roles,
   real FKs), not from the repository's historical migrations. Tests that pass against a
   schema production does not have prove nothing.
2. **Rewrite the identity helpers as type-agnostic.** `current_profile_id()` must return
   the same type as `profiles.id` (text on production), and the role vocabulary must be
   `admin | teacher | supervisor | office | parent` with an explicit statement of what
   `office` and `supervisor` may see.
3. **Derive the access model from production data, not from column names:**
   `profiles."assignedClasses"` (jsonb) and `students."familyId"` are the real
   relationships; `class_subjects.teacherId` and `student_enrollments` are the audit
   trail for who taught which class when.
4. **Make the RLS migration additive and auditable:** verify what exists, add only what is
   missing, never drop a policy that grants a legitimate path, and record an explicit
   inventory of production policies in this file once it is available.
5. **Keep the existing quiz contract** (`questionOrder ∈ {created, randomized}`, no
   `quiz_attempts.parentId`, integer scores) or change it deliberately with the school —
   not as a side effect of a security migration.
6. **Re-run every test in `tests/db/` against the production-shaped baseline** and record
   which of them still describe reality.

## 4. Access model: this app is for parents only

Confirmed by the school: **the portal is used by parents, and by nobody else.** The
teacher, supervisor, office and admin accounts in `profiles` belong to the school's own
systems, not to this app. That resolves what the extra tiers may see here — nothing:

- The app refuses to sign in a non-parent account (`context/AuthContext.tsx` signs the
  session straight back out with a plain explanation).
- The database enforces the same boundary independently: every rule this remediation
  adds is scoped to the parent of the child, or tied to the signing-in parent's own rows.
  Nothing is added to widen access for the staff tiers, and nothing that staff tooling
  already relies on is removed (additive rule).
- Consequence for the messaging work: the parent is always the sender (to the teacher of
  their child's class), and the parent is always the reader of their own thread. The
  staff-side of the conversation is out of scope for this client.
- `office` and `supervisor` therefore need no access decisions from this project; if the
  school ever wants them in the parent app, that is a new product decision, not an
  inferred permission.

## 5. Deployment safety — read before running anything

Real parents use the live system (website and app) to see their children's marks. Rules
for anything in this repository:

- **Nothing under `supabase/migrations/20260923*` may be applied to production yet.** The
  files carry the not-verified banner for that reason. They were written against the
  schema this repository recreates, not against production.
- **Never run the migration set for the first time on the live project.** The first run
  belongs on a copy: a restored backup in a separate project, or a Supabase branch. That
  copy is where the data-level effects below are observed.
- **Back up first, always.** Supabase dashboard → Database → Backups. A backup is also the
  rollback plan.
- **The website shares this database.** Anything that changes who can read a row changes
  what the website can read. Revoking the `anon` role, or replacing policies, can blank
  out a page that parents are using right now — so idempotent, additive changes only, and
  only after the current policies have been read (`pg_policies`).
- **Deploy in two steps, never one:** (1) additive objects only — new columns with
  defaults, new indexes, new functions, new policies that *add* a narrower parent-of-child
  path; (2) behaviour changes (defaults, NOT NULL, constraint tightening) only after the
  first step has been verified in production for a while.

Statements in the current files that would modify rows or behaviour if they were run
against production — each is a reason for the staging run, not a thing to fix blind:

| Statement | Effect on live data |
| --- | --- |
| `UPDATE public.quizzes SET "questionOrder" = ...` / `SET "createdAt" = now()` | writes to existing quiz rows |
| `UPDATE public.quiz_attempts SET "totalEarned" = score` | rewrites marks if those legacy columns exist |
| `ALTER COLUMN "questionOrder" SET DEFAULT 'sequential'` | changes what new quizzes get |
| `ALTER COLUMN "openDate"/"dueDate" DROP NOT NULL` | loosens a rule production enforces today |
| `ADD CONSTRAINT quizzes_question_order_check` (sequential/random) | **fails** on `created`/`randomized` rows |
| `CREATE UNIQUE INDEX ("quizId","studentId")` | **fails** if any student has two attempts |
| `DROP POLICY` loop in `20260923090500_lockdown_rls.sql` | deletes live access rules |
| `delete_my_account()` | deletes rows (login, messages, progress) — only when a parent asks |
| `students."parentId"` FK → `ON DELETE SET NULL` | changes what happens to a child's record when a parent account is removed |

## 6. Audit of the live policy set (pg_policies, pasted by the school)

**Applied to production so far (recorded here because these are live changes):**

| File | Status | Effect |
| --- | --- | --- |
| `20260923101000_parent_app_access.sql` | **applied** | added parent read for `students`, participant read for `messages`, class read for `announcements` / `announcement_recipients`, parent read for `quiz_questions`, read for `academic_years`. Added only. |
| `20260923102000_tighten_open_policies.sql` | **applied** | dropped `profiles."Allow authenticated users"` and `students."Enable read access for all users"`, and added `profiles_parent_read_own`. |
| `20260923103000_staff_and_contact_profile_read.sql` | **applied** | restores, read-only and relationship-scoped, the reads those two drops also removed. |
| `20260923104000_enable_rls_close_public_tables.sql` | **applied** | RLS on for the fifteen tables that never had it, with each table's rules. |
| `20260923105000_fix_profiles_policy_recursion.sql` | **applied** | fixes the sign-in recursion (see §6.4). |
| `20260923106000_parent_app_functions.sql` | **applied** | the seven functions the app calls, for the live schema. |
| `20260923107000_message_recipients.sql` | **applied** | restores the office's ability to send, and lets a parent reach the office. |

Verification for all of the above: `docs/post-apply-checks.md`.

### 6.1 Identity model (confirmed by the school) — and the rules that ignored it

The canonical chain, stated once so no future rule gets it wrong:

```text
auth.uid()            -- the signed-in Supabase Auth user (uuid)
profiles.auth_id      -- the ONLY auth link
profiles.id           -- the school's business id (text): students."parentId",
                         exams."parentId", messages."senderId" / "recipientId",
                         class_subjects."teacherId" and every other reference
                         all point at this, never at the auth uid
current_profile_id()  -- resolves auth.uid() -> profiles.id (business id)
current_profile_role()-- resolves auth.uid() -> profiles.role
```

`profiles.id` is *deliberately* unrelated to auth. Every rule added by
`20260923101000`, `20260923102000` and `20260923103000` uses
`current_profile_id()` / `current_profile_role()` only (13 and 11 uses
respectively, verified by grep) — no rule compares `auth.uid()` with
`profiles.id`, and the app follows the same chain (`link_profile()` returns
`profiles.id`, which the client passes as `parentId`).

The problem this section documents is that **some live policies use the other
convention**, so they never match:

```text
total 604 | has_auth_id 600 | id_is_auth_uid_text 0
```

`profiles.id = auth.uid()::text` is true for **no** row (0 of 604), so every policy
written in that convention is dead code. This is not a reason to change the
identity model — it is the model — it is a reason to rewrite those specific rules
the way the working ones are written. Concretely, these never matched anybody:

- `profiles."Users see own profile"` (`id = (auth.uid())::text`)
- `exams."Admins full access exams"` (`profiles.id = (auth.uid())::text`)
- `exams."Parents see own children exams"` (`students."parentId" = (auth.uid())::text`)
- `report_comments."Parents see own comments"` (same comparison) — **fixed** by
  `20260923103000`
- `students."Enable read access for all users"` was therefore the *only* reason
  parents could see their children's rows at all, which is why removing it had to
  be paired with `students_parent_read`.

What the dead rules did **not** break, because the newer policies use
`current_profile_id()` instead:

- marks — `exams."exam_select_authorized"` (`"parentId" = current_profile_id()`)
- attendance, homework, quizzes, quiz attempts, enrolments, releases

**Marks visibility for parents was not changed by this work at all**: no exam
policy was added or dropped, and the rule that serves parents
(`exam_select_authorized`) is the same one that served them before.
`auth_id` is present on 600 of 604 profiles; the 4 without it cannot resolve to a
profile and so see nothing (worth identifying — see the checks below).

### 6.2 Collateral of the drop, and the fix

`profiles."Allow authenticated users"` was the only rule letting staff read other
profiles, and the only rule letting a parent resolve a teacher's name (production
`messages` stores ids only). Removing it therefore also removed:

- staff reading the directory (teacher/office/supervisor screens),
- parent-facing name resolution on message and contact screens.

`20260923103000_staff_and_contact_profile_read.sql` restores both, read-only and
relationship-scoped. It is additive, so it is safe to apply immediately.


### Already correct — do not touch

Parents are properly scoped by the school's own policies on: `attendance`,
`homework`, `quizzes`, `quiz_attempts`, `student_enrollments`, `release_log`,
`report_comments` and `exams` ("Parents see own children exams"). They all follow
the shape `current_profile_role() = 'parent' AND <row> IN (own children)`. The
earlier plan to replace the policy set was wrong; it is additive from here.

Staff policies (teacher / supervisor / office / admin) are correct as far as this
audit is concerned and are out of scope: the portal is parents-only, so nothing is
added for staff and nothing of theirs is removed.

### Findings

| # | Table | Policy | What it allows | Severity |
| --- | --- | --- | --- | --- |
| A | `profiles` | `Allow authenticated users` (`{public}`, ALL, `auth.role() = 'authenticated'`) | **Any signed-in parent can read, edit and delete every profile row — including setting their own `role = 'admin'`, after which `current_profile_role()` hands them the whole school.** Privilege escalation, reachable from the app. | **CRITICAL** |
| B | `students` | `Enable read access for all users` (`{public}`, SELECT, `USING (true)`) | Every child's record — name, class, `parentId`, `parentPhone`, `govId`, `familyId` — readable by `anon`: anyone holding the public key that ships in the web page and app bundle. | **CRITICAL** |
| C | `messages` | none | No policy at all. If RLS is on, messaging cannot read a thread; if it is off (needs checking), every message is world-readable. Either way the parent app's messaging cannot work correctly today. | **HIGH** |
| D | `announcements`, `announcement_recipients`, `quiz_questions`, `academic_years`, `questions`, `student_lesson_progress`, `grade_uploads` | none | The same two possibilities as C, table by table. The app reads `announcements`, `quiz_questions` and `academic_years` directly. | **HIGH** |
| E | many tables | policies granted `TO public` instead of `TO authenticated` | Only dangerous where the rule is permissive (`USING (true)`, or a role check that cannot fail). The role-guarded ones are inert for `anon` because `auth.uid()` is null. Normalise as rules are touched, not in bulk. | **LOW** |
| F | identity convention | some policies compare `(auth.uid())::text` with `profiles.id`, others use `current_profile_id()` / `profiles.auth_id` | If `profiles.id` is not the auth uid text then one of the two families is silently inert: a parent screen that looks fine may return nothing, or a rule that looks enforced may not be. One check settles it (below). | **MEDIUM** |
| G | `student_lesson_progress.student_id` | `uuid` while `students.id` is `text` | The table cannot be joined to `students`. Also, the app reads `lesson_progress`, `lesson_attempts` and `gamification`, which are not in the production table list at all — the learning/XP screens have no tables behind them. | **MEDIUM** |

### 6.2b Findings C and D resolved: RLS was off on sixteen tables

The `relrowsecurity` listing came back `false` for these — meaning their policies
(where they existed at all) did nothing, every row was readable by the `anon` key,
and every row was **writable** by it:

```
messages · report_comments · announcements · announcement_recipients · questions
quiz_questions · ai_reviews · ai_review_logs · lesson_period_ai_reviews
id_migration_map · academic_years · terms · subjects · grade_scales
report_config · student_lesson_progress
```

`20260923104000_enable_rls_close_public_tables.sql` switches RLS on for fifteen of
them and supplies the rules each one needs — reads for the people who should have
them, writes restricted to the owner or the office, and the `anon` grants removed
from the private ones. It also revokes table-level `UPDATE` on `messages` so that
only `"readAt"` can ever be written (previously a participant could rewrite the
text of a conversation; the test caught that while the file was being written).

Verified by `tests/db/rls.test.mjs` (18 assertions) on the production-shaped
fixture with the live policies loaded: anon gets nothing from the ten private
tables, parents read only their own threads and their own class's notices, teachers
write only into their own classes and their own quizzes, the reference tables stay
readable to everyone as their live policies intend, and the staff reads that were
only working because RLS was off still work.

`student_lesson_progress` is deliberately **not** in that file: its `student_id` is
`uuid` while `students.id` is `text`, so there is no way to tell whose progress a
row is. Turning RLS on without knowing that mapping would break whatever reads it;
leaving it off keeps per-student progress public. Two answers are needed: which
device reads it, and what `student_id` points at.

### 6.4 The recursion, and the rule it established

Sign-in failed with *"infinite recursion detected in policy for relation
profiles"* after the first three files were applied. Cause: rules placed on
`profiles` called `current_profile_role()` (which reads `profiles`) and joined
`students`/`class_subjects` (whose rules call the helper, which reads `profiles`).
Nothing recursed before, because no policy on `profiles` read anything — the
`profiles` table was the one table where the helpers were safe.

`20260923105000` replaces those rules with a single policy delegating to
`can_read_profile(id)`, a `SECURITY DEFINER` function whose nested reads run as the
owner, so the loop cannot form. The access is unchanged (own row; admin, supervisor
and office read the directory; teacher reads their families; parent reads their
children's teachers).

**Rule going forward:** a policy on `profiles` must not query a table — put the
relationship in a `SECURITY DEFINER` function and call it. `tests/db/recursion.test.mjs`
asserts that shape statically, because *executing* the failure PANICs the test
database and takes other suites with it.

### 6.3 The fix, staged

1. `20260923101000_parent_app_access.sql` — applied (additive).
2. `20260923102000_tighten_open_policies.sql` — applied (drops findings A and B).
3. `20260923103000_staff_and_contact_profile_read.sql` — applied: restored
   staff directory reads (admin/supervisor/office), teacher→family reads,
   parent→teacher reads and the dead parent rule on `report_comments`.
4. `20260923104000_enable_rls_close_public_tables.sql` — **apply next**: switches
   RLS on for the fifteen tables listed in §6.2b and gives each one its rules.
   This is the file that closes the anon-key exposure; walk its verification
   checklist afterwards (parent messages, announcements, quiz, report card;
   teacher announcement/quiz/report writing; admin reference data), because it is
   the one change here that can deny access if a writer was not signed in.
5. Remaining decision: `student_lesson_progress` (§6.2b).

### Read-only checks still needed (safe to run any time)

```sql
-- 1. which tables actually have RLS switched on — THIS IS THE CRITICAL ONE.
--    A table with RLS off ignores its policies entirely, so the rules added in
--    step 1 do nothing there and the data stays readable by the anon key.
select relname, relrowsecurity, relforcerowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 2. do any marks have no parent link? (those were already invisible to parents
--    before this work, and still are — same policy — but the school should know)
select count(*) as total,
       count(*) filter (where "parentId" is null) as missing_parent_link
from exams;

-- 3. the four profiles with no auth_id: who are they?
select id, name, email, role from profiles where auth_id is null order by role;
select role, count(*) from profiles group by role order by role;

-- 3. the helpers the policies call, so the new rules reuse them (finding F)
select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('current_profile_id','current_profile_role','is_admin',
                    'can_submit_exam_target','link_profile','set_push_token');

-- 4. the whole table list (are the app's learning tables missing?)
select tablename from pg_tables where schemaname = 'public' order by tablename;
```

## 7. What is still needed from the school

- The **current RLS policies** on the production tables (`select tablename, policyname,
  roles, cmd, qual, with_check from pg_policies where schemaname = 'public'`), so the
  audit can check them rather than replace them. Additive-only work cannot start without
  knowing what is already there.
- Whether the **legacy anon-key build** (the app as originally shipped, before Supabase
  Auth) is still installed on parents' phones: that decides whether `anon` can be revoked
  outright or needs a migration window while parents update.
