# After applying — verification checks

Run these after applying the migrations, and again after any future database change.
They are all read-only. Keep the results with the deployment record.

Last updated: 2026-09-23.

## 1. The functions exist (SQL Editor)

```sql
select p.oid::regprocedure as signature
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('link_profile','set_push_token','clear_push_token','list_contacts',
                    'send_message','mark_message_read','request_account_deletion',
                    'can_message','can_reach_class','can_read_profile')
order by 1;
```

Expected: exactly these ten, and nothing else from that list —

```
can_message(text)                 list_contacts()
can_reach_class(text)             send_message(text,text,text)
can_read_profile(text)            mark_message_read(text)
link_profile()                    request_account_deletion(text)
set_push_token(text)              clear_push_token()
```

`delete_my_account` must **not** appear — deletion is a request the school handles.

## 2. RLS is on everywhere it matters

```sql
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relrowsecurity, relname;
```

Expected: every table `true` **except** `student_lesson_progress` (deliberately left
off — its `student_id` is `uuid` against a `text` student id, so a correct rule
needs that mapping explained first). Anything else showing `false` is worth
reporting: a policy on a table with RLS off does nothing.

## 3. The anon key really gets nothing

```sql
-- Run in the SQL Editor as the anon role would be treated: this is the check that
-- matters, because the anon key ships inside the website and the app bundle.
set role anon;
select count(*) from public.messages;        -- expect 0 rows or a permission error
select count(*) from public.students;        -- expect 0 rows or a permission error
select count(*) from public.report_comments; -- expect 0 rows or a permission error
select count(*) from public.quiz_questions;  -- expect 0 rows or a permission error
reset role;
```

Any non-zero count here is a data exposure and should be reported immediately.

## 4. The policies that matter are present

```sql
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('messages','students','profiles','announcements','report_comments',
                    'quiz_questions','questions','terms','subjects')
order by tablename, policyname;
```

Expected highlights: `students_parent_read`, `messages_participant_read`,
`messages_send_participant`, `messages_mark_read`, `profiles_read_authorized`,
`announcements_parent_read`, `report_comments_parent_read`,
`quiz_questions_parent_read`, and no policy named `Allow authenticated users` on
`profiles` and none named `Enable read access for all users` on `students`.

## 5. Never run this by accident

```sql
-- Confirm the destructive draft is not in the applied set. It must return no row.
select * from supabase_migrations.schema_migrations
where version like '2026092309%';
```

(The six superseded drafts live in `supabase/superseded/`; applying
`…090500_lockdown_rls` would drop every policy on fifteen tables.)

## 6. The app checklist (on a phone, after an internal build)

Sign in as a real parent and confirm, in this order:

| # | Do this | Expect |
| --- | --- | --- |
| 1 | Sign in with a parent account | lands on the app, no error toast |
| 2 | Home / children | the parent's own children only, and marks visible |
| 3 | Attendance, homework | own child's records |
| 4 | Messages → new message | the contact list shows the child's teachers **and the school office** |
| 5 | Send a message to the office | appears in Sent; no "not allowed" error |
| 6 | Reply from a staff account (or ask the office to) | arrives in the parent's inbox |
| 7 | Open the message | the sender's name resolves (not blank) |
| 8 | Announcements, quiz | class notices and the child's quiz load |
| 9 | Report card | comments visible for the child (they were not, before the fix to the dead rule) |
| 10 | More → Close account | sends a request to the school; the account is **not** deleted |
| 11 | Privacy & Data | the summary opens, and "Read the full policy" opens the published page |
| 12 | Sign out | no push notification arrives on this device afterwards |

If a step fails, the error text and the step number are enough for me to locate it —
the database side of each step is a named function or policy above.
