# Push notifications

Covers the Android channel, the icon and colour, tap routing, how a device token
is stored, and the server side that sends the push. This must stay in step with
`lib/notifications.ts`, `app/_layout.tsx`, `app.json` and
`supabase/functions/send-notification/index.ts`.
Last updated: 2026-09-23.

## 0. Current state — the seven links in the chain

Push needs all seven. A missing link produces silence, not an error, which is why
each one has a check.

| # | Link | State | Check |
| --- | --- | --- | --- |
| 1 | **`google-services.json` with `com.MBKConnect`** present in the build | **needs the new file** — the copy in the project still declares the old package | `npm test` → passes when the file matches `android.package` |
| 2 | **EAS uploads that file** — it is git-ignored, and EAS Build uploads only what is not ignored | **done**: `.easignore` includes it (and `.env`) with `!` entries, asserted by `tests/config/app-config.test.mjs` | EAS build log: no `"google-services.json" is missing` |
| 3 | **App registers a token and stores it** — permission, channel, `getExpoPushTokenAsync`, `set_push_token()` | **done** (client code + function applied). Android 13+ `POST_NOTIFICATIONS` comes from the `expo-notifications` library manifest and merges into the APK | after one launch: `select expo_push_token from profiles where id = '<parent id>';` → non-null |
| 4 | **FCM V1 credentials on the EAS project** — Expo's push service needs them to reach Android | **not done** (cannot be done from the repository) | EAS → Project → Credentials → Android → *Push notifications* shows an FCM V1 service account |
| 5 | **The delivery function deployed** — `send-notification`, with JWT verification **off** | **needs redeploy** with the hardened code and `verify_jwt = false` (§4) | Edge Functions → `send-notification` → *Enforce JWT verification* is off; a test insert logs a line |
| 6 | **A trigger that calls it on a new message/announcement**, sending the `x-webhook-secret` header | **half done**: `call_push_notification()` exists and posts the record, but **sends no `x-webhook-secret`** — fix it with §3b before enabling the secret | inserting a message produces a function log line |
| 7 | **Tap routing, icon and colour** | **done** (client code) | a delivered notification shows the "M" icon in brand blue and opens the thread |

### Check link 6 — does the trigger exist, and does it send the header?

```sql
select tgname, pg_get_triggerdef(t.oid) as definition
from pg_trigger t
where t.tgrelid in ('public.messages'::regclass, 'public.announcements'::regclass)
  and not t.tgisinternal;

-- the function the trigger calls
select p.oid::regprocedure as signature, pg_get_functiondef(p.oid) as definition
from pg_proc p
where p.pronamespace = 'public'::regnamespace
  and (p.proname ilike '%notif%' or p.proname ilike '%push%' or p.proname ilike '%webhook%');
```

- **No rows** → nothing sends anything yet; a trigger is needed (that is a migration,
  and it can be written next).
- **Rows, but no `x-webhook-secret`** → the deployed function (which checks the
  header) answers **401** and every push fails silently. Order matters here: deploy
  the function → add the header to the trigger → verify a push → only then set
  `PUSH_WEBHOOK_SECRET`. Until the secret is set, the function logs a warning and
  continues, so nothing breaks in between.

### 3b. The trigger's missing header — paste this

Your `call_push_notification()` posts the record but sends only `Content-Type`.
The function rejects a call without `x-webhook-secret` once the secret is set, so
the two must be changed together. **Generate the secret first, on your own machine:**

```bash
openssl rand -hex 32
```

Then run this in the SQL Editor (it replaces the function only — the trigger keeps
pointing at it, and no data is touched):

```sql
CREATE OR REPLACE FUNCTION public.call_push_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  -- The same value you will set as PUSH_WEBHOOK_SECRET on the edge function.
  -- It never goes in the repository: this function definition lives in the
  -- database, and only administrators can read it.
  v_secret constant text := 'PASTE-YOUR-GENERATED-SECRET-HERE';
BEGIN
  PERFORM net.http_post(
    url := 'https://qopeilyvkfqbjdeudwnz.supabase.co/functions/v1/send-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object('record', row_to_json(NEW))
  );
  RETURN NEW;
END;
$function$;
```

Two ordering rules, because getting them backwards produces silence rather than an
error:

