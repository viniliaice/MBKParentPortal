# MBK Parent Portal — Learning Section Deep Review

**Scope:** `app/(tabs)/learning.tsx`, `app/lesson/[id].tsx`, `app/quizzes/*`, `data/learningData.ts`, `context/AppContext.tsx`, `lib/mastery.ts`, `components/ActivityRenderer.tsx`, `components/ConceptAnimation.tsx`, `components/CelebrationOverlay.tsx`, `supabase/migrations/*`.

**Context:** This is a *parent* portal, but the Learning tab is really a child-facing mini Duolingo bolted onto a parent-facing school app (homework/attendance/results/messages/quizzes). The two audiences are being served the exact same UI, which is itself the root of several UX issues below.

---

## Executive Summary

The Learning feature has a genuinely solid foundation that's rare to see in a hobby-scale codebase: real mastery-gated progression (`lib/mastery.ts`), an append-only attempt log (`lesson_attempts`) instead of destructive overwrites, a Leitner-style SRS scheduler (`nextSrsDueDate`), 8 distinct activity renderers, and a hand-built "concept animation" pre-teaching step before every quiz. That is more instructional design than most EdTech MVPs ship with.

But most of that infrastructure is **half-wired**: `updateSrsState` and `isSrsDue` are fully implemented and exported, and **nothing in the app calls them** — due reviews never resurface. `lessonAttempts`/`AttemptSummary` are fetched into context but the Learning Hub UI never shows them. There's no search, no bookmarks, no notes, no leaderboard, no daily-goal ritual, no lesson-level "why does this matter" recap, no offline queueing for lost connectivity mid-lesson, and the entire curriculum (`data/learningData.ts`, 820 lines, 24 lessons, 98 activities) is static TypeScript — it can't be extended by non-engineers, can't be personalized, and can't grow past two subjects without a redeploy.

Two structural risks dominate everything else: **(1) every Supabase table has `USING (true)` RLS policies** — any authenticated *or anonymous* Supabase key can read/write any parent's `lesson_progress`, `gamification`, and `quiz_attempts` rows — and **(2) `AuthContext.login` ignores the password entirely** (per `AGENTS.md`, a known, intentionally-untouched defect). Both are out of scope to fix here but materially affect any recommendation involving new backend-driven learning features (leaderboards, social feed, etc.) because today there is no real per-user data isolation to build on top of.

The single highest-leverage fix is wiring the SRS system that already exists into the lesson-selection flow (`app/(tabs)/learning.tsx`) and into `saveLessonAttempt` (`context/AppContext.tsx`) — it's a ~50-line change that activates spaced repetition the codebase was already designed for, and it directly targets retention, the #1 gap identified below.

---

## Top 10 Improvements

1. **Wire up the dormant SRS system.** `updateSrsState`/`isSrsDue` (`lib/mastery.ts`, `context/AppContext.tsx:584`) exist but are called from nowhere. Surface "due for review" lessons on the Learning Hub and inject 1–2 review activities into lessons per `isSrsDue`. *Complexity 2.*
2. **Add a Continue/Resume + "Next Up" module** to the Learning Hub. Today the screen is a flat accordion of 8 topics with no recommendation of what to do next — the user must manually expand and scan. *Complexity 2.*
3. **Fix mid-lesson exit/interruption handling.** `handleExit` (`app/lesson/[id].tsx:98`) discards all progress with a scary "Your progress in this lesson will be lost" alert and no autosave — a single interrupted phone call loses a 5-question streak. *Complexity 2.*
4. **Add a daily goal + session-length nudge.** There's a streak (day-level) but no within-session goal ("finish 3 activities today"), which is the mechanic Duolingo/Khan Academy use to drive session length. *Complexity 2.*
5. **Extract and reuse `StudentSelector`.** The exact same student-picker markup (`studentRow`/`studentBtn`) is copy-pasted in `app/quizzes/index.tsx`, `app/quizzes/history.tsx`, `app/attendance.tsx`, `app/results.tsx` — 4x duplication of the same ~15 lines of JSX/styles. *Complexity 1.*
6. **Show attempt history / trend in the Learning Hub.** `lessonAttempts` is fetched into `AppContext` and literally unused everywhere except being read back into `computeMasteryLevel`. Surfacing "3rd attempt, 60%→80%→95%" is free motivational data already in memory. *Complexity 2.*
7. **Replace the disruptive "Leave Lesson" `Alert.alert`** with autosave-and-resume: persist `activityResults`/`step` to AsyncStorage on every answer so backgrounding/crashing doesn't lose the attempt. *Complexity 3.*
8. **Add a Practice/Review Mode distinct from the linear lesson flow** — right now the *only* way to revisit a mastered topic is to fully replay a fixed lesson (with the same 4–5 hardcoded questions, so on replay the child can just memorize positions). *Complexity 3.*
9. **Move curriculum content out of a static TS file into Supabase.** `data/learningData.ts` cannot be edited by teachers, can't A/B test difficulty, and forces an app-store release to add a single question. This is the biggest strategic gap for scaling content. *Complexity 5 (large, multi-migration effort).*
10. **Split the Learning tab audience.** Parents currently see the same childlike "Learning Hub" (streaks, XP badges, lesson accordion) that the child would use. A parent-oriented summary ("Aisha mastered Addition this week, struggling with Subtraction word problems") is a materially different and more valuable parent-portal feature than a kid's game UI. *Complexity 4.*

