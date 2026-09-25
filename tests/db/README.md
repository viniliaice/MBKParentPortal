# Database tests

Everything here runs against a **disposable** PGlite database: `harness.mjs`
boots the school's real schema from `fixtures/production-baseline.sql`, applies
the migrations under test, emulates the Supabase pieces the SQL depends on
(`auth.uid()`, `auth.jwt()`, the `anon`/`authenticated`/`service_role` roles, a
`net.http_post` stub) and seeds one small school. No test ever touches the
project.

```bash
npm test                 # runs every *.test.mjs (currently baseline.test.mjs)
node --test tests/db/baseline.test.mjs
```

## Why some suites are named `.pending.mjs`

`security`, `messaging`, `quiz`, `account-deletion` and `schema` were written
against the schema this repository *claimed* (uuid primary keys, `class_name`,
`lesson_progress`, no live policies). The real database is different:

- primary keys are `text` and `profiles.id` is a school **business id**, never
  the auth uid (`profiles.auth_id` is the only auth link);
- `profiles.role` is constrained to `admin | teacher | parent | supervisor | office`;
- staff classes live in `profiles."assignedClasses"` (jsonb) and `class_subjects`;
- quizzes use `questionOrder ∈ {created, randomized}`; `quiz_attempts` has no
  `parentId`;
- the live project already has policies, and this work is additive.

A green suite against the wrong schema is worse than no suite, so those files are
kept as a statement of intent and excluded from `npm test` until they are
rewritten on the production baseline. `baseline.test.mjs` is the guard that the
fixture itself is the real shape: if it fails, nothing else in this directory
means anything.
