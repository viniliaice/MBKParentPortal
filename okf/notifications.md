---
type: Concept
title: Notifications
description: Push notification registration via Expo Notifications + Supabase edge function forwarding.
tags: [communication, push]
timestamp: 2026-07-24T14:00:00Z
---

# Registration

On app launch (`RootLayoutNav`), the app calls `registerForPushNotifications()`
which requests permission via `expo-notifications`, obtains an Expo push token,
and saves it to the [Profiles](/supabase/profiles.md) table under `expo_push_token`.
Only runs on native — skipped on web.

# Forwarding (Edge Function)

A Supabase database trigger (`on_new_message`, `on_new_announcement`) calls the
`send-notification` Deno edge function, which:

- For **messages**: looks up sender name from Profiles, pushes to recipient's Expo token
- For **announcements**: finds all students in the target class, collects parent push
  tokens (deduped), and sends batches of up to 100 via Expo Push API

The edge function lives at `supabase/functions/send-notification/`.

# Homework Reminders

Local scheduled notifications via `scheduleHomeworkReminder()` — does not use
the edge function.