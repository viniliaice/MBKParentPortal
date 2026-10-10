export type SceneId =
  | 'hook'
  | 'problem'
  | 'marks'
  | 'attendance-homework'
  | 'communications'
  | 'learning-ecosystem'
  | 'cta';

export type StoryScene = {
  id: SceneId;
  durationSeconds: number;
  transition: 'rise' | 'wipe' | 'push' | 'zoom' | 'orbit' | 'soft';
};

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Brand tokens sampled from constants/colors.ts and the MBK crest. */
export const BRAND = {
  midnight: '#0B1026',
  navy: '#0F1B3D',
  card: '#141D3A',
  blue: '#3D5AFE',
  cyan: '#00BCD4',
  logoBlue: '#5784AD',
  gold: '#F6C90E',
  white: '#FFFFFF',
  muted: '#A2ABC9',
  green: '#2ECC71',
};

/** Five feature pillars confirmed in the connected app's routes and source. */
export const FEATURES = [
  {
    id: 'marks',
    title: 'Marks & reports',
    detail: 'Monthly · Midterm · Final',
    icon: 'chart' as const,
    screen: 'screens/marks-empty-dark.png',
  },
  {
    id: 'attendance',
    title: 'Attendance',
    detail: 'Daily records per child',
    icon: 'calendar' as const,
    screen: 'screens/attendance-empty-dark.png',
  },
  {
    id: 'homework',
    title: 'Homework',
    detail: 'Pending · Submitted · Graded',
    icon: 'book' as const,
    screen: 'screens/homework-empty-dark.png',
  },
  {
    id: 'communications',
    title: 'School messages',
    detail: 'Inbox · Announcements · Sent',
    icon: 'message' as const,
    screen: 'screens/messages-empty-dark.png',
  },
  {
    id: 'learning',
    title: 'Learning & practice',
    detail: 'Math · English · Class quizzes',
    icon: 'sparkle' as const,
    screen: 'screens/learning-dark.png',
  },
] as const;

export const LONG_SCRIPT =
  "Stay close to your child's school day. MBK Parent Portal brings key school updates together. Follow marks and reports, check attendance, and keep homework in view. Read messages and school announcements in one place. For students, lessons, practice, and class quizzes keep learning moving. Sign in with the email your school registered for you.";

export const SHORT_SCRIPT =
  "Stay close to your child's school day. See marks, attendance, homework and school messages. Explore lessons and class quizzes. MBK Parent Portal. Sign in with your registered email.";

/** Long-cut narration starts at scene beats so the copy lands with the real UI. */
export const LONG_VOICE_SEGMENTS = [
  { file: 'audio/voiceover-long-01.mp3', fromSeconds: 0 },
  { file: 'audio/voiceover-long-02.mp3', fromSeconds: 12 },
  { file: 'audio/voiceover-long-03.mp3', fromSeconds: 21 },
  { file: 'audio/voiceover-long-04.mp3', fromSeconds: 28 },
  { file: 'audio/voiceover-long-05.mp3', fromSeconds: 35 },
] as const;

/** 4 + 5 + 6 + 6 + 7 + 7 + 6 = 41 seconds. */
export const LONG_STORY: StoryScene[] = [
  { id: 'hook', durationSeconds: 4, transition: 'rise' },
  { id: 'problem', durationSeconds: 5, transition: 'wipe' },
  { id: 'marks', durationSeconds: 6, transition: 'push' },
  { id: 'attendance-homework', durationSeconds: 6, transition: 'zoom' },
  { id: 'communications', durationSeconds: 7, transition: 'push' },
  { id: 'learning-ecosystem', durationSeconds: 7, transition: 'orbit' },
  { id: 'cta', durationSeconds: 6, transition: 'soft' },
];

