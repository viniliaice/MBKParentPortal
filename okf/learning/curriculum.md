---
type: Dataset
title: Curriculum
description: Hardcoded learning curriculum with two subjects, topics, lessons, and typed activities.
tags: [content, education]
timestamp: 2026-07-24T14:00:00Z
---

# Structure

```
Mathematics (Counting, Addition, Subtraction, Shapes)
  └─ Topics → Lessons → Activities
English (Alphabet, Phonics, Vocabulary, Grammar)
  └─ Topics → Lessons → Activities
```

# Activity types

| Type | Description |
|------|-------------|
| `multipleChoice` | Pick one correct answer |
| `tapCorrect` | Tap the correct item |
| `fillBlank` | Type the missing word/number |
| `dragOrder` | Drag items into correct sequence |
| `matchPairs` | Match related items |
| `numberLine` | Select position on a number line |
| `trueFalse` | True or false statement |
| `writing` | Free-form writing practice |

Adding a new activity type requires updating every `switch` on activity type,
the renderer, and progress handling.

# Source

`data/learningData.ts` (~800 lines). Hardcoded — no database backing.