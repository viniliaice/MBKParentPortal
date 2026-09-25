---
type: Database Table
title: Exams
description: Individual exam, quiz, and coursework records per student per subject.
resource: supabase://exams
tags: [academics, grades]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `studentId` | UUID | FK to [Students](/supabase/students.md) |
| `subject` | TEXT | Subject name |
| `examType` | TEXT | One of: CA, Homework, Classwork, Quiz, Midterm, Final |
| `score` | NUMERIC | Raw score achieved |
| `total` | NUMERIC | Maximum possible score |
| `month` | TEXT | Month label (e.g. "January") |
| `termId` | TEXT | Optional — groups exams into terms |
| `date` | TIMESTAMPTZ | When the exam was recorded |

# Computed results

The app derives monthly and term scores by grouping exams and applying a weighted
formula (40% continuous assessment, 60% exam/quiz). See [App Context](/state/app.md).