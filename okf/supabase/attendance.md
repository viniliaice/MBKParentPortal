---
type: Database Table
title: Attendance
description: Daily attendance status per student.
resource: supabase://attendance
tags: [academics, daily]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `studentId` | UUID | FK to [Students](/supabase/students.md) |
| `date` | DATE | Attendance date |
| `status` | TEXT | One of: present, absent, late |
| `note` | TEXT | Optional note |

# Usage

Attendance contributes to the monthly CA score (out of 20 points weighted into
the 40% CA component). See [App Context](/state/app.md) for the formula.