1. **Deploy the function first** (§4). Its current deployed version does not check
   the header, so the trigger above works with either version — but a function that
   checks the header with a trigger that does not send it returns 401.
2. **Set `PUSH_WEBHOOK_SECRET` last**, once §4 is deployed and a test insert shows a
   log line. Until then the function warns and continues, so nothing breaks in
   between.

(If you would rather the secret not sit in a function definition at all, Supabase
Vault is the alternative: store it once with `vault.create_secret()`, read it in the
trigger with `vault.decrypted_secrets`, and keep the same environment variable on the
function. Say the word and I will write that version.)

### 4. Deploying the function (edge functions → send-notification)

**Either path works; both need the same two settings.**

*Dashboard:* Supabase → **Edge Functions** → `send-notification` → open it → paste
the contents of `supabase/functions/send-notification/index.ts` → **Deploy**. Then:
- **Settings → turn "Enforce JWT verification" OFF.** Without this the trigger's
  call is rejected with 401 before the function runs, because pg_net sends no
  Authorization header. The request is authenticated by the webhook secret instead.
- **Secrets → add `PUSH_WEBHOOK_SECRET`** with the value you generated in §3b.
  (`SUPABASE_SERVICE_ROLE_KEY` is provided by Supabase automatically.)

*CLI:*

```bash
supabase login
supabase link --project-ref qopeilyvkfqbjdeudwnz
supabase functions deploy send-notification      # config.toml already sets verify_jwt = false
supabase secrets set PUSH_WEBHOOK_SECRET=<the value from §3b>
```

`supabase/config.toml` in this repository carries that setting, so a CLI deploy does
the right thing without extra flags. Only the function is deployed — **do not run
`supabase db push`** (see `docs/schema.md`).

*Check it:* insert a message from a parent to their child's teacher, then look at
Edge Functions → `send-notification` → **Logs**. You should see the summary line for
the call, and either a delivery result or `No push token` for a parent who has not
installed the app.

### 4b. FCM V1 credentials on the EAS project

This is what lets Expo's push service hand a notification to Google for delivery to
the device. Two different files are involved, and only one goes in the repository:

> This is the one people forget. Without it, `getExpoPushTokenAsync()` still returns a
> token and `set_push_token()` still stores it — and the push never arrives.

| File | Where it lives | In the repo? |
| --- | --- | --- |
| `google-services.json` | inside the app build (it identifies the Firebase app to the device) | **gitignored**, included in the EAS upload via `.easignore` |
| FCM **V1 service-account key** | EAS servers, used to *send* | **never** — it is a credential |

**Get the key (Firebase console):**

1. <https://console.firebase.google.com> → project **mbk-parent-portal** → ⚙️
   **Project settings** → **Service accounts** tab.
2. **Generate new private key** → confirm → a `.json` file downloads. This is the
   FCM V1 key. Treat it like a password: do not email it, do not commit it, and do
   not paste it into chat.
3. If pushes later fail with a 403 from Google, enable the **Firebase Cloud
   Messaging API** for the project in Google Cloud Console (APIs & Services →
   Library) and try again.

**Upload it to EAS** — dashboard (easiest):

1. <https://expo.dev> → your project → **Credentials** → **Android**.
2. **Push notifications (FCM V1)** → **Upload** → choose the JSON from step 2.

or CLI:

```bash
eas credentials            # Android → Push notifications (FCM V1) → upload the JSON
```

**Test delivery without the database trigger** (isolates links 3 and 4 from 5 and 6):
copy a parent's stored token —

```sql
select id, expo_push_token from profiles where expo_push_token is not null;
```

— paste it into <https://expo.dev/notifications> and send a test message. If it
arrives, the app side and the FCM key are correct, and anything still failing is in
the trigger or the function. If nothing arrives, the key is the first suspect.
Notifications reach **physical devices only** (not emulators without Play services),
and the app asks for permission on first launch — accept it.

### Exact order to finish this

1. Replace `google-services.json` at the project root with the new download (package
   `com.MBKConnect`). Confirm: `npm test`.
2. `eas credentials` → Android → the project → **Push notifications** → upload the
   FCM V1 service-account JSON. Get it from Firebase → Project settings →
   *Service accounts* → **Generate new private key** (the account needs the
   *Firebase Cloud Messaging API* admin role). Only `google-services.json` may sit
   in the repo — this key is a secret and must not be committed.
