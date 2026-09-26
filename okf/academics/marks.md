---
type: Concept
title: Marks & reports
description: How a parent reaches a child's marks, what the report periods mean, and which module owns the selection maths.
tags: [marks, reports, academics]
timestamp: 2026-09-25T00:00:00Z
---

# The flow

Open the app → the child is already chosen (Home's child selector) → the academic summary
is on the first screen → *Reports* cards for Monthly / Midterm / Final → tap one → the
Marks tab opens on that period → the summary card, then every subject for that period.

Nothing academic sits behind a generic menu: Home's report cards and the Marks tab both
land on the same screen (`components/MarksScreen.tsx`), and `/results` still renders it for
older links.

# Report periods

| Period | Source rows (`exams.examType`) | Label |
|--------|-------------------------------|-------|
| `monthly` | `CA`, `Homework`, `Classwork`, `Quiz` grouped by month | `<Mon YYYY> monthly report` |
| `midterm` | `CA`/`Homework`/`Classwork`/`Quiz` (40%) + `Midterm` (60%) | `Midterm report` |
| `final` | the same components (40%) + `Final` (60%) | `Final report` |

# Calculations are not defined here

`computeMonthlyResults` / `computeTermResults` in `context/AppContext.tsx` own the
weightings and the attendance bonus, and they were **not** changed by the redesign:
`finalPct = round(caPct * 0.4 + quizPct * 0.6)` for a month and
`round(compPct * 0.4 + examPct * 0.6)` for a term.

# `lib/reportSelectors.ts`

A pure module (no React, no Supabase, no theme) over the rows `AppContext` already
produces. It selects, labels and summarises — never recalculates.

| Group | Exports |
|-------|---------|
| Thresholds | `ATTENTION_THRESHOLD` (60), `STRONG_THRESHOLD` (80), `REPORT_PERIODS`, `ACADEMIC_YEAR_MONTHS` (Sep–Jun) |
| Single marks | `percentage`, `gradeFor`, `gradeColorFor`, `formatMonthYear` |
| Periods | `isPeriod`, `filterByPeriod`, `filterByYear`, `academicYearKey`, `academicYearOptions` |
| Months | `academicMonthLabel`, `monthlyMonthCounts`, `latestMonthWithData`, `filterByMonth` |
| Summaries | `summarisePeriod` (average, grade, strongest ≥ 80, attention < 60), `latestPeriodSummary`, `summariseChild` |
| Missing work | `computePendingReports` |

# "Not published yet" instead of a zero

`computePendingReports` mirrors the completeness gates of the two calculators exactly
(monthly needs at least one non-Quiz CA row **and** one Quiz row; a term needs at least
one component **and** the target exam). Anything it returns has no computed result, so the
Marks screen lists the subject with what is still missing rather than rendering a
misleading 0%. Tests: `tests/app/report-selectors.test.mjs`.

# Source

`lib/reportSelectors.ts`, `components/MarksScreen.tsx`, `components/SubjectResultCard.tsx`,
`components/ReportPeriodCard.tsx`, `app/(tabs)/index.tsx`, `app/results.tsx`.
