---
type: Database Table
title: Announcements
description: School-wide or class-scoped announcements.
resource: supabase://announcements
tags: [communication, school]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `message` | TEXT | Announcement body |
| `className` | TEXT | Null for school-wide, class name for scoped |
| `createdBy` | UUID | FK to [Profiles](/supabase/profiles.md) |
| `createdAt` | TIMESTAMPTZ | Creation timestamp |

# Triggers

An `AFTER INSERT` database trigger calls the `send-notification` edge function
which finds parents of students in the target class and sends Expo push
notifications. See [Notifications](/notifications.md).