3. `supabase functions deploy send-notification`
4. Run the trigger query above, then add the header to the trigger (or send me the
   output and I will write the migration).
5. `eas build --profile preview --platform android`, install on a **physical**
   device with Play services, sign in, and confirm the token is stored (link 3).
6. Send a message from a staff account and watch for the notification.

## 1. Client

- **Channel.** One Android channel, `default`, declared in `app.json` through the
  `expo-notifications` plugin with `defaultChannel: "default"`. Created at runtime
  by `configureNotificationHandling()` so a device that installs the app before
  the first push still has it.
- **Icon and colour.** `assets/notification-icon.png` — a 96×96 white "M" (Android
  requires a white-on-transparent silhouette; the file is referenced by the plugin
  config together with `#5784AD`). Changing either requires a rebuild: they are
  compiled into the app, not fetched.
- **Permission.** Asked once, on first launch, after the parent has signed in —
  asking before sign-in gets declined more often and cannot be re-asked.
- **Tap routing.** `handleNotificationResponse()` reads
  `notification.request.content.data` and routes to the message thread or the
  announcements screen; anything unrecognised falls back to the tabs. Routing is
  deliberately data-driven, so a payload change does not need an app release to
  stop crashing.
- **Foreground behaviour.** `shouldShowBanner` / `shouldShowList` (the current API;
  `shouldShowAlert` is deprecated).

## 2. Token handling

- The token lives in `profiles.expo_push_token`. The app registers an **Expo** push
  token (`Notifications.getExpoPushTokenAsync()`) and the delivery function posts to
  `exp.host`, so both ends use the same column. `profiles.fcm_token` also exists but
  belongs to a different flow: the app neither writes nor clears it, and a test
  asserts that.
- The token is written by the `set_push_token()` function and cleared by
  `clear_push_token()` — never by a direct table write, because the `profiles`
  table no longer accepts client writes (see `docs/security-model.md` §5).
  **These two functions are part of the pending migration set**; until they are
  applied, push registration cannot store a token, and the app degrades by
  simply not receiving pushes rather than failing.
- Sign-out calls `clear_push_token()` so a handed-on phone stops receiving the
  previous parent's notifications.
- **Tokens are never logged**, on either side: the edge function logs only counts
  and, on error, a message that excludes the token.

## 3. Server side

`supabase/functions/send-notification/index.ts`:

- requires the `x-webhook-secret` header to match the `PUSH_WEBHOOK_SECRET`
  environment variable (401 otherwise); when the variable is unset the function
  logs a warning and continues, so deploying the new code does not break an
  existing trigger;
- reads the service-role key from the environment only, and never logs it;
- sends in batches of at most 100, and returns a summary (`ok=` / `error=`)
  instead of echoing the payload;
- accepts exactly two record shapes (a new message, or an announcement) and
  returns 400 for anything else.

**The matching database change is not optional:** the `pg_net` trigger currently
posts without a header. Setting `PUSH_WEBHOOK_SECRET` without updating the
trigger to send `x-webhook-secret` would make every push fail with 401. The order
is: update the trigger to include the header → verify a push → set the secret.

## 4. Manual steps for the school

- [ ] Upload the **FCM V1 service-account key** to EAS
      (`eas credentials` → Android → Push notifications). Without it, production
      Android pushes do not arrive; Expo Go cannot test this.
- [ ] Deploy the edge function and set `PUSH_WEBHOOK_SECRET`
      (`supabase secrets set PUSH_WEBHOOK_SECRET=…`), then update the trigger to
      send the header as described in §3.
- [ ] Test on an **internal build** (EAS `internal` profile, not Expo Go): send a
      message, an announcement and a tap-through, and confirm the icon and colour
      on Android 13+.

## 5. What is verified

Client-side behaviour is code-reviewed; the channel, icon and colour are
configuration and are checked by the disposable prebuild inspection
(`docs/schema.md` and the prebuild check in the remediation report). The edge
function type-checks under Deno (`deno check --no-remote --config
tests/deno-stubs/deno.json supabase/functions/send-notification/index.ts`), which
is a type check, not a delivery test: **no push test has been run against a real
Firebase project from this environment.**
