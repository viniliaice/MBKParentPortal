---
type: React Context
title: Auth Context
description: Provides user session state and login/logout to the entire app.
tags: [auth, session, state]
timestamp: 2026-07-24T14:00:00Z
---

# Exposed API

| Member | Type | Description |
|--------|------|-------------|
| `user` | `{ id, name, email, profileId } \| null` | Current session |
| `loading` | `boolean` | True while restoring session from AsyncStorage |
| `login(email, password)` | `Promise<string \| null>` | Returns error string or null on success |
| `logout()` | `Promise<void>` | Clears session |

# Key detail

Password is **never validated**. See [Auth](/auth.md).

# Source

`contexts/AuthContext.tsx` — consumed via `useAuth()` hook.