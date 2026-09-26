---
type: Database Table
title: Announcements
description: School-wide or class-scoped announcements.
resource: supabase://announcements
tags: [communication, school]
timestamp: 2026-09-25T00:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | text | Primary key (the school's business id) |
| `message` | TEXT | Announcement body |
| `className` | TEXT | Null for school-wide, class name for scoped |
| `createdBy` | UUID | FK to [Profiles](/supabase/profiles.md) |
| `createdAt` | TIMESTAMPTZ | Creation timestamp |

# What the table does *not* have

No title, pinned/important or read column. The app derives the row title from the class
(`"<class> announcement"`, or `"School announcement"`) and keeps its own device-local
"seen" marker for the unread dot — see [App Context](/state/app.md). Class scoping for
individual recipients lives in `announcement_recipients`.

# Triggers

An `AFTER INSERT` database trigger calls the `send-notification` edge function
which finds parents of students in the target class and sends Expo push
notifications. See [Notifications](/notifications.md).