---
type: React Context
title: App Context
description: Central data layer — fetches all Supabase data on mount and serves it, with refresh and error state, to every screen.
tags: [state, data, supabase]
timestamp: 2026-09-25T00:00:00Z
---

# Overview

`AppContext` is the single source of truth for all app data. On mount, it queries
Supabase in one `useEffect` + `Promise.all` batch and stores results in local state.
There is no pagination or caching; `refresh()` re-runs the same load silently (so
pull-to-refresh never swaps the screen for a skeleton) and a failed load sets
`error` to a parent-readable sentence the screens render with a retry button.

# Fetched data

| Data | Source |
|------|--------|
| Students | `supabase.from('students').select('*').eq('parentId', user.id)` |
| Exams | `supabase.from('exams').select('*').in('studentId', studentIds)` |
| Attendance | `supabase.from('attendance').select('*').in('studentId', studentIds)` |
| Inbox messages | `supabase.from('messages').select('*').eq('recipientId', user.id)` |
| Sent messages | `supabase.from('messages').select('*').eq('senderId', user.id)` |
| Announcements | `supabase.from('announcements').select('*')` (sorted newest first) |
| Homework | `supabase.from('homework').select('*').in('studentId', studentIds)` |
| Academic years | `supabase.from('academic_years').select('*').order('startDate', { ascending: false })` |

# Derived data (useMemo)

- **Results**: Monthly scores (CA + Quiz), midterm, and final scores computed
  from raw exams with a weighted formula: 40% continuous assessment, 60% exam.
- **Attendance map**: Grouped by student + month for CA scoring.
- **Unread count**: Messages that are inbox and not yet read.
- **Pending reports**: `computePendingReports(rawExams)` — subjects whose report cannot be
  computed yet, from `lib/reportSelectors.ts`. See [Marks & reports](/academics/marks.md).
- **Unread communications**: unread messages + announcements newer than the seen marker;
  this is the number on the Messages tab badge.
- **Selected child**: `selectedStudentId` / `selectedStudent`, remembered across launches.

# Persisted state (AsyncStorage)

| Key | Data |
|-----|------|
| `@mbk_auth_user` | Signed-in parent (see [Auth](/state/auth.md)) |
| `@mbk_learning_progress` | Per-lesson completion, XP, activity results |
| `@mbk_gamification` | Streak, level, total XP, daily reward status |
| `@mbk_selected_child` | The child the parent last viewed |
| `@mbk_announcements_seen` | When the announcements list was last opened (the table has no read state) |
| `@mbk_theme` | Appearance preference (see [Theme](/app/theme.md)) |

# TanStack React Query

Wired in `_layout.tsx` via `QueryClientProvider` but **never used** — all
data flows through AppContext. Do not introduce `useQuery`/`useMutation`
without explicit instruction.

# Source

`context/AppContext.tsx` — consumed via `useApp()` hook.