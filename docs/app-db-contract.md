# App ↔ database contract

Everything the app asks of the database: the seven functions it calls, the tables it
reads, and which of those exist in the live project. Written because the drafts that
described them were written for the schema this repository used to recreate, so the
app's writes had no implementation on the live side.

Last updated: 2026-09-23.

## The functions the app calls

Delivered by `20260923106000_parent_app_functions.sql` (not yet applied).

| Function | Called from | Contract | Live before |
| --- | --- | --- | --- |
| `link_profile()` | sign-in (`context/AuthContext.tsx`) | returns the caller's profile row (`id, name, email, role, class_name`); claims a school-provisioned profile on first sign-in by exact email match, only when `auth_id` is NULL | missing |
| `clear_push_token()` | sign-out | clears the caller's own token | missing |
| `set_push_token(p_token)` | first launch | stores the caller's own token in `expo_push_token` (the column delivery reads) | missing |
| `list_contacts()` | messages screen | who the caller may write to: a parent gets their children's teachers, a teacher the families in their classes, the office the directory | missing |
| `send_message(p_recipient, p_subject, p_body)` | messages screen | inserts with the **caller** as sender and only to a permitted recipient (via `can_message()`); returns the new id | missing |
| `mark_message_read(p_message)` | messages screen | sets `"readAt"`, and only for the recipient | missing |
| `request_account_deletion(p_reason)` | Account → delete | records a request for the office; deletes nothing | missing |
| ~~`delete_my_account()`~~ | — | **removed by decision**: self-service deletion is not offered, because accounts are created and administered by the school (Play's deletion requirement is triggered by in-app account creation — `docs/account-deletion.md`) | missing, and must stay missing (`tests/db/rpc.test.mjs` asserts it) |

All of them are `SECURITY DEFINER` (they need to act across tables) and therefore
re-check every relationship themselves — the sender never comes from the client, the
recipient is checked against the class relationship, and the read receipt is
recipient-only. Execute is granted to `authenticated` and revoked from `anon` and
`PUBLIC`.

## Tables the app reads

`students`, `exams`, `attendance`, `homework`, `quizzes`, `quiz_questions`,
`quiz_attempts`, `messages`, `announcements`, `academic_years` — all covered by the
policies in `docs/schema.md` §6.

**Not in the live database at all** (`app/` still queries them, so those screens
fail today):

| Queried | Status |
| --- | --- |
| `lesson_progress`, `lesson_attempts`, `gamification` | the tables do not exist in the project; the learning/XP screens have no data behind them |
| `student_lesson_progress` | exists, RLS off, and `student_id` is `uuid` while `students.id` is `text`, so a row cannot be attributed to a child |

This needs a product decision, not a code fix: either the school creates those
tables, or the app's learning screens come out. Until then the screens should not be
shown to parents.

## Columns this work stopped assuming

Three identifiers appeared in the app, the edge function and the superseded drafts
that do not exist in the live schema. All three are now either derived, looked up, or
gone:

| Assumed | Live reality | What was done |
| --- | --- | --- |
| `students."retentionStatus"` | does not exist | the deletion function no longer writes it; retention is recorded in `retained_academic_records` + `account_deletion_requests."retainedCount"` |
| `profiles.class_name` | classes live in `profiles."assignedClasses"` (jsonb) and `class_subjects` | relation logic uses `class_subjects` + `students."className"`; the display column is derived from the jsonb array |
| `profiles.expo_push_token` | **unconfirmed** — the project's token column name is not known | `set_push_token()` / `clear_push_token()` look the column up among the three plausible names and raise `no_push_token_column` rather than failing the migration |

## The pre-flight check — a gate, not a formality

```sql
-- Do these already exist? If yes, they may be the website's implementations and
-- applying 20260923106000 would replace them. Send the output here first.
select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('link_profile','set_push_token','clear_push_token',
                    'list_contacts','send_message','mark_message_read',
                    'request_account_deletion','delete_my_account')
order by 1;
```

An empty result means it is safe to paste the file. Anything else must be compared
first — the app and the website share this database, and the website is not in this
repository.

## Push tokens: settled

`profiles` has **both** `expo_push_token` and `fcm_token`.

| Column | Who uses it |
| --- | --- |
| `expo_push_token` | this app: it registers with `Notifications.getExpoPushTokenAsync()`, and the delivery function posts to `exp.host` and reads the same column |
| `fcm_token` | a different flow (not this repo). The app neither writes nor clears it |

`set_push_token()` / `clear_push_token()` write `expo_push_token` explicitly — an
earlier draft looked the column up at runtime because the name was unknown; it is
known now, so the guesswork is gone and a test asserts `fcm_token` is left alone.

## Who may write to whom

`can_message()` (fixed in `20260923107000` after `20260923104000` accidentally cut
the office off) and `list_contacts()` are kept symmetric, so the app never shows a
contact it cannot write to:

| Caller | Contacts / recipients |
| --- | --- |
| `admin`, `supervisor`, `office` | anyone |
| `teacher` | the families of the students in their classes, plus other staff |
| `parent` | the teachers of their children's classes, plus `office` and `admin` |

A parent can never reach another parent, and a teacher can never reach another
class's families. The parent → office path exists because the school's published
privacy policy §11 tells parents they can send a request from the Messages section.

## Verification

`tests/db/rpc.test.mjs` — 20 assertions on the production-shaped fixture: sign-in for a
linked and an unclaimed profile, contacts per role, sender stamped from the session,
refusals for an unrelated recipient / unknown id / self / empty / over-long content,
recipient-only read receipts, token store + clear, deletion request recorded without
deleting, the trail readable by administrators only, full deletion preserving the
children and their marks while removing the account's own data, last-admin refusal,
and anonymous callers refused on every function.
