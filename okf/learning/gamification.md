---
type: Module
title: Gamification
description: XP, streaks, levels, and daily rewards system for lesson completion.
tags: [engagement, motivation]
timestamp: 2026-07-24T14:00:00Z
---

# Mechanics

| Mechanic | Detail |
|----------|--------|
| XP per lesson | Varies by lesson — earned on completion |
| Level | `Math.floor(totalXP / 200) + 1` |
| Streak | Consecutive days with at least one lesson completed |
| Daily reward | +10 XP bonus on first lesson each day |
| Longest streak | Tracked alongside current streak |

# Persistence

State is stored in AsyncStorage key `@mbk_gamification` and updated in
`AppContext.saveLessonProgress()`.

# Source

Managed by [App Context](/state/app.md) in `contexts/AppContext.tsx`.