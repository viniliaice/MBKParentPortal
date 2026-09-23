# Superseded migration drafts — never run these

These six files were written for the schema this repository *recreated* (uuid
primary keys, `class_name`, no pre-existing policies). The live database is
different — text primary keys, `profiles.id` as a school business id, staff
classes in `class_subjects`, and a live policy set that this work extends rather
than replaces — so none of them can run there.

They were moved out of `supabase/migrations/` for one reason: `supabase db push`
applies every `.sql` file in that directory, and `20260923090500_lockdown_rls.sql`
drops every policy on fifteen tables before recreating them. Applied to the live
project that file would take away every access rule the school's users depend on.
Nothing in this directory is applied by tooling.

What replaced them, by subject:

| Superseded file | Superseded by |
| --- | --- |
| `…090000_schema_reconciliation` | not needed — the live schema already has the canonical column names |
| `…090200_quiz_schema` | not needed — the live quiz contract is authoritative (`questionOrder ∈ {created, randomized}`) |
| `…090300_auth_identity_model` | not needed — `current_profile_id()` / `current_profile_role()` already exist and resolve `auth.uid()` → `profiles.auth_id` |
| `…090500_lockdown_rls` | **`20260923101000` → `…105000`** in `supabase/migrations/`, all additive |
| `…091000_messaging_rpc` | the rules in `20260923104000_enable_rls_close_public_tables.sql` |
| `…092000_account_deletion` | **still needed, not yet rewritten** — it holds `delete_my_account()` / `request_account_deletion()`, which must be rewritten for text ids before the in-app deletion path can work; see the outstanding list in `docs/remediation-report.md` |

Kept rather than deleted because the last two remain the working notes for that
rewrite, and because a reviewer may want to see what was replaced.
