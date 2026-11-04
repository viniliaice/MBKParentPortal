# MBK Parent Portal

A React Native (Expo) app for the **parents and guardians** of MBK school pupils:
marks, attendance, homework, report comments, announcements, class quizzes and
messaging with the school.

**This app is for parent accounts only.** The database also holds teacher,
supervisor, office and administrator accounts, but those belong to the school's
own systems; the app refuses to complete a sign-in for any role other than
`parent`.

## Requirements

- Node 20+ and npm
- An Expo account with access to the EAS project (`extra.eas.projectId` in
  `app.json`)
- The school's Supabase project credentials (see below)

## Setup

```bash
npm install
cp .env.example .env      # if present; otherwise create .env (see the next section)
npm start                 # Expo dev server
npm run android           # build and run on an Android device or emulator
```

### Environment variables

The app reads two values, both from the school's Supabase project (Settings → API):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
```

`.env` is **git-ignored and must stay that way.** Never commit `.env`,
`google-services.json` or a Firebase admin key; see `docs/security-model.md` §7.

`google-services.json` must be available for Android builds (`app.json` points at
it) but is not part of the repository: either keep the Firebase download at the
project root when running `eas build` locally, or store it in the
`GOOGLE_SERVICES_JSON` EAS project secret for remote-triggered builds. It must
come from Firebase project `mbkconnect` (`project_id = mbkconnect`,
`storage_bucket = mbkconnect.firebasestorage.app`, package `com.MBKConnect`); the
pre-install hook verifies this on every build — see `docs/notifications.md` §2b.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Expo dev server |
| `npm run android` / `npm run ios` | Build and run on a device/emulator |
| `npm run web` | Web build (the app also runs in the browser) |
| `npm run typecheck` | `tsc --noEmit` — the standing code check |
| `npm test` | Database tests against a disposable in-process Postgres (PGlite) |
| `npm run doctor` | `expo-doctor` |

There is no linter configured in this project; `npm run typecheck` plus the tests
are the checks that exist.

## Layout

```
app/                 screens (expo-router); (tabs)/ is the signed-in shell
components/          shared UI
context/             AuthContext (Supabase Auth) and AppContext (data)
lib/                 supabase client and types, notifications, account deletion
constants/           theme, legal configuration (policy URLs)
assets/              icons, splash, notification icon
supabase/            migrations/ (versioned), functions/ (edge functions)
tests/db/            PGlite harness, production-shaped fixture, suites
docs/                schema, security model, privacy policy, deletion, notifications
okf/                 school knowledge documents used by the assistant features
```

## Database

The live database is the source of truth; `supabase/migrations/` is ordered and
`supabase/migration_quiz.sql` is superseded and must not be run (it is not a
migration and cannot execute).

**Nothing in `supabase/migrations/2026092309*` has been applied to the project.**
Those files were written against an earlier, different schema and carry a
not-verified banner; `docs/schema.md` explains exactly where they diverge and what
the live project actually looks like.

Rules the school has confirmed, and everything added since, are additive:
`docs/schema.md` §6 lists them, including the two open policies that were closed.

## Tests

```bash
npm test
```

Runs `tests/db/baseline.test.mjs` against a throw-away PGlite database loaded from
`tests/db/fixtures/production-baseline.sql` — the real schema shape. The suites
that assert access rules are currently named `*.pending.mjs`: they were written
for the old schema and are not counted until rewritten on the production
baseline. `tests/db/README.md` explains why. **No test touches the live project.**

## Security

Read `docs/security-model.md` first. In short: sign-in is Supabase Auth; access is
scoped per family in the database; the app never sends a sender identity, a role or
a parent id from the client; secrets are never committed.

## Related documents

- `docs/schema.md` — the live schema, the policy audit, deployment safety rules
- `docs/security-model.md` — identity, access, device/session policy, limitations
- `docs/privacy-policy.md` — data inventory (draft, needs hosting + legal review)
- `docs/account-deletion.md` — what deletion removes and what the school keeps
- `docs/notifications.md` — channels, tap routing, tokens, FCM credential step
- `AGENTS.md` — working rules for automated changes in this repository
