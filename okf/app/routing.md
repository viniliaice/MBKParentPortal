---
type: Configuration
title: Routing
description: Expo Router v6 file-based route structure, the four parent destinations, and deep-link parameters.
tags: [navigation, structure]
timestamp: 2026-09-25T00:00:00Z
---

# Destinations

The app is a parent app, so the bar carries the two questions a parent opens it with —
*how are my children doing* and *what does the school need me to know* — and nothing else.

| Route | Screen | Presentation |
|-------|--------|--------------|
| `/(tabs)/index` | Home — selected child, academic summary, report cards, school messages | Tab |
| `/(tabs)/marks` | Marks & reports (`components/MarksScreen.tsx`) | Tab |
| `/(tabs)/messages` | Messages + Announcements (one destination) | Tab |
| `/(tabs)/more` | Profile, children, appearance, school records, support | Tab |
| `/(tabs)/learning` | Learning Hub — **hidden from the bar** (`href: null`), reached from More and Home | Hidden tab |

Learning is the child's practice material, not a primary parent destination; the route is
unchanged, only its place in the bar. See [Marks & reports](/academics/marks.md).

# Stack routes

| Route | Screen | Presentation |
|-------|--------|--------------|
| `/login` | Sign in | Default |
| `/homework` | Homework list and detail modal | Card |
| `/attendance` | Attendance per child | Card |
| `/results` | The same `MarksScreen` with a back affordance | Card |
| `/lesson/[id]` | Lesson player (intro → animation → activity) | Card |
| `/quizzes` | Quiz list, `/quizzes/history`, `/quizzes/results`, `/quizzes/[id]` | Default |
| `/legal` | Privacy summary | Card |
| `/account` | Account closure request | Card |

`/results` exists so existing links (and the More menu) keep working; the tab and the
pushed screen render the same component, with `showBack` deciding the header only.

# Deep-link parameters

| Route | Parameter | Effect |
|-------|-----------|--------|
| `/(tabs)/marks` | `period=monthly\|midterm\|final` | Opens the Marks tab on that report period (Home's report cards use this) |
| `/(tabs)/marks` | `student=<id>` | Selects that child before showing their marks |
| `/(tabs)/messages` | `view=inbox\|announcements\|sent` | Opens that segment (announcement notifications use this) |

# Auth gate

`AuthGate` component in `app/_layout.tsx` redirects:

- Unauthenticated users away from `(tabs)` → `/login`
- Authenticated users away from `/login` → `/(tabs)`

Only valid route segments are checked — unknown segments don't trigger redirect.

# Entry

`package.json` sets `"main": "expo-router/entry"`.

# Source

`app/_layout.tsx` (root stack), `app/(tabs)/_layout.tsx` (tab bar).
