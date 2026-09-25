---
type: Configuration
title: Routing
description: Expo Router v6 file-based route structure and auth gate navigation.
tags: [navigation, structure]
timestamp: 2026-07-24T14:00:00Z
---

# Route map

| Route | Screen | Presentation |
|-------|--------|-------------|
| `/login` | Login screen | Default |
| `/(tabs)` | Tab navigator | Default |
| `/(tabs)/` | Dashboard / Home | Tab |
| `/(tabs)/learning` | Learning Hub | Tab |
| `/(tabs)/messages` | Messages inbox/sent | Tab |
| `/(tabs)/more` | Profile and settings | Tab |
| `/homework` | Homework detail | Card |
| `/attendance` | Attendance view | Card |
| `/results` | Academic results | Card |
| `/lesson/[id]` | Lesson player | Card |

# Auth gate

`AuthGate` component in `app/_layout.tsx` redirects:
- Unauthenticated users away from `(tabs)` → `/login`
- Authenticated users away from `/login` → `/(tabs)`

Only valid route segments are checked — unknown segments don't trigger redirect.

# Entry

`package.json` sets `"main": "expo-router/entry"`. The file `index.ts` at
the project root is dead code (imports non-existent `./App`).

# Source

`app/_layout.tsx` (root stack), `app/(tabs)/_layout.tsx` (tab bar).