/** 15-second cut: the same real screens and claims, condensed for social. */
export const SHORT_STORY: StoryScene[] = [
  { id: 'hook', durationSeconds: 2.5, transition: 'rise' },
  { id: 'marks', durationSeconds: 2.5, transition: 'wipe' },
  { id: 'attendance-homework', durationSeconds: 2.5, transition: 'push' },
  { id: 'communications', durationSeconds: 2.5, transition: 'zoom' },
  { id: 'learning-ecosystem', durationSeconds: 2.5, transition: 'orbit' },
  { id: 'cta', durationSeconds: 2.5, transition: 'soft' },
];

export const LONG_DURATION_SECONDS = LONG_STORY.reduce((sum, scene) => sum + scene.durationSeconds, 0);
export const SHORT_DURATION_SECONDS = SHORT_STORY.reduce((sum, scene) => sum + scene.durationSeconds, 0);

/* ------------------------------------------------------------------------- *
 * Somali (Awdal / Borama) narration — approved script.
 *
 * This copy is the recorded source of truth for the Somali dub. It is not yet
 * wired into LONG_VOICE_SEGMENTS / SHORT_SCRIPT above because no licensed
 * Somali voice recording exists in the repository; repointing the audio now
 * would break the Remotion render. The dub is produced from these lines by
 * `scripts/build-somali-dub.mjs`, which replaces the audio track of the
 * rendered masters with `-c:v copy` (picture untouched).
 *
 * Full timing, performance direction, dialect rationale and the recording
 * specification live in `somali-dub/SCRIPT-somali-awdal.md`.
 *
 * Voice rights: Xasan Aadan Samatar's voice is NOT cloned or imitated. No
 * authorized recording or permission instrument is present in this
 * repository, so the brief's fallback applies — an original mature Somali
 * male voice in the same artistic spirit.
 * ------------------------------------------------------------------------- */

/** Awdal Somali, five lines cued to the same beats as LONG_VOICE_SEGMENTS. */
export const LONG_SCRIPT_SO = [
  // cue 0 s — hook + "The school day moves fast."
  'Waalid, ilmahaaga maalintiisa dugsiga ha ka maqnaan. MBK Parent Portal ayaa wararka dugsiga meel keliya kuu keenaya.',
  // cue 12 s — marks/reports, attendance, homework
  'La soco dhibcaha iyo warbixinnada, xaqiiji xaadirinta, shaqada gurigana indhaha ku hay.',
  // cue 21 s — school messages and announcements
  'Fariimaha iyo ogeysiisyada dugsiga hal meel ka akhri.',
  // cue 28 s — lessons, practice and class quizzes
  'Ardaydana casharrada, layliyada iyo imtixaannada fasalka ayaa waxbarashada sii wadaya.',
  // cue 35 s — call to action
  'MBK Parent Portal — ku gal iimaylka uu dugsigu kuu diiwaangeliyay.',
] as const;

/** Awdal Somali, single take for the 15 s social cut. */
export const SHORT_SCRIPT_SO =
  'Ilmahaaga maalintiisa dugsiga ha ka maqnaan. Dhibcaha, xaadirinta, shaqada guriga iyo fariimaha hal meel ka arag. Casharrada iyo imtixaannada fasalkana raac. MBK Parent Portal — ku gal iimaylka laguu diiwaangeliyay.';

/** Where the Somali takes are expected once recorded. */
export const SOMALI_VOICE_DIR = 'assets/audio/somali';
export const LONG_VOICE_SEGMENTS_SO = LONG_SCRIPT_SO.map((line, index) => ({
  file: `somali-long-0${index + 1}.wav`,
  fromSeconds: LONG_VOICE_SEGMENTS[index].fromSeconds,
  /** Must finish before this, or the line collides with the next scene beat. */
  endsBeforeSeconds:
    index + 1 < LONG_VOICE_SEGMENTS.length ? LONG_VOICE_SEGMENTS[index + 1].fromSeconds : LONG_DURATION_SECONDS,
  text: line,
}));
