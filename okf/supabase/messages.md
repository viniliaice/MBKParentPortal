---
type: Database Table
title: Messages
description: Parent-teacher direct messages.
resource: supabase://messages
tags: [communication, inbox]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `senderId` | UUID | FK to [Profiles](/supabase/profiles.md) |
| `recipientId` | UUID | FK to [Profiles](/supabase/profiles.md) |
| `subject` | TEXT | Message subject line |
| `body` | TEXT | Message body |
| `readAt` | TIMESTAMPTZ | Null until read |
| `createdAt` | TIMESTAMPTZ | Creation timestamp |

# Triggers

An `AFTER INSERT` database trigger calls the `send-notification` edge function
which forwards via Expo Push API. See [Notifications](/notifications.md).