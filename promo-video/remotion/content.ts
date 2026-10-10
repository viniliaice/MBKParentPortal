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
    screen: 'screens/marks-demo-dark.png',
  },
  {
    id: 'attendance',
    title: 'Attendance',
    detail: 'Daily records per child',
    icon: 'calendar' as const,
    screen: 'screens/attendance-demo-dark.png',
  },
  {
    id: 'homework',
    title: 'Homework',
    detail: 'Pending · Submitted · Graded',
    icon: 'book' as const,
    screen: 'screens/homework-demo-dark.png',
  },
  {
    id: 'communications',
    title: 'School messages',
    detail: 'Inbox · Announcements · Sent',
    icon: 'message' as const,
    screen: 'screens/messages-demo-dark.png',
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
