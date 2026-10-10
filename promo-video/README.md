# MBK Parent Portal — promotional video

A Remotion project for a cinematic, vertical promotion of the real MBK Parent Portal Expo app. The long cut is **41 seconds**; the social cut is **15 seconds**. Both are rendered at **1080 × 1920, 30 fps, 9:16**, H.264 with AAC audio.

## Product review

- **Product:** MBK Parent Portal
- **Audience:** parents and guardians of MBK pupils (parent accounts only)
- **App stack:** React Native 0.81 / Expo SDK 54, Expo Router; Android and iOS targets, with Expo Web used for source-screen capture
- **Brand:** the supplied MBK crest (`../assets/logo.png`); navy `#0B1026`, indigo `#3D5AFE`, cyan `#00BCD4`, plus the crest blue `#5784AD` from the app configuration
- **Feature pillars in the ad:** marks/reports (monthly, midterm and final), attendance records, homework status, school messages/announcements, and student lessons/practice/class quizzes
- **CTA:** “Use the email address your school registered for you.” This follows the actual login screen and school-managed account model. There are intentionally **no Google Play or App Store badges**: the repository's Play Store readiness checklist says no store submission/release has happened.

The feature claims were checked against `README.md`, `app/(tabs)`, `components/MarksScreen.tsx`, `app/attendance.tsx`, `app/homework.tsx`, `app/(tabs)/messages.tsx`, `app/(tabs)/learning.tsx`, `app/quizzes`, and `data/learningData.ts`.

## Authentic-screen and demo-data policy

Every phone UI image is a PNG captured from the actual Expo Web app at a 390 × 844 CSS viewport and 2× device scale. The app itself renders the layouts; the video does not reconstruct or paint over its UI. The login and learning/lesson screens use the app's real source content.

To make the parent-data screens visually useful, `scripts/demo-data.mjs` supplies fictional, internally consistent sample records through Playwright interception of `example.supabase.co` during capture only. It never contacts or writes to the school's database. The sample identity is `Demo Student` (Grade 5A); marks, attendance, homework, messages and notices are illustrative—not real pupil or school records. Scenes that show those records carry an **ILLUSTRATIVE DEMO DATA** disclosure. No real child or parent data is included.

The former `*-empty-dark.png` captures are kept as reference examples of the app's genuine empty states; the master and social cut use the new `*-demo-dark.png` captures.

Captured screens include:

- `assets/screens/login-light.png`
- `assets/screens/home-demo-dark.png`
- `assets/screens/marks-demo-dark.png`
- `assets/screens/attendance-demo-dark.png`
- `assets/screens/homework-demo-dark.png`
- `assets/screens/messages-demo-dark.png`
- `assets/screens/announcements-demo-dark.png`
- `assets/screens/more-demo-dark.png`
- `assets/screens/learning-dark.png`
- `assets/screens/lesson-intro-dark.png`
- `assets/screens/lesson-question-dark.png`
- Original empty-state references: `marks-empty-dark.png`, `attendance-empty-dark.png`, `homework-empty-dark.png`, `messages-empty-dark.png`, and `more-empty-dark.png`.

## Storyboard and copy

| Time | Scene | Real screen / source-backed features |
| --- | --- | --- |
| 0–4 s | Hook | MBK crest, login screen, “Stay close to their school day.” |
| 4–9 s | Problem | Parent-focused feature overview; marks, attendance, homework, messages |
| 9–15 s | Marks | Actual Marks screen; monthly, midterm, final report periods |
| 15–21 s | Attendance + homework | Actual Attendance and Homework screens; daily records and status filters |
| 21–28 s | School communications | Actual Messages screen; inbox, announcements and sent |
| 28–35 s | Learning ecosystem | Actual Learning dashboard and authored lesson screens; Math, English, practice and class quizzes |
| 35–41 s | CTA | Actual login screen, crest and school-registered-email CTA |

The 15-second social cut reuses the same source screens in six 2.5-second beats: hook, marks, attendance/homework, school communications, learning, and CTA.

Long-cut narration:

> Stay close to your child's school day. MBK Parent Portal brings key school updates together. Follow marks and reports, check attendance, and keep homework in view. Read messages and school announcements in one place. For students, lessons, practice, and class quizzes keep learning moving. Sign in with the email your school registered for you.

Short-cut narration:

> Stay close to your child's school day. See marks, attendance, homework and school messages. Explore lessons and class quizzes. MBK Parent Portal. Sign in with your registered email.

## Project layout

```text
promo-video/
  final-promo.mp4             # final 41-second master
  short-version.mp4           # 15-second social cut
  preview.mp4                 # half-resolution review render
  thumbnail.png               # still from the opening scene
  remotion/                   # master composition, data and reusable components
  assets/
    mbk-logo.png              # copied, unchanged from the app's supplied logo
    screens/                  # screenshots captured from the actual Expo app
    fonts/                    # Inter + Noto Color Emoji, with OFL license files
    audio/                    # generated narration, original score and transitions
  scripts/
    capture-app-screens.mjs   # Expo Web capture with local fixture interception
    demo-data.mjs             # synthetic, capture-only student/demo records
    generate-music.mjs        # original procedural score and transition tones
    normalize-audio.mjs       # loudness mastering for MP4 renders
    run-remotion.mjs          # local browser setup + Remotion CLI wrapper
```

## Build / reproduce

1. Install the Expo app dependencies at the repository root and run the app with **dummy capture-only** Supabase values. Do not put school credentials in this project:

   ```bash
   cd ..
   EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co \
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJub25lIiwicmVmIjoiZXhhbXBsZSJ9.capture-only \
   npx expo start --web --host lan --port 8081
   ```

2. In another shell, from `promo-video/`, install the isolated Remotion dependencies, capture real screens, and regenerate the original no-stock-music score:

   ```bash
   npm ci
   npm run capture-app
   npm run audio:music
   ```

3. The long narration is generated as five sentence-level clips and placed on the matching scene beats; the social cut uses one short narration file. The delivered MP3s are in `assets/audio/voiceover-long-*.mp3` and `assets/audio/voiceover-short.mp3`. Their text is the narration printed above, and the long-clip offsets are data-driven in `remotion/content.ts`.

4. Render and review:

   ```bash
   npm run render:preview
   npm run render:final
   npm run render:short
   npm run render:thumbnail
   ```

`run-remotion.mjs` inflates the Chromium runtime shipped with `@sparticuz/chromium`; Remotion supplies its own FFmpeg binary. No system Chrome or system FFmpeg install is required. `npm run studio` opens Remotion Studio.

## Audio / licenses

The ambient bed and transition tones are generated from scratch by `scripts/generate-music.mjs`; no stock music or third-party audio track is used. The narration is generated speech. Each MP4 render is loudness-mastered by `scripts/normalize-audio.mjs` to a -16 LUFS / -1.5 dBTP target. Inter and Noto Color Emoji font files are distributed under their respective SIL Open Font License notices in `assets/fonts/`. Noto Color Emoji is used only as a browser fallback when capturing the app's authored lesson emoji on Linux.

## Quality notes

- No release/store badge or “Download Now” claim is shown because the app has not been published according to `docs/play-store-readiness.md`.
- The ad uses only the repository logo, colors, labels, features and source-rendered screens; no AI-generated image replaces app UI.
- The phone pixels are unaltered Expo captures. Synthetic records enter only through capture-time API interception and are disclosed in-video; no fake records are painted into screenshot files.
