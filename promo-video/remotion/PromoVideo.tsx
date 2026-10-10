import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {
  Background,
  CTA,
  DeviceZoom,
  Eyebrow,
  FeatureCard,
  FontFaces,
  LogoReveal,
  PhoneFrame,
  Scene,
  ScreenTransition,
  TextReveal,
} from './components';
import {
  BRAND,
  FPS,
  LONG_STORY,
  LONG_VOICE_SEGMENTS,
  SHORT_STORY,
  type SceneId,
  type StoryScene,
} from './content';

function FeatureChip({ label, delay = 0, color = BRAND.cyan }: { label: string; delay?: number; color?: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = Math.max(0, frame - delay);
  const progress = interpolate(t, [0, Math.round(fps * 0.4)], [0, 1], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '15px 22px',
        borderRadius: 30,
        border: `1px solid ${color}58`,
        background: `linear-gradient(110deg, ${color}1E, rgba(255,255,255,0.06))`,
        color: BRAND.white,
        fontSize: 23,
        fontWeight: 600,
        boxShadow: '0 14px 34px rgba(0,0,0,0.16)',
        opacity: progress,
        transform: `translate3d(0,${(1 - progress) * 20}px,0)`,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 18px ${color}` }} />
      {label}
    </div>
  );
}

function DemoDataDisclosure() {
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 44, display: 'flex', justifyContent: 'center', zIndex: 20, pointerEvents: 'none' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 24, background: 'rgba(7,13,32,0.84)', border: '1px solid rgba(0,188,212,0.48)', boxShadow: '0 10px 26px rgba(0,0,0,0.22)', color: '#E1EDFA', fontSize: 18, lineHeight: 1.1, fontWeight: 700, letterSpacing: 1.15 }}>
        <span style={{ width: 9, height: 9, borderRadius: 10, background: BRAND.cyan, boxShadow: `0 0 14px ${BRAND.cyan}` }} />
        ILLUSTRATIVE DEMO DATA
      </div>
    </div>
  );
}

function HookScene({ short }: { short: boolean }) {
  const frame = useCurrentFrame();
  const phoneWidth = short ? 360 : 444;
  const phoneHeight = Math.round(phoneWidth * 844 / 390);
  const phoneTop = short ? 600 : 745;
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 86 : 104, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LogoReveal size={short ? 100 : 124} delay={0} />
        <TextReveal delay={5} align="center" maxWidth={920} style={{ marginTop: short ? 30 : 37, fontSize: short ? 56 : 73, lineHeight: 1.04, letterSpacing: -3, fontWeight: 700 }}>
          Stay close to their<br />school day.
        </TextReveal>
        {!short ? (
          <TextReveal delay={12} align="center" style={{ color: BRAND.muted, fontSize: 27, marginTop: 22, letterSpacing: 0.1 }}>
            Marks · attendance · homework · school updates
          </TextReveal>
        ) : null}
      </div>
      <DeviceZoom fromScale={0.91} toScale={1} fromY={72} delay={2} style={{ position: 'absolute', top: phoneTop, left: (1080 - phoneWidth) / 2 }}>
        <PhoneFrame
          screenshot="screens/login-light.png"
          width={phoneWidth}
          height={phoneHeight}
          maskStart={0.84}
        />
      </DeviceZoom>
      {short ? (
        <div style={{ position: 'absolute', bottom: 110, width: '100%', textAlign: 'center', color: BRAND.muted, fontSize: 19, letterSpacing: 1.1 }}>
          MBK PARENT PORTAL
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: 74, width: '100%', display: 'flex', justifyContent: 'center', gap: 12, opacity: interpolate(frame, [38, 70], [0, 0.75], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 5, height: 5, borderRadius: 5, background: i === 0 ? BRAND.cyan : 'rgba(255,255,255,0.25)' }} />)}
        </div>
      )}
    </>
  );
}

function ProblemScene() {
  return (
    <>
      <div style={{ position: 'absolute', top: 164, width: '100%', padding: '0 80px', textAlign: 'center' }}>
        <TextReveal align="center"><Eyebrow>For parents & guardians</Eyebrow></TextReveal>
        <TextReveal delay={6} align="center" style={{ marginTop: 28, fontSize: 69, lineHeight: 1.05, fontWeight: 700, letterSpacing: -2.8 }}>
          The school day<br />moves fast.
        </TextReveal>
        <TextReveal delay={13} align="center" style={{ marginTop: 25, fontSize: 28, color: BRAND.muted, lineHeight: 1.4 }}>
          Keep the updates parents need close.
        </TextReveal>
      </div>
      <div style={{ position: 'absolute', left: 76, top: 690, display: 'flex', flexDirection: 'column', gap: 17 }}>
        <FeatureCard title="Marks & reports" detail="Monthly · Midterm · Final" icon="chart" width={440} compact delay={4} accent={BRAND.blue} />
        <FeatureCard title="Attendance" detail="Daily records per child" icon="calendar" width={440} compact delay={10} accent={BRAND.cyan} />
        <FeatureCard title="Homework" detail="Pending · Submitted · Graded" icon="book" width={440} compact delay={17} accent={BRAND.gold} />
        <FeatureCard title="School messages" detail="Inbox · Announcements · Sent" icon="message" width={440} compact delay={24} accent={BRAND.green} />
      </div>
      <DeviceZoom fromScale={0.95} toScale={1} fromX={25} delay={3} style={{ position: 'absolute', left: 590, top: 650 }}>
        <PhoneFrame screenshot="screens/home-demo-dark.png" width={410} height={Math.round(410 * 844 / 390)} screenScale={1.02} />
      </DeviceZoom>
      <div style={{ position: 'absolute', right: 75, bottom: 195 }}>
        <FeatureChip label="One parent portal" delay={23} color={BRAND.cyan} />
      </div>
    </>
  );
}

function MarksScene({ short }: { short: boolean }) {
  const frame = useCurrentFrame();
  const phoneWidth = short ? 365 : 455;
  const phoneHeight = Math.round(phoneWidth * 844 / 390);
  const zoom = interpolate(frame, [12, 170], [1.01, 1.045], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 130 : 150, left: 84, right: 84 }}>
        <TextReveal><Eyebrow color={BRAND.blue}>01 / ACADEMIC PROGRESS</Eyebrow></TextReveal>
        <TextReveal delay={5} style={{ fontSize: short ? 54 : 75, lineHeight: 1.02, letterSpacing: -2.8, fontWeight: 700, marginTop: 19 }}>
          Marks &amp; reports
        </TextReveal>
        <TextReveal delay={11} style={{ fontSize: short ? 24 : 29, color: BRAND.muted, marginTop: 16, lineHeight: 1.35 }}>
          Monthly · Midterm · Final
        </TextReveal>
      </div>
      <DeviceZoom fromScale={0.94} toScale={1} fromY={40} delay={3} style={{ position: 'absolute', left: (1080 - phoneWidth) / 2, top: short ? 420 : 515 }}>
        <PhoneFrame screenshot="screens/marks-demo-dark.png" width={phoneWidth} height={phoneHeight} screenScale={zoom} />
      </DeviceZoom>
      {!short ? (
        <div style={{ position: 'absolute', left: 105, right: 105, bottom: 119, display: 'flex', justifyContent: 'center', gap: 15 }}>
          <FeatureChip label="Monthly" delay={14} color={BRAND.blue} />
          <FeatureChip label="Midterm" delay={19} color={BRAND.cyan} />
          <FeatureChip label="Final" delay={24} color={BRAND.gold} />
        </div>
      ) : null}
    </>
  );
}

function AttendanceHomeworkScene({ short }: { short: boolean }) {
  const frame = useCurrentFrame();
  const switchAt = short ? 44 : 88;
  const homeworkActive = frame >= switchAt;
  const frontScreenshot = homeworkActive ? 'screens/homework-demo-dark.png' : 'screens/attendance-demo-dark.png';
  const secondaryScreenshot = homeworkActive ? 'screens/attendance-demo-dark.png' : 'screens/homework-demo-dark.png';
  const frontReveal = interpolate(frame, [switchAt - 8, switchAt, switchAt + 8], [1, 0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const secondaryReveal = 1 - frontReveal;
  const phoneWidth = short ? 348 : 395;
  const phoneHeight = Math.round(phoneWidth * 844 / 390);
  const smallWidth = short ? 252 : 295;
  const smallHeight = Math.round(smallWidth * 844 / 390);
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 112 : 145, left: 76, right: 76 }}>
        <TextReveal><Eyebrow color={BRAND.cyan}>02 / EVERYDAY DETAILS</Eyebrow></TextReveal>
        <TextReveal delay={5} style={{ fontSize: short ? 48 : 69, lineHeight: 1.05, letterSpacing: -2.3, fontWeight: 700, marginTop: 17 }}>
          Attendance &amp; homework
        </TextReveal>
        {!short ? (
          <TextReveal delay={12} style={{ fontSize: 27, color: BRAND.muted, marginTop: 17 }}>
            Daily records. Work status. One place to check.
          </TextReveal>
        ) : null}
      </div>
      <ScreenTransition kind="fade" delay={2} style={{ position: 'absolute', left: 95, top: short ? 345 : 520, opacity: frontReveal }}>
        <PhoneFrame screenshot={frontScreenshot} width={phoneWidth} height={phoneHeight} />
      </ScreenTransition>
      {!short ? (
        <ScreenTransition kind="soft-zoom" delay={9} style={{ position: 'absolute', right: 83, top: 667, opacity: secondaryReveal * 0.89 }}>
          <PhoneFrame screenshot={secondaryScreenshot} width={smallWidth} height={smallHeight} shadow={false} />
        </ScreenTransition>
      ) : null}
      {short ? (
        <div style={{ position: 'absolute', left: 492, right: 62, top: 545, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <FeatureCard title="Attendance" detail="Daily records" icon="calendar" width={526} compact delay={9} accent={BRAND.cyan} />
          <FeatureCard title="Homework" detail="Pending · Submitted · Graded" icon="book" width={526} compact delay={22} accent={BRAND.gold} />
        </div>
      ) : (
        <div style={{ position: 'absolute', bottom: 125, left: 75, right: 75, display: 'flex', justifyContent: 'space-between', gap: 24 }}>
          <FeatureCard title="Attendance" detail="Daily records per child" icon="calendar" width={445} compact delay={10} accent={BRAND.cyan} />
          <FeatureCard title="Homework" detail="Pending · Submitted · Graded" icon="book" width={465} compact delay={17} accent={BRAND.gold} />
        </div>
      )}
    </>
  );
}

function CommunicationsScene({ short }: { short: boolean }) {
  const phoneWidth = short ? 356 : 455;
  const phoneTop = short ? 405 : 510;
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 82 : 158, left: 82, right: 82 }}>
        <TextReveal><Eyebrow color={BRAND.cyan}>03 / FROM THE SCHOOL</Eyebrow></TextReveal>
        <TextReveal delay={5} style={{ fontSize: short ? 51 : 73, lineHeight: 1.05, letterSpacing: short ? -1.7 : -2.8, fontWeight: 700, marginTop: 18 }}>
          Keep the conversation close.
        </TextReveal>
        {!short ? (
          <TextReveal delay={11} style={{ fontSize: 28, color: BRAND.muted, marginTop: 17 }}>
            Messages and announcements, together.
          </TextReveal>
        ) : null}
      </div>
      <DeviceZoom fromScale={0.94} toScale={1} fromY={40} delay={4} style={{ position: 'absolute', left: (1080 - phoneWidth) / 2, top: phoneTop }}>
        <PhoneFrame screenshot="screens/messages-demo-dark.png" width={phoneWidth} height={Math.round(phoneWidth * 844 / 390)} screenScale={1.02} />
      </DeviceZoom>
      {!short ? (
        <div style={{ position: 'absolute', left: 130, right: 130, bottom: 115, display: 'flex', justifyContent: 'center' }}>
          <FeatureCard title="Updates from the school" detail="Inbox · Announcements · Sent" icon="message" width={715} delay={15} accent={BRAND.cyan} />
        </div>
      ) : null}
    </>
  );
}

function LearningEcosystemScene({ short }: { short: boolean }) {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, 150], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const mainWidth = short ? 325 : 395;
  const mainHeight = Math.round(mainWidth * 844 / 390);
  const sideWidth = short ? 280 : 350;
  const sideHeight = Math.round(sideWidth * 844 / 390);
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 90 : 136, width: '100%', textAlign: 'center', padding: '0 70px' }}>
        <TextReveal><Eyebrow color={BRAND.gold}>04 / LEARNING SUPPORT</Eyebrow></TextReveal>
        <TextReveal delay={5} align="center" style={{ fontSize: short ? 51 : 71, lineHeight: 1.04, letterSpacing: -2.7, fontWeight: 700, marginTop: 17 }}>
          Learning, built into the picture.
        </TextReveal>
        <TextReveal delay={12} align="center" style={{ fontSize: short ? 22 : 27, color: BRAND.muted, marginTop: 15 }}>
          Lessons · practice activities · class quizzes
        </TextReveal>
      </div>
      <DeviceZoom fromScale={0.92} toScale={1} fromY={50} delay={3} style={{ position: 'absolute', left: short ? 82 : 84, top: short ? 355 : 515 }}>
        <PhoneFrame screenshot="screens/learning-dark.png" width={mainWidth} height={mainHeight} />
      </DeviceZoom>
      <ScreenTransition kind="soft-zoom" delay={10} style={{ position: 'absolute', left: short ? 405 : 465, top: short ? 495 : 545, transform: `translate3d(0,${(1 - p) * 26}px,0) rotate(5deg)`, zIndex: 2 }}>
        <PhoneFrame screenshot="screens/lesson-intro-dark.png" width={sideWidth} height={sideHeight} shadow={false} />
      </ScreenTransition>
      {!short ? (
        <ScreenTransition kind="slide" delay={17} style={{ position: 'absolute', right: 78, top: 885, transform: `rotate(-5deg)`, zIndex: 3 }}>
          <PhoneFrame screenshot="screens/lesson-question-dark.png" width={316} height={Math.round(316 * 844 / 390)} shadow={false} />
        </ScreenTransition>
      ) : null}
      {!short ? (
        <div style={{ position: 'absolute', bottom: 106, width: '100%', display: 'flex', justifyContent: 'center', gap: 14 }}>
          <FeatureChip label="Mathematics" delay={13} color={BRAND.blue} />
          <FeatureChip label="English" delay={18} color="#EC4899" />
          <FeatureChip label="Class quizzes" delay={23} color={BRAND.gold} />
        </div>
      ) : null}
    </>
  );
}

function CtaScene({ short }: { short: boolean }) {
  const phoneWidth = short ? 330 : 410;
  const phoneHeight = Math.round(phoneWidth * 844 / 390);
  return (
    <>
      <div style={{ position: 'absolute', top: short ? 150 : 180, left: 84, right: 84, textAlign: 'center' }}>
        <TextReveal align="center"><Eyebrow>MBK PARENT PORTAL</Eyebrow></TextReveal>
        <TextReveal delay={5} align="center" style={{ fontSize: short ? 48 : 65, lineHeight: 1.04, fontWeight: 700, letterSpacing: -2.5, marginTop: 17 }}>
          A clearer view of school life.
        </TextReveal>
      </div>
      <DeviceZoom fromScale={0.94} toScale={1} fromY={44} delay={4} style={{ position: 'absolute', left: short ? 82 : 100, top: short ? 465 : 485 }}>
        <PhoneFrame screenshot="screens/login-light.png" width={phoneWidth} height={phoneHeight} maskStart={0.84} />
      </DeviceZoom>
      <div style={{ position: 'absolute', left: short ? 448 : 557, top: short ? 705 : 715 }}>
        <LogoReveal size={short ? 92 : 110} delay={8} />
      </div>
      <div style={{ position: 'absolute', left: short ? 450 : 550, top: short ? 925 : 890 }}>
        <CTA compact={short} />
      </div>
    </>
  );
}

function SceneContent({ id, short }: { id: SceneId; short: boolean }) {
  switch (id) {
    case 'hook': return <HookScene short={short} />;
    case 'problem': return <><ProblemScene /><DemoDataDisclosure /></>;
    case 'marks': return <><MarksScene short={short} /><DemoDataDisclosure /></>;
    case 'attendance-homework': return <><AttendanceHomeworkScene short={short} /><DemoDataDisclosure /></>;
    case 'communications': return <><CommunicationsScene short={short} /><DemoDataDisclosure /></>;
    case 'learning-ecosystem': return <LearningEcosystemScene short={short} />;
    case 'cta': return <CtaScene short={short} />;
  }
}

function assembleScenes(story: StoryScene[]) {
  let from = 0;
  const entries = story.map(scene => {
    const entry = { scene, from, durationInFrames: Math.round(scene.durationSeconds * FPS) };
    from += entry.durationInFrames;
    return entry;
  });
  return { entries, durationInFrames: from };
}

export function PromoVideo({ short = false }: { short?: boolean }) {
  const isShort = short;
  const story = isShort ? SHORT_STORY : LONG_STORY;
  const { entries } = assembleScenes(story);
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.midnight, color: BRAND.white, fontFamily: 'Inter, sans-serif', overflow: 'hidden' }}>
      <FontFaces />
      <Background short={isShort} />
      {entries.map(({ scene, from, durationInFrames: sceneDuration }) => (
        <Sequence key={`${scene.id}-${from}`} from={from} durationInFrames={sceneDuration} premountFor={8}>
          <Scene transition={scene.transition} durationInFrames={sceneDuration}>
            <SceneContent id={scene.id} short={isShort} />
          </Scene>
        </Sequence>
      ))}
      <Audio src={staticFile('audio/mbk-original-bed.wav')} volume={0.18} />
      <Audio src={staticFile(isShort ? 'audio/mbk-transition-tones-short.wav' : 'audio/mbk-transition-tones.wav')} volume={0.34} />
      {isShort ? (
        <Audio src={staticFile('audio/voiceover-short.mp3')} volume={1} />
      ) : (
        LONG_VOICE_SEGMENTS.map(segment => {
          const from = Math.round(segment.fromSeconds * fps);
          return (
            <Sequence key={segment.file} from={from} durationInFrames={Math.max(1, durationInFrames - from)}>
              <Audio src={staticFile(segment.file)} volume={1} />
            </Sequence>
          );
        })
      )}
    </AbsoluteFill>
  );
}
