# AGENTS.md — MBK Parent Portal

## Stack
Expo SDK 54, New Architecture (`newArchEnabled: true`), React 19.1, RN 0.81.5.
Expo Router v6, file-based, entry is `expo-router/entry`. Path alias `@/` -> project root.
Dark-only (`userInterfaceStyle: "dark"`); `constants/colors.ts` light and dark palettes
are identical — read from it, never hardcode hex.

Target SDK 54 APIs only. Do not suggest patterns from other SDK versions; if you are
unsure an API exists in 54, say so instead of guessing.

## Commands
```bash
npm start          # dev server  — DO NOT RUN, hangs the session
npm run ios        # native build — DO NOT RUN
npm run android    # native build — DO NOT RUN
npm run web        # DO NOT RUN
npx tsc --noEmit   # safe, use this to verify every change
```
Ask me to run anything long-lived and I will paste the output.
There is no lint, test, or format tooling. `npx tsc --noEmit` is your only check —
run it after every change and report the result.

## Structure
```
app/            Expo Router routes only. Default exports (Router requires it).
components/     Shared UI, PascalCase, one component per file.
contexts/       AuthContext, AppContext.
constants/      colors.ts and other static config.
data/           learningData.ts — hardcoded curriculum.
supabase/       migration.sql, functions/send-notification (Deno).
index.ts        DEAD CODE. Do not import, do not extend, do not "fix".
```
New shared component -> `components/`. New screen -> `app/`. Don't invent top-level dirs.
Outside `app/`, use named exports.

## State — read before adding any
All state is React Context: `AuthContext` + `AppContext`.
`AppContext` fetches everything in one `useEffect` + `Promise.all` on mount.
No pagination, no cache.

TanStack Query v5 is installed and the provider is mounted in `_layout.tsx`
but **nothing uses it**. Do not introduce `useQuery`/`useMutation` unless I explicitly
ask — adding one hook creates two competing data layers. Extend `AppContext` instead.

`expo-sqlite` is present only as a transitive dep of Supabase auth persistence.
Never import it directly.

AsyncStorage keys in use: `@mbk_auth_user`, `@mbk_learning_progress`, `@mbk_gamification`.
Reuse these; don't add new keys without telling me.

## Auth — known broken, do not spread
`AuthContext.tsx` looks up the email in the Supabase `profiles` table.
**The password argument is accepted and ignored — any email in the table logs in.**
This is a known defect, not a pattern.
- Do not copy this approach into any new flow.
- Do not "fix" it as a side effect of another task. If a change touches auth,
  stop and tell me first.

## Supabase
Tables: `profiles`, `students`, `exams`, `attendance`, `messages`, `announcements`.
Schema source of truth: `supabase/migration.sql` — update it in the same commit
as any query that assumes a new column.
Edge function: `supabase/functions/send-notification/` (Deno, calls Expo Push API).

## Curriculum
`data/learningData.ts`, ~800 lines, two subjects (Mathematics, English) -> topics ->
lessons -> activities. Activity types: `multipleChoice`, `tapCorrect`, `fillBlank`,
`dragOrder`, `matchPairs`, `numberLine`, `trueFalse`, `writing`.
New activity type = new union member + renderer + progress handling. Don't add one
without checking every switch on activity type.

## Platform rules
- Tab bar: `BlurView` on iOS, plain background on Android/Web. Keep the branch.
- Icons: `expo-symbols` (SF Symbols) on iOS, `@expo/vector-icons` Ionicons elsewhere.
  Any new icon needs both names or it renders blank on one platform.
- Scrolling forms: use `KeyboardAwareScrollViewCompat`, never the raw library component
  (it breaks on web).
- Web is a real target. Anything native-only needs a `Platform.OS` guard.

## Secrets — hard rules
`google-services.json` and a Firebase admin private key are committed and not gitignored.
This is a live incident, not a quirk.
- Never open, print, echo, or quote the contents of those files.
- Never add new credential files to the repo.
- Never `git add -A`; stage named paths only.

## OKF bundle
`okf/` directory at root — 14 concepts covering database, auth, state, learning, routing, platform UI.
Validated with `okf validate okf`. The companion skill is at `.claude/skills/okf/`.
Playbooks: `okf help`, or read `.claude/skills/okf/playbooks/produce.md` for the produce workflow.

## Working style
- Read the neighbouring files first and match their existing patterns over any
  general best practice. This codebase is not idiomatic and consistency beats purity.
- Small diffs. No drive-by refactors, no reformatting files you touch for other reasons.
- Ambiguous requirement -> ask one question before writing code.
- Don't commit unless I ask. Never push, never force-push, never amend.
- Comments explain *why*, never *what*.
- If you notice something broken that's out of scope, add it to a list at the end of
  your reply instead of fixing it.

# CRITICAL RULES - MUST FOLLOW

## RESPONSES

- Keep responses concise and to the point - unless the user asks otherwise

## PLANNING MODE

- Always ask clarifying questions
- Never assume design, tech stack or features
- Use deep-dive sub-agents to assist with research 
- Use deep-dive sub-agents to review the different aspects of your plan before presenting to the user

## CHANGE / EDIT MODE

- Never implement features yourself when possible - use sub-agents!
- Identify changes from the plan that can be implemented in parallel, and use sub-agents to implement the features efficiently
- When using sub-agents to implement features, act as a coordinator only
- Use the best model for the task - premium models for complex tasks (like coding) and mid-tier models for simpler tasks, like documentation
- After completing features (large or small), always run commands like lint, type check and next build to check code quality

## DATABASE SCHEMA CHANGES

- When changing the database schema, update `supabase/migration.sql` in the same commit as any query that assumes a new column
- Do NOT run migration tools directly — the Supabase project is remote

## TESTING

- Use any testing tools, libraries available to the project for testing your changes
- Never assume your changes simply work, always test!
- If the project does not have any testing tools, scripts, MCP tools, skills, etc. available for testing, ask the user whether testing should be skipped.

