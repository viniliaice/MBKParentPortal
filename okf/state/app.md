---
type: React Context
title: App Context
description: Central data layer — fetches all Supabase data on mount and serves it to every screen.
tags: [state, data, supabase]
timestamp: 2026-07-24T14:00:00Z
---

# Overview

`AppContext` is the single source of truth for all app data. On mount, it
queries Supabase in one `useEffect` + `Promise.all` batch and stores results
in local state. There is no pagination, caching, or error recovery per query.

# Fetched data

| Data | Source |
|------|--------|
| Students | `supabase.from('students').select('*').eq('parentId', user.id)` |
| Exams | `supabase.from('exams').select('*').in('studentId', studentIds)` |
| Attendance | `supabase.from('attendance').select('*').in('studentId', studentIds)` |
| Inbox messages | `supabase.from('messages').select('*').eq('recipientId', user.id)` |
| Sent messages | `supabase.from('messages').select('*').eq('senderId', user.id)` |
| Announcements | `supabase.from('announcements').select('*')` |

# Derived data (useMemo)

- **Results**: Monthly scores (CA + Quiz), midterm, and final scores computed
  from raw exams with a weighted formula: 40% continuous assessment, 60% exam.
- **Attendance map**: Grouped by student + month for CA scoring.
- **Unread count**: Messages that are inbox and not yet read.

# Persisted state (AsyncStorage)

| Key | Data |
|-----|------|
| `@mbk_learning_progress` | Per-lesson completion, XP, activity results |
| `@mbk_gamification` | Streak, level, total XP, daily reward status |

# TanStack React Query

Wired in `_layout.tsx` via `QueryClientProvider` but **never used** — all
data flows through AppContext. Do not introduce `useQuery`/`useMutation`
without explicit instruction.

# Source

`contexts/AppContext.tsx` — consumed via `useApp()` hook.