# Push notifications

Covers the Android channel, the icon and colour, tap routing, how a device token
is stored, and the server side that sends the push. This must stay in step with
`lib/notifications.ts`, `app/_layout.tsx`, `app.json` and
`supabase/functions/send-notification/index.ts`.
Last updated: 2026-09-23.

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
