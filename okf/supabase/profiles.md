---
type: Database Table
title: Profiles
description: Parent user accounts keyed by email for custom authentication.
resource: supabase://profiles
tags: [auth, users]
timestamp: 2026-07-24T14:00:00Z
---

# Schema

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Display name |
| `email` | TEXT | Login identifier (unique, lowercased) |
| `expo_push_token` | TEXT | Push notification token for Expo |

# Notes

Authentication is a custom email lookup — password is accepted but never validated.
Any email that exists in this table can log in. See [Auth](/auth.md).

Joined with [Students](/supabase/students.md) via `parentId` foreign key.