---
type: Database Table
title: Students
description: Students linked to a parent account (Educator model).
resource: supabase://students
tags: [users, children]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Student display name |
| `parentId` | UUID | FK to [Profiles](/supabase/profiles.md) |
| `className` | TEXT | Class/grade designation (e.g. "Grade 3A") |

# Relations

Each parent can have multiple students. The app fetches all students for the
logged-in parent in a single query and derives grade from parsing `className`.