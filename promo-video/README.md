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

## Authentic-screen policy

All phone UI in the video comes from PNG screenshots captured from the connected Expo Web app. The capture script runs the app source at a 390 × 844 CSS viewport, 2× device scale. The login screen and static learning/lesson screens are real source screens. Parent-data screens are captured in their **actual empty states** because no school Supabase credentials or consented production screenshots were provided. Their lower empty-state area is softly faded in the ad; it is never replaced with made-up marks, grades, names, attendance percentages, homework records, messages, or quiz results.

The capture script uses an ephemeral, local-only auth-cache value to open authenticated routes and intercepts `example.supabase.co` with empty responses. It does not connect to the school's database. No child/parent record or test fixture value appears in the promotional video. `assets/screens/more-empty-dark.png` is retained as a source capture for reference but is not used as a phone shot in the final cut.

Available captured screens:

- `assets/screens/login-light.png`
- `assets/screens/learning-dark.png`
- `assets/screens/lesson-intro-dark.png`
- `assets/screens/lesson-question-dark.png`
- `assets/screens/marks-empty-dark.png`
- `assets/screens/attendance-empty-dark.png`
- `assets/screens/homework-empty-dark.png`
- `assets/screens/messages-empty-dark.png`

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
    capture-app-screens.mjs   # authenticated Expo Web capture, no live data
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

## Somali (Awdal) dub — in progress, blocked on voice sourcing

A Somali-language audio replacement for both cuts is scoped, scripted and
engineered, but **no Somali narration exists yet**, so no dubbed video has been
produced.

| File | Role |
| --- | --- |
| `somali-dub/SCRIPT-somali-awdal.md` | The approved Awdal/Borama Somali script: five lines cued to the long cut's scene beats, one take for the social cut, plus performance direction, dialect rationale, recording spec and voice-rights position |
| `somali-dub/INVESTIGATION-somali-tts.md` | Verified survey of every Somali-capable speech engine, what is ruled out and why, the exact network restriction, and the licensing finding that disqualifies MMS-TTS for commercial use |
| `scripts/generate_somali_voice.py` | Multi-route Somali narration generator (edge-tts / Azure / ElevenLabs / MMS / existing recordings) with a TLS-level preflight that fails loudly instead of producing non-Somali audio |
| `scripts/build-somali-dub.mjs` | Replaces the audio track of the rendered masters. Video is copied bit-for-bit (`-c:v copy`); verified by identical video-stream MD5 |
| `remotion/content.ts` | `LONG_SCRIPT_SO` / `SHORT_SCRIPT_SO` hold the approved Somali copy as source of truth |
| `somali-dub/out/*-GUIDE-PROOF.mp4` | Sync proofs: real picture and music, with a tone blip on each cue. **Not deliverables — they contain no speech** |

The existing English narration, the procedural music bed and the transition
tones are untouched. `final-promo.mp4` and `short-version.mp4` remain the
masters; dub outputs are written only to `somali-dub/`.

Voice rights: Xasan Aadan Samatar's voice is **not** cloned or imitated. No
authorized recording or permission instrument is present in this repository, so
the brief's fallback applies — an original mature Somali male voice in the same
artistic spirit.

```bash
node scripts/build-somali-dub.mjs guide     # sync proof, no voice needed
node scripts/build-somali-dub.mjs measure   # timing QC once takes exist
node scripts/build-somali-dub.mjs all       # build both dubbed cuts
```

## Quality notes

- No release/store badge or “Download Now” claim is shown because the app has not been published according to `docs/play-store-readiness.md`.
- The ad uses only the repository logo, colors, labels, features and source-rendered screens; no AI-generated image replaces app UI.
- The source screenshots are intentionally cropped/masked only for composition and privacy/readability; the visible screen pixels themselves are not reconstructed or populated with synthetic record data.