---

## UX Issues

### Confusing flows / friction
- **No "Next lesson" CTA on the Learning Hub.** `app/(tabs)/learning.tsx` renders topics as collapsed `TopicCard`s (`expanded` state, line ~136); a returning learner must remember which topic they were in, tap to expand, scroll to find the first unlocked lesson. Compare to Duolingo's single "current lesson" hero button.
- **The subject toggle resets scroll position and topic expansion.** Switching Math ⇄ English (`setActiveSubject`) re-renders the whole `ScrollView` from scratch; every `TopicCard`'s local `expanded` state is remounted collapsed since `TopicCard` isn't keyed by persisted state.
- **Locked-lesson feedback is a static grey lock icon + one line of text** (`lockedHint`, "Master the previous lesson first") but never explains *what mastery means* or *shows how close* they are (e.g., "1 more attempt at 70%+ needed"). A first-time parent/child has no idea 70% (`MASTERY_THRESHOLD`) or `MASTERY_MIN_ATTEMPTS = 2` are even the rule.
- **The intro screen's "explanation" text (`lesson.explanation`) is passive reading**, then the `ConceptAnimation` interactive teaching step *repeats similar content in a different UI paradigm* — two teaching moments back to back before any question, which is a lot of dead time before feeling active engagement (see Cognitive Overload below).

### Unnecessary clicks
- To review a previously completed quiz's result, the flow is Learning tab → Quizzes → History → tap attempt → Results; there's no "last quiz result" surfaced from Home or Learning directly.
- `handleReviewComplete` (`app/lesson/[id].tsx:78`) always resets `answeredCurrent` and *removes the last activity result* (`activityResults.slice(0,-1)`), forcing the learner to redo the mini re-teach animation before re-answering — for an already-known concept where they made a careless mistake, this is friction without corresponding new value, especially if the wrong answer was a slip vs a genuine misunderstanding.

