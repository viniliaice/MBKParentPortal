---
type: Concept
title: Auth
description: Custom email-based authentication that bypasses Supabase Auth entirely.
tags: [auth, session]
timestamp: 2026-07-24T14:00:00Z
---

# Overview

Authentication is a custom implementation in `contexts/AuthContext.tsx` that
looks up the email in the Supabase [Profiles](/supabase/profiles.md) table.
**The password argument is accepted but ignored** — any email in the table
can log in. This is a known defect, not a pattern.

# Flow

1. User enters email and password on login screen
2. `AuthContext.login()` queries `profiles` table by email (lowercased)
3. If found, session is persisted to AsyncStorage key `@mbk_auth_user`
4. If not found, returns error message "Parent account not found with this email."
5. `AuthGate` in the root layout redirects unauthenticated users to `/login`

# Persistence

On app launch, `AuthProvider` reads `@mbk_auth_user` from AsyncStorage to
restore the session without network.

# Logout

Clears AsyncStorage and sets user to null, which triggers the AuthGate redirect.