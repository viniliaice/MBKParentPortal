# Play Store readiness — what is code, and what only the school can do

Two lists: what this repository now satisfies, and what cannot be done from code.
Referenced by `constants/legal.ts`.
Last updated: 2026-09-23.

## A. Satisfied by the project

| Requirement | Where |
| --- | --- |
| Production build is an **AAB** with version auto-increment | `eas.json` → `production.android.buildType: "app-bundle"`, `autoIncrement: true`, `cli.appVersionSource: "remote"` |
| `versionCode` seed for the remote source | `app.json` → `android.versionCode: 1` (first build takes 2) |
| **Explicit permission allow-list** (INTERNET, VIBRATE) with the extras blocked | `app.json` → `android.permissions` + `android.blockedPermissions`; verified in a disposable prebuild — `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` are present only as `tools:node="remove"`, so the merged release artifact does not declare them |
| **Adaptive icon** with a dedicated foreground layer, monochrome layer, brand background | `assets/android-icon-foreground.png` (0 px outside the safe circle), `android-icon-background.png`, `android-icon-monochrome.png`; verified in the prebuild (`mipmap-anydpi-v26/ic_launcher.xml` has background + foreground + monochrome) |
| **Notification icon and colour** | `assets/notification-icon.png` (96×96 white silhouette, generated into `drawable-*/notification_icon.png`), colour `#5784AD` in `values/colors.xml` |
| **Splash** (day and night) | `expo-splash-screen` plugin; verified in the prebuild |
| **In-app account deletion** | `app/account.tsx` → `delete_my_account()` / `request_account_deletion()`; see `docs/account-deletion.md` |
| **In-app privacy policy text** | `app/legal.tsx`, kept in step with `docs/privacy-policy.md` |
| No advertising, no analytics, no location/contacts/camera | `app.json` permissions and the dependency set |
| Device backup of app storage **off** | `android.allowBackup: false`, verified in the prebuild manifest |

## B. Only the school can do these

### Accounts and credentials (EAS)
- [ ] Confirm **EAS credentials** are present for Android (`eas credentials`): an
      upload keystore, and the FCM V1 service account key for push. Nothing was
      printed or copied by this work.
- [x] **Application id decided: `com.MBKConnect`** (`app.json` →
      `android.package`), changed from `com.abdurahmankamal.MBKParentPortal` before
      the first upload, which is the only moment this is free.
- [ ] **Regenerate `google-services.json` with the new package name.** It still
      declares the old one, and the Google Services Gradle plugin fails the build
      with *"No matching client found for package name 'com.MBKConnect'"* when they
      disagree. In the Firebase console: add an Android app with package
      `com.MBKConnect` to the same project, download the new
      `google-services.json`, replace the local file (it is git-ignored, never
      committed). Existing installations under the old package, if any, are a
      separate app to Firebase.
- [ ] Run the first build on the `preview` profile, then `production`
      (`eas build --profile production --platform android`). **No build was
      submitted or published by this work.**
- [ ] Before the first build: `google-services.json` must be regenerated for
      `com.MBKConnect` (Firebase → add an Android app with the new package), or the
      build fails. `npm test` fails on exactly this until it is done.
- [ ] After installing the internal build, walk the app checklist in
      `docs/post-apply-checks.md` §6.

### Play Console listing
- [x] **Privacy policy URL** — published by the school at
      `https://schoolnnnnass.vercel.app/privacy-policy` and set in
      `constants/legal.ts`; the app links to it from Privacy & Data. Enter the same
      URL in Play Console → App content → Privacy policy.
- [x] **Account deletion URL — not required.** Play's deletion requirement applies
      to apps that let users **create an account from within the app** (including
      directing them to a creation flow outside the app). Accounts here are created
      and administered by the school office and the app only signs them in, so the
      requirement is not triggered; the published policy §11 says deletion is
      handled by the school, and the app offers a request instead
      (`docs/account-deletion.md`). The **Data deletion questions in the Data
      safety form are still required for every app** — answer that accounts are not
      created in the app.
- [ ] **Data safety form** — the answers follow `docs/privacy-policy.md` §"What the
      app handles": personal info (name, email, phone), and "app activity"/"other"
      for the school records shown; data collected for app functionality only, not
      shared with third parties, encrypted in transit, deletable on request. The
      processors to declare are Supabase (hosting/database/auth) and Expo/Firebase
      (push delivery).
- [ ] **Target audience and content** — the app is for parents/guardians, not
      children. Declare the audience accordingly; including any child age group
      would pull the listing into the Families policy requirements.
- [ ] **Support contact** and a **school address** for the listing and the policy.
- [ ] If the school has a Google Workspace/Play **organization** account, publish
      under it; otherwise the personal account needs **12 testers for 14 days** of
      closed testing before production access is granted.

### Legal and operations
- [ ] Legal review of `docs/privacy-policy.md` (marked as a draft on purpose).
- [ ] Decide who actions `account_deletion_requests` and who finishes a login
      removal when `authUserDeleted = false`.
- [ ] Rotate the credentials that were previously committed to this repository
      (`docs/security-model.md` §7) **before** any history rewrite.

## B2. Package change checklist (`com.MBKConnect`)

Done in the repository: `app.json` → `android.package`, verified by a disposable
prebuild (`namespace 'com.MBKConnect'`, `applicationId 'com.MBKConnect'`).
Documented in `docs/play-store-readiness.md` and `docs/remediation-report.md`.

Still to do, in this order, and none of it can be done from the repository:

- [ ] **Firebase**: in project **`mbkconnect`**, add an Android app with package
      `com.MBKConnect` and download the new `google-services.json` (expected:
      `project_id = mbkconnect`, `storage_bucket = mbkconnect.firebasestorage.app`).
      `npm test` fails on a wrong-project or wrong-package file
      (`tests/config/app-config.test.mjs`) — deliberately, because the Google
      Services Gradle plugin fails the build for the same reason.
- [ ] Place `google-services.json` locally (git-ignored) **and** in the
      `GOOGLE_SERVICES_JSON` EAS secret (`docs/notifications.md` §2b), then confirm
      `npm test` goes green.
- [ ] **FCM V1 service-account key**: if the key was uploaded to EAS for the old
      package, re-check it — the key is per Firebase project, so it usually still
      applies; the *app registration* is what changed.
- [ ] Any old installations under `com.abdurahmankamal.MBKParentPortal` (if the
      app was ever built and installed) are a **separate app** to Play and to
      Firebase; parents would need to install the new one. This is free only
      because nothing has been published yet.

## C. What is deliberately not claimed

- **No store submission, no release, no push** was performed.
- **No live-database change** is made by the build path; the migrations in this
  repository are inert until someone applies them, and the ones for the live
  schema are listed separately in `docs/schema.md` §6.
- **SDK levels** are not proven here: the prebuild-generated Gradle files do not
  pin them, and the values come from Expo SDK 54 (React Native 0.81) defaults,
  which target Android API 36 — satisfying Play's 2026 target requirement. The
  authoritative check is the first internal build's manifest.