### Poor navigation
- **No back-to-top or breadcrumb inside a long topic list.** With 4 topics × 3 lessons per subject today, this scales poorly the moment `data/learningData.ts` grows (it's explicitly designed to grow — new topics are trivial to add in the data model).
- Quiz flow and Lesson flow are two entirely separate systems with different visual languages (compare `app/quizzes/[id].tsx`'s dot-progress + timer vs `app/lesson/[id].tsx`'s topic-colored progress bar) even though conceptually a "Quiz" and a "Lesson activity set" are the same underlying primitive (answer N questions, get scored). This split doubles the surface area to maintain and confuses the mental model — "why are there two different quiz-taking UIs in one app?"

### Empty states
- `app/(tabs)/learning.tsx`'s "Mastery by Activity Type" card (line 79) is conditionally hidden entirely (`return null`) if there are zero attempts — a brand-new user sees no explanation of what mastery tracking even is, missing an onboarding opportunity.
- `app/quizzes/index.tsx` has a good empty state ("No active quizzes right now", line ~254) but it's static — no CTA to go practice lessons instead, even though a "Study" button exists in the header (`studyBtn`, routes to `/(tabs)/learning`) that's unrelated to the specific empty state message.

### Mobile responsiveness
- `ActivityRenderer`'s `optionGrid` (multiple choice) uses `minWidth: '45%'` flex-wrap tiles (line in `ActivityRenderer.tsx` styles) — on small phones with 4-word options this wraps text awkwardly; there's no tablet/web layout variant despite `AGENTS.md` stating "Web is a real target."
- `ConceptAnimation`'s `objectsGrid` (`flexDirection: 'row', flexWrap: 'wrap'`) with fixed 72×72 `obj` tiles doesn't adapt for narrow phones with 6+ items (the alphabet concept scene has 6 letters) — likely wraps to 2-3 rows pushing the reveal panel off-screen on smaller devices, requiring scroll inside what should be a full-bleed animation screen (`animationContainer` in `lesson/[id].tsx` isn't itself scrollable).

### Accessibility issues
- **Zero `accessibilityLabel`/`accessibilityRole` usage** anywhere in the Learning surfaces (`grep` confirms `ActivityRenderer.tsx`, `learning.tsx`, `lesson/[id].tsx`, `ConceptAnimation.tsx` all have none — only `ErrorFallback.tsx` uses them). Every activity type (`MultiChoiceActivity`, `TrueFalseActivity`, `NumberLineActivity`, etc.) renders bare `TouchableOpacity`+`Text`, meaning a screen-reader user gets no announcement of "correct"/"incorrect" beyond a haptic pulse, and no semantic grouping of the options as a radio-group.
- Color is the *only* signal for correct/incorrect in every activity component (green/red backgrounds) — no additional icon differentiation in some (e.g. `MultiChoiceActivity` shows color only, no checkmark/x overlay, unlike `TrueFalseActivity` which does add an icon). Inconsistent, and a problem for colorblind users.
- No dynamic font-size / reduced-motion support: `Animated.spring`/`Animated.timing` calls throughout `ConceptAnimation.tsx` and `CelebrationOverlay.tsx` never check `AccessibilityInfo.isReduceMotionEnabled()`.

### Visual hierarchy
- The Learning Hub header crams 3 badges (streak/level/XP, `headerBadges` row) plus a subject toggle plus a progress card plus a mastery grid plus a legend key — all above the fold before any actual lesson list. First-time users face 4 stacked cards of "meta" info before reaching the thing they came to do (start a lesson).
- `ACTIVITY_TYPE_LABELS`/legend row (`typeKeyRow`, a horizontally scrolling chip list of all 8 activity types) is permanently rendered on every visit to the Learning Hub even for returning users who already know what "Tap Correct" means — this is one-time onboarding content masquerading as persistent chrome.

### Loading states
- `app/(tabs)/learning.tsx` has **no loading state at all** — it reads `lessonProgress`/`gamification` straight from `useApp()`, and `AppContext`'s single `loading` boolean gates the *entire app* (see AppContext analysis below), so the Learning tab either shows fully-loaded or (during the brief window before the tab is reachable) nothing, with no skeleton for the topic list.
- `app/quizzes/index.tsx` does show `ActivityIndicator` while `loading` (line ~117) — inconsistent with Learning Hub's total absence of any indicator, a UX inconsistency between two conceptually similar screens in the same feature area.

### Error handling
- If `getLessonById(id)`/`getTopicById(topicId)` return `undefined` (`app/lesson/[id].tsx:47`), the fallback is a bare centered "Lesson not found" text with **no back button** — a dead end.
- `saveLessonAttempt`'s Supabase writes (`context/AppContext.tsx:526-583`) are fire-and-forget IIFEs with **no error handling at all** — if the insert to `lesson_attempts` or upsert to `lesson_progress` fails (network blip, RLS misconfig, etc.), the local state has already advanced (celebration screen shown, `setLessonProgress` called optimistically) and the user has no idea their XP/mastery didn't persist. Next app load will silently roll back progress with no explanation.
- Similarly, `saveLessonProgress`'s DB writes have no `.catch`/error surfacing.

### Onboarding experience
- There is **no first-run tutorial** for the Learning tab at all — a brand-new user lands on 4 stacked meta-cards (streak/progress/mastery/legend) with zero contextual explanation of mastery thresholds, XP, or how unlocking works. Compare to Duolingo's forced placement test + guided first lesson.
- The mastery/lock system is a genuinely novel mechanic (weighted-recent-attempts mastery, not just "did you pass once") but it is never explained in-product — the closest thing is the one-line `lockedHint` string.

---

## Learning Experience Issues

- **Weak lesson progression narrative.** Topics are only linearly gated *within themselves* (`prerequisiteLessonId` chains within a topic, e.g. `cnt_1 → cnt_2 → cnt_3`), but topics themselves (`counting`, `addition`, `subtraction`, `shapes`) have no cross-topic prerequisites or a suggested order beyond a static `order` field that isn't even enforced in the UI (all 4 topics are always visible/expandable regardless of `order`). A student can jump straight into "Subtraction" with zero counting foundation.
- **No adaptive difficulty.** Every activity's `difficulty: 1|2|3` field (`data/learningData.ts`) is defined but **never read anywhere in the app** (`grep` confirms no consumer) — it's dead metadata. There's no mechanism to skip easy questions for a strong student or to insert extra scaffolding for a struggling one; every learner sees identical fixed content in identical fixed order.
- **No knowledge check *before* teaching** (a diagnostic/pretest) — every learner sits through the intro + `ConceptAnimation` even if they already know the material, with no "skip if you know this" option.
- **Retry with zero variation is memorization, not learning.** When a lesson attempt fails mastery, replaying it (`app/lesson/[id].tsx`) shows the *exact same 4–5 activities, same order, same options* (only `MatchPairsActivity`'s right column reshuffles via a local `useState` shuffle). A student can pass by remembering "3rd answer is correct" rather than by re-deriving the concept. There is no question bank/randomized selection per lesson.
- **Mastery/SRS engine is built but functionally invisible and partially dead code.** `updateSrsState` (`AppContext.tsx:584`) and `isSrsDue` (`lib/mastery.ts:121`) have zero call sites outside their own definitions and `lib/mastery.ts`'s own exports. The DB schema (`srs_due_at`, `srs_correct_streak` columns, `20260727005821_add_mastery_and_srs_schema.sql`) is populated with defaults but never advances past 0/null because nothing calls the mutator. This is the single biggest "half-built feature" in the codebase — spaced repetition, the single most evidence-backed retention technique in EdTech, is present in the data layer and completely inert in the product.
- **No interleaving/mixed review sessions.** Everything is single-topic, single-lesson. There's no "5-minute mixed review across everything you've learned" session type, which is what actually cements the SRS/mastery data being collected.
- **Feedback loop is binary and terse.** `ActivityRenderer`'s feedback text (line ~58) is just "Correct!" or "The answer is: X" — no explanation of *why* it's correct, no re-statement of the underlying rule from `lesson.explanation`. A wrong answer gives the student the right answer but not the reasoning, so the same mistake is likely to repeat.
- **Hints are a single static string per activity** (`activity.hint`), always available pre-answer, with no tiered hint system (e.g., "nudge" → "partial answer" → "full explanation") and no penalty/tracking of hint usage in mastery computation — a student can hint-farm every single question and still register a "mastered" 100%.
- **No worked examples or "show me" mode** — `explanation` text is prose; there's no interactive worked example distinct from the answer-and-check loop.
- **Cognitive overload risk in the lesson intro.** The intro screen (`app/lesson/[id].tsx` `step === 'intro'`) stacks: icon, title, GOAL box, full paragraph explanation, "activity types" pill preview, start button — then immediately transitions into the *separate* `ConceptAnimation` teaching sequence before any practice. That's three distinct teaching modalities (read objective → read explanation → watch/tap animation) before the first real question, which is a lot of front-loaded, low-agency content for the presumed age group (contains "counting to 5" style content, i.e. very young learners with short attention spans).
- **Weak motivation systems beyond streak+XP+level.** No badges/achievements gallery (badge is awarded per-lesson via `badgeName`/`badgeIcon` fields but there is **no screen anywhere that lists earned badges** — `grep` shows `badgeName`/`badgeIcon` used only inside `CelebrationOverlay` at the moment of earning, then never again; they aren't even persisted distinctly, only implied by `lessonProgress[id].completed`). Earning something you can never look back at is a wasted reward.
- **No goal-setting or session cadence** (daily minute goal, weekly targets) — only a pass/fail day-streak.
- **Poor "completion" flow at the subject/topic level.** There is no "Topic Complete" or "Subject Mastered" milestone celebration — `CelebrationOverlay` only fires per-lesson; finishing all 3 lessons in "Counting" is invisible as a distinct achievement.

---

## Technical Issues

### Code duplication
- **Student-selector duplicated 4×** verbatim: `app/quizzes/index.tsx` (`studentRow`/`studentBtn`, lines ~102-115), `app/quizzes/history.tsx` (lines ~75-88), `app/attendance.tsx` (~71-76), `app/results.tsx` (~259-270). Same JSX shape, same style object names, same `s.name.split(' ')[0]` truncation logic. Should be `components/StudentSelector.tsx`.
- **`ACTIVITY_TYPE_LABELS`/type-color maps duplicated across files**: `app/(tabs)/learning.tsx` defines `ACTIVITY_TYPE_LABELS` (8 entries) *and* a separate `ActivityTypeIcon`'s inline `map` (8 more color/icon pairs) *and* `mapColors` inside the mastery-grid IIFE (8 more colors) — three independent maps keyed by the same 8 activity type strings, each hand-maintained and already slightly inconsistent (e.g., `writing`'s icon color is `#14B8A6` in two places but the mastery pct color mapping repeats it a third time). `app/lesson/[id].tsx` separately defines a fourth map, `TYPE_DESCRIPTIONS`. Four independent per-activity-type config objects for the same 8-item enum is a maintenance trap — the `AGENTS.md` warning ("Don't add [an activity type] without checking every switch") is basically documenting this smell.
- **Score/grade color logic duplicated**: `getGradeColor` is defined identically in both `app/quizzes/results.tsx` (line ~92) and `app/quizzes/history.tsx` (line ~46).
- **`localDateStr` is defined twice**: once in `lib/mastery.ts` (exported) and again, verbatim, as a private function in `context/AppContext.tsx` (lines 18-23) instead of importing it — the exact function AppContext already imports `computeMasteryLevel`/`nextSrsDueDate` from the same file.

### Components that should be extracted
- `app/lesson/[id].tsx` (253 lines) mixes lesson-flow state machine, intro screen markup, activity screen markup, and the exit-confirmation logic in one default export. The intro screen and the in-progress activity screen are good candidates for `LessonIntro` and `LessonActivityStep` components.
- `app/(tabs)/learning.tsx`'s `TopicCard` and `ActivityTypeIcon` are already extracted as separate functions in the same file (good), but the "Mastery by Activity Type" block is an inline IIFE (`{(() => {...})()}`, lines 79-104) instead of a named component — hurts readability and defeats memoization.
- `ActivityRenderer.tsx` (496 lines) implements 7 activity components in one file. Given `AGENTS.md`'s explicit warning that adding an activity type touches multiple switches, splitting each into `components/activities/MultiChoiceActivity.tsx` etc. (with a shared `useActivityAnswer` hook for the `submitted`/`isCorrect`/`onSubmit` pattern that's copy-pasted with minor variations in *every one* of the 7 sub-components) would reduce duplication and blast radius per change.

### Performance bottlenecks / unnecessary re-renders
- **Zero `useMemo`/`useCallback`/`React.memo` usage** anywhere in the Learning surfaces (`grep -c` returned 0 for all three key files: `learning.tsx`, `lesson/[id].tsx`, `ActivityRenderer.tsx`). Specific consequences:
  - `computeMastery(lessonProgress, subjectLessonIds)` (`app/(tabs)/learning.tsx` line ~78) is called on **every render** of the Learning Hub, iterating every `lessonProgress` entry's `activityResults` array. It's wrapped in an inline IIFE, not memoized, and re-executes even when unrelated context values change (e.g., a `messages` update in `AppContext` triggers a full context re-render that cascades to this).
  - `mapColors` (a fresh object literal, `app/(tabs)/learning.tsx` line ~89) and `ACTIVITY_TYPE_LABELS` lookups are recreated inline per render of the mastery grid instead of hoisted once as a module constant (as `ACTIVITY_TYPE_LABELS` itself already correctly is).
  - `TopicCard`s aren't memoized — expanding one topic re-renders every sibling `TopicCard` because `lessonProgress` (a new object reference on every `saveLessonAttempt`) is passed down and none of them are wrapped in `React.memo`.
- **`AppContext.tsx`'s single mega-provider re-renders the entire app tree on any single field change.** `saveLessonAttempt` calls `setLessonAttempts` *and* `setLessonProgress` in the same tick (two separate `useState` setters, lines 536+546), each triggering its own render pass of every consumer of `useApp()` — which is essentially the whole app (Home dashboard, Learning Hub, More screen, Quizzes) since it's one flat context object with no selector/split.
- **`ConceptAnimation`'s `TappableObject`** creates fresh `Animated.Value`s per item per mount (`useRef(new Animated.Value(0))`, fine) but the parent `objectsGrid` maps over `scene.items` with a spring `delay: index * 120` — for the 8-item English topics (e.g., alphabet scenes with 6 letters), that's 6 staggered springs running concurrently on the JS thread's `Animated` driver un-batched from `useNativeDriver: true`'s render loop; not a huge deal on modern devices but scales linearly with content growth with no windowing.

### Large components
- `context/AppContext.tsx` — 619 lines, single file combining exam-score computation, attendance aggregation, message inbox/sent merging, and the entire learning/gamification subsystem. `computeMonthlyResults`/`computeTermResults` (business logic unrelated to learning) live in the same file and same module scope as `computeMastery` (learning-specific) — no separation of concerns by domain.
- `data/learningData.ts` — 820 lines of literal object data mixed into the same file as its type definitions and helper functions (`getLessonById`, etc.). Fine for now, but the file will not scale past a handful more topics without becoming unmanageable to hand-edit, and it can't be lazy-loaded (it's one synchronous import, all 24 lessons parsed on app boot regardless of which subject/topic the user opens).

### State management issues
- **Two independent copies of "attempt history" concepts**: `lessonProgress[id].activityResults` (last-attempt-only, overwritten each `saveLessonAttempt` call — the *previous* attempt's data is only preserved via the derived `masteryLevel` number, not the raw results) vs the true history in `lessonAttempts[id]` (array of `{accuracyPct, completedAt}`, no per-question breakdown). Neither is a full historical record of *which questions* were missed across attempts, meaning there's no way to build "you always get subtraction word-problems wrong" analytics even though the raw signal briefly exists in memory during each attempt.
- `AppContext`'s `useEffect` on mount does **7 sequential-ish `Promise.all` batches** (first batch: students/progress/gamification/attempts, second batch gated on the first completing: exams/attendance/messages/announcements/homework) — the Learning tab's data is fetched even when the user never opens it, and the second batch can't start until `mapped` (from `studentResp`) resolves, serializing what could be more parallel.
- TanStack Query is installed and mounted (`app/_layout.tsx`, `QueryClientProvider`) but per `AGENTS.md`, deliberately unused — meaning there is genuinely **no caching layer** for the Learning tab's Supabase reads; every full app reload (including hot-reload during dev, or backgrounding+foregrounding since there's no re-fetch invalidation strategy visible for that either) re-fetches everything with no stale-while-revalidate behavior.

### API inefficiencies
- `saveLessonAttempt`/`saveLessonProgress` (`AppContext.tsx`) issue **two separate Supabase calls per lesson completion** (`lesson_attempts` insert + `lesson_progress` upsert) instead of a single RPC/transaction — if the first succeeds and the second fails (or vice versa), `lesson_attempts` and `lesson_progress.mastery_level` can drift out of sync with no reconciliation job.
- `app/quizzes/index.tsx`'s `fetchQuizzes` does a quiz query, then a **second** query to `quiz_questions` to count questions per quiz client-side (`countMap`, lines ~39-46) instead of a single query with a count aggregate/view — N+1-adjacent pattern that will get worse as quiz volume grows.

### Caching opportunities
- Curriculum data (`data/learningData.ts`) never changes at runtime — it's a perfect candidate for module-level memoized derived structures (e.g., `getLessonById` does a linear nested-loop scan of every subject/topic/lesson on every call, `app/lesson/[id].tsx` calls it twice per mount) — trivial to build a `Map<string, Lesson>` once at module load instead of the current O(n) scan per lookup. Cheap now (24 lessons) but a smell that will bite when content grows.
- No caching of Supabase reads at all (see TanStack Query note above) — every navigation into the Learning tab, if it ever independently fetched data (it doesn't yet, it reads from context), would be a fresh network round trip.

### Security concerns
- **All Supabase RLS policies use `USING (true)` for `anon, authenticated`** across every table including `lesson_progress`, `lesson_attempts`, `gamification`, `quiz_attempts` (confirmed in `supabase/migrations/20260726214838_create_full_app_schema.sql` and `20260727005821_add_mastery_and_srs_schema.sql`). Any client holding the anon key — which is bundled in the app and inherently public — can read or overwrite **any parent's** learning progress, XP, streaks, or quiz answers by simply changing the `parent_id`/`studentId` in a request. This is a pre-existing, documented-elsewhere issue but worth flagging specifically in the context of Learning data since it includes potentially sensitive child-performance data.
- `AuthContext.login` ignoring the password (documented in `AGENTS.md` as known/out-of-scope) means anyone who knows or guesses a parent's email can view that child's entire learning history, mastery levels, and quiz scores.
- Quiz answer-correctness logic runs **client-side** (`app/quizzes/[id].tsx handleSubmit`, comparing `ans.answer === q.correctAnswerSnapshot`) with the correct answer already shipped to the client in `optionsSnapshot`/`correctAnswerSnapshot` at quiz-fetch time — a technically savvy student (or parent) could read network responses to see correct answers before answering. Not project-breaking for a K-2 audience, but worth noting as a pattern to avoid if quizzes ever target older/more technical students.

### Type safety issues
- `LessonProgress`/`ActivityResult` interfaces (`AppContext.tsx`) are locally defined and **not exported** except implicitly through `AppContextType`, but `app/(tabs)/learning.tsx`'s `TopicCard` prop typing falls back to `Record<string, any>` for `lessonProgress` (line: `function TopicCard({ topic, lessonProgress }: { topic: Topic; lessonProgress: Record<string, any> })`) — losing all type safety on `.completed`/`.masteryLevel`/`.attemptsCount` field access exactly where `isLessonUnlocked` from `lib/mastery.ts` needs them typed correctly.
- `activity.pairs ?? []` and other optional-field patterns in `ActivityRenderer.tsx` suggest the `Activity` interface's `pairs?: MatchPair[]` is a bolt-on for one activity type inside a shared interface — a discriminated union keyed on `type` (so `matchPairs` activities *require* `pairs` and other types can't accidentally have it) would let TypeScript, not runtime `??` fallbacks, guarantee correctness.
- Activity `correctAnswer: string` is used as a delimiter-joined string for `dragOrder` (`'1,2,3,4,5'`) and `matchPairs` (`'matched'`, a magic sentinel that isn't even checked against real match state — `onSubmit(true)` is called unconditionally once all pairs are matched, so `correctAnswer` for matchPairs is dead/unused data). This "stringly-typed" answer representation loses type safety and creates dead fields.

### Testing gaps
- **Zero test files exist in the repo** (`find . -iname "*.test.*" -o -iname "*.spec.*"` returns nothing, and `AGENTS.md` confirms "There is no lint, test, or format tooling"). The mastery/SRS math in `lib/mastery.ts` (`computeMasteryLevel`'s weighted-average logic, `nextLeitnerInterval`'s day-interval branching, `isLessonUnlocked`'s gating logic) is exactly the kind of pure, high-value-per-test-case logic that unit tests would catch regressions in cheaply, yet it's completely unverified beyond manual play-testing.

---

## Performance Issues

- **Slow-ish initial load coupling.** The Learning tab's data (`lessonProgress`, `lessonAttempts`, `gamification`) is fetched in the *same* mount-time `Promise.all` as school-record data (students/exams/attendance/messages) inside `AppContext`'s one `useEffect` (`AppContext.tsx` lines ~229-330) — a parent who never opens the Learning tab still pays the full latency/query cost of `lesson_progress`, `lesson_attempts`, and `gamification` fetches on every app cold start.
- **No pagination anywhere in Learning-adjacent screens.** `app/quizzes/history.tsx` fetches *all* `quiz_attempts` for a student with no `.limit()`/cursor — fine at 10 attempts, a real problem at 500.
- **No lazy loading of curriculum data.** `data/learningData.ts`'s full object graph (both subjects, all topics/lessons/activities) is imported eagerly by any screen that imports from it, meaning the entire ~37KB curriculum literal is parsed and held in memory even if the user only ever touches Math.
- **No image optimization concerns currently** (Learning uses only emoji/Ionicons, no raster images) — a rare bright spot, but flagged because any future addition of illustrated lesson content will need this from day one.
- **No memory-leak-prone patterns found** in the reviewed files beyond the standard un-memoized re-render cost — `Animated.Value` refs are correctly scoped per-component-instance, timers (`setTimeout` in `MatchPairsActivity`'s wrong-answer flash, `app/quizzes/[id].tsx`'s countdown `setInterval`) are cleared appropriately in the quiz timer's `useEffect` cleanup, though `MatchPairsActivity`'s `setTimeout(() => {...}, 700)` (`ActivityRenderer.tsx`) has **no cleanup on unmount** — if a user answers and immediately backs out of the activity before the 700ms flash resolves, it calls `setWrong`/`setSelectedLeft` on an unmounted component (React will warn in dev, and it's a latent bug, if a minor one).

---

## Missing Features

Ranked roughly by expected engagement/retention impact for this audience (young learners + their parents):

| Feature | Status | Why it matters here |
|---|---|---|
| **Spaced repetition surfacing** | Built in DB/lib, not wired to UI | Single biggest retention lever; infra already exists (`isSrsDue`, `srs_due_at`) |
| **Badge/achievement gallery** | Badges awarded, never displayed again | Currently a wasted reward — no "trophy case" |
| **Search** | None | With curriculum growth, finding "the lesson about verbs" requires manual topic-by-topic scanning |
| **Bookmarks / "flag for later"** | None | No way to mark a hard lesson to revisit |
| **Notes** | None | Parents have no way to jot "struggles with word problems" against a topic |
| **Flashcards / quick-drill mode** | None | The vocabulary/phonics/alphabet content is naturally flashcard-shaped; currently locked inside full lesson flow only |
| **Daily goal ritual** | Streak exists, no daily *target* | Streak only rewards *any* activity; no "3 activities today" framing that drives session length |
| **Leaderboard** | None (and hard to justify given RLS state) | Even a private "beat your own best" leaderboard (not social, given security concerns) could work |
| **Parent-facing learning summary** | None — parent sees same child UI | The single most natural "why would a *parent* portal need this" feature: weekly digest of child's mastery gaps |
| **AI tutoring / adaptive hints** | Static single hint string only | `difficulty` field exists unused; no path to adaptive next-question selection |
| **Personalized recommendations** | None ("what should I do next" is always "expand a topic and scan") | Cheap wire-up: default the Learning Hub to auto-open the first topic with an incomplete/unlocked lesson |
| **Review sessions (mixed-topic)** | None | All practice is single-lesson; no "warm-up" mixed quiz across mastered content |
| **Practice mode (non-scored, unlimited retries)** | None — every attempt counts toward `attemptsCount`/mastery | No way to "just practice" without it affecting the mastery record |
| **Offline support** | None visible for lesson attempts | `saveLessonAttempt` fires Supabase writes with no offline queue; a lesson finished on flaky connectivity risks losing the XP/mastery write silently (see Error Handling above) |
| **Learning paths across topics** | Partial (`Topic.order` field, unused for gating) | Field exists but doesn't drive UI order or cross-topic locks |

---

## Code Smells

- Four independent activity-type → {label, color, icon} maps (`learning.tsx` ×3, `lesson/[id].tsx` ×1) that must be kept in sync by hand — a textbook case for a single `constants/activityTypes.ts` module.
- `localDateStr` duplicated between `lib/mastery.ts` and `context/AppContext.tsx` instead of imported.
- Inline IIFE (`{(() => {...})()}`) used for the mastery-grid block in `app/(tabs)/learning.tsx` instead of an extracted, memoizable component — a readability and performance smell simultaneously.
- `correctAnswer: 'matched'` sentinel string for `matchPairs` activities that is never actually checked against anything (dead validation logic — `onSubmit(true)` fires unconditionally once all pairs match).
- Magic numbers scattered without named constants: `+10` daily XP bonus (`AppContext.tsx` line ~475, `newGam.totalXPEarned += 10`) hardcoded inline rather than a `DAILY_BONUS_XP` constant (compare how `MASTERY_THRESHOLD`/`MASTERY_MIN_ATTEMPTS` *are* properly named constants in `lib/mastery.ts` — inconsistent rigor between the two systems that were clearly built at different times).
- `Math.floor(newGam.totalXPEarned / 200) + 1` level formula is inlined directly in `saveLessonProgress` with no named constant/helper (`LEVEL_XP_STEP = 200`), duplicated conceptually from `lib/mastery.ts`'s constant-extraction pattern that wasn't applied here.
- `getGradeColor` reimplemented identically in two files instead of a shared `lib/grading.ts` helper.

---

## Quick Wins

*(Complexity 1–2, high visible impact, no schema changes)*

1. Extract `components/StudentSelector.tsx` from the 4 duplicated call sites (`quizzes/index.tsx`, `quizzes/history.tsx`, `attendance.tsx`, `results.tsx`). Complexity 1.
2. Consolidate the four activity-type maps into one `constants/activityTypes.ts` exporting `{ label, color, icon }` per type; import everywhere. Complexity 1.
3. Add a badge gallery to `app/(tabs)/more.tsx` (which already has the profile/stats section) by deriving earned badges from `lessonProgress` (`completed` lessons' `badgeName`/`badgeIcon`, joined against `getLessonById`). Complexity 2.
4. Add a loading skeleton/`ActivityIndicator` to `app/(tabs)/learning.tsx` gated on `AppContext.loading`, matching the pattern already used in `app/quizzes/index.tsx`. Complexity 1.
5. Wire `MASTERY_THRESHOLD`/`MASTERY_MIN_ATTEMPTS` into the locked-lesson hint text so it reads "Score 70%+ on 2 attempts to unlock" instead of the generic "Master the previous lesson first." Complexity 1.
6. Fix the `MatchPairsActivity` `setTimeout` leak with a cleanup ref/`useEffect` return. Complexity 1.
7. Replace the two duplicate `getGradeColor` functions with one shared `lib/grading.ts` export. Complexity 1.
8. Deduplicate `localDateStr` — delete the private copy in `AppContext.tsx`, import from `lib/mastery.ts`. Complexity 1.
9. Add a "Continue where you left off" card to the top of the Learning Hub, computed client-side from `lessonProgress` (first unlocked+incomplete lesson found via existing `isLessonUnlocked`). Complexity 2.
10. Wrap `TopicCard` in `React.memo` and memoize `computeMastery`'s result with `useMemo` keyed on `lessonProgress`/`activeSubject`. Complexity 1.

---

## Long-Term Improvements

1. **Move curriculum authoring to Supabase** with an admin/teacher content-editing surface, replacing the static `data/learningData.ts`. Enables non-engineer content growth, A/B testing question difficulty, and per-class customization. Complexity 5.
2. **Build adaptive question selection** using the already-captured `difficulty` field plus per-activity-type mastery percentages (`computeMastery`) to serve harder/easier variants dynamically instead of a fixed activity array per lesson. Complexity 4-5.
3. **Full SRS-driven review mode**: a dedicated "Daily Review" entry point on the Learning Hub that pulls all lessons where `isSrsDue()` is true and serves a short mixed quiz, calling `updateSrsState` per answer. This alone would activate ~30% of the currently-dormant learning infrastructure. Complexity 3.
4. **Parent-facing insights dashboard**: aggregate `lessonProgress`/`lessonAttempts`/`computeMastery` data (already computed) into a weekly digest surfaced on the Home tab ("This week Aisha completed 4 lessons, struggling most with Subtraction word problems") — reuses 90% of existing data, net-new UI only. Complexity 3.
5. **Split Learning UI by audience** (parent view vs. child/kiosk view) if this product intends parents to hand the device to the child — currently one UI serves both with mismatched tone (XP/streak gamification for a parent's own screen makes little sense). Complexity 4.
6. **Introduce content-addressed randomized question banks per lesson** (multiple activities per skill, randomly sampled each attempt via `shuffleArray`/seeded random, already proven out in `utils/seededRandom.ts` for quizzes) so repeat attempts aren't memorizable by position. Complexity 3.
7. **Address the open RLS policies** before adding any social/leaderboard feature that would otherwise expose cross-family data. Complexity 3-4 (schema + app-level scoping changes, needs careful migration).

---

## Roadmap (Next 3 Months)

**Month 1 — Activate existing infrastructure + fix friction (mostly Quick Wins + #1/#3 from Top 10)**
- Wire SRS (`updateSrsState`, `isSrsDue`) into a "Daily Review" flow.
- Add "Continue where you left off" + loading skeleton to Learning Hub.
- Extract `StudentSelector`, consolidate activity-type maps, dedupe `localDateStr`/`getGradeColor`.
- Add error surfacing (toast/inline) for failed `saveLessonAttempt`/`saveLessonProgress` Supabase writes.
- Ship badge gallery on More/Learning screens.

**Month 2 — Deepen the learning loop**
- Randomize/rotate activities per lesson attempt via seeded shuffling (reuse `utils/seededRandom.ts`).
- Add richer feedback (why-correct explanations tied to `lesson.explanation`) instead of terse "Correct!"/"The answer is: X".
- Build a lightweight parent-facing weekly insights card on the Home dashboard from already-computed `computeMastery`/`lessonAttempts` data.
- Add autosave-and-resume for interrupted lesson attempts (replace the destructive exit alert).

**Month 3 — Scale readiness**
- Begin migrating curriculum content model to Supabase-backed tables (start with read path; keep `data/learningData.ts` as fallback/seed data during transition).
- Introduce adaptive next-question selection using the existing `difficulty` field and per-type mastery %.
- Revisit and tighten Supabase RLS policies for learning-related tables (`lesson_progress`, `lesson_attempts`, `gamification`) as a prerequisite for any future social/leaderboard feature — flagged as high-risk, needs its own dedicated security-focused effort in coordination with the auth fix noted in `AGENTS.md`.

---

## Out-of-Scope Items Noticed But Not Addressed

*(per working-style guidance: noting instead of fixing)*

- `AuthContext.login`'s password bypass (documented, intentionally untouched per `AGENTS.md`).
- Universally open Supabase RLS policies (`USING (true)`) across all tables — affects Learning data but is a whole-app issue.
- `google-services.json` and a Firebase admin private key committed to the repo (per `AGENTS.md`, a live incident, not touched here).
- `app/quizzes/[id].tsx` grades multiple-choice answers client-side with the correct answer already shipped in the payload — a security nice-to-have, not urgent for the current audience.
