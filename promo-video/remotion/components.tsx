import React, { type CSSProperties, type ReactNode } from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BRAND } from './content';

const FONT_STACK = 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function FontFaces() {
  const regular = staticFile('fonts/Inter-Regular.ttf');
  const medium = staticFile('fonts/Inter-Medium.ttf');
  const semibold = staticFile('fonts/Inter-SemiBold.ttf');
  const bold = staticFile('fonts/Inter-Bold.ttf');
  return (
    <style>{`
      @font-face { font-family: Inter; src: url('${regular}') format('truetype'); font-weight: 400; font-style: normal; }
      @font-face { font-family: Inter; src: url('${medium}') format('truetype'); font-weight: 500; font-style: normal; }
      @font-face { font-family: Inter; src: url('${semibold}') format('truetype'); font-weight: 600; font-style: normal; }
      @font-face { font-family: Inter; src: url('${bold}') format('truetype'); font-weight: 700; font-style: normal; }
      html, body { margin: 0; padding: 0; background: ${BRAND.midnight}; }
      * { box-sizing: border-box; }
    `}</style>
  );
}

/** Atmospheric brand background: restrained, slow-moving blue/cyan light. */
export function Background({ short = false }: { short?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const drift = Math.sin(t * 0.33) * 46;
  const drift2 = Math.cos(t * 0.27) * 38;
  const shimmer = 0.66 + 0.08 * Math.sin(t * 0.8);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', backgroundColor: BRAND.midnight }}>
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 72% 8%, rgba(61,90,254,0.22) 0%, rgba(61,90,254,0.06) 26%, transparent 54%), radial-gradient(ellipse at 8% 64%, rgba(0,188,212,0.12) 0%, rgba(0,188,212,0.035) 28%, transparent 56%), linear-gradient(155deg, #0B1026 0%, #101C3B 52%, #081225 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: short ? 680 : 830,
          height: short ? 680 : 830,
          top: -360 + drift,
          right: -300 + drift2,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(61,90,254,0.16) 0%, rgba(61,90,254,0.045) 48%, transparent 72%)',
          filter: 'blur(8px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 700,
          height: 700,
          bottom: -360 + drift2,
          left: -330 + drift,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,188,212,0.13) 0%, rgba(0,188,212,0.035) 50%, transparent 72%)',
          filter: 'blur(10px)',
          opacity: shimmer,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.12,
          backgroundImage:
            'linear-gradient(rgba(188,207,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(188,207,255,0.08) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          maskImage: 'linear-gradient(180deg, transparent 0%, black 12%, black 82%, transparent 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          background: 'linear-gradient(180deg, rgba(4,9,24,0.02) 0%, transparent 36%, rgba(4,9,24,0.28) 100%)',
        }}
      />
    </AbsoluteFill>
  );
}

export function Scene({
  children,
  transition = 'rise',
  durationInFrames: sceneDuration,
  style,
}: {
  children: ReactNode;
  transition?: 'rise' | 'wipe' | 'push' | 'zoom' | 'orbit' | 'soft';
  durationInFrames?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames: compositionDuration } = useVideoConfig();
  const durationInFrames = sceneDuration ?? compositionDuration;
  const enter = spring({ frame: Math.max(0, frame - 1), fps, config: { damping: 24, stiffness: 88, mass: 0.85 } });
  const exitStart = Math.max(1, durationInFrames - 13);
  const exit = interpolate(frame, [exitStart, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.in(Easing.quad),
  });
  const opacity = Math.min(enter, exit);
  const baseX = transition === 'push' ? 72 : transition === 'orbit' ? 28 : 0;
  const baseY = transition === 'rise' ? 46 : transition === 'soft' ? 22 : 0;
  const scale = transition === 'zoom' || transition === 'orbit' ? 0.975 + enter * 0.025 : 1;
  const rotate = transition === 'orbit' ? interpolate(enter, [0, 1], [-2.5, 0]) : 0;

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translate3d(${baseX * (1 - enter)}px, ${baseY * (1 - enter)}px, 0) scale(${scale}) rotate(${rotate}deg)`,
        transformOrigin: '50% 50%',
        fontFamily: FONT_STACK,
        color: BRAND.white,
        ...style,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

export function TextReveal({
  children,
  delay = 0,
  style,
  align = 'left',
  maxWidth,
}: {
  children: ReactNode;
  delay?: number;
  style?: CSSProperties;
  align?: 'left' | 'center' | 'right';
  maxWidth?: number | string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping: 21, stiffness: 115, mass: 0.75 },
  });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [27, 0]);
  return (
    <div
      style={{
        opacity,
        transform: `translate3d(0, ${y}px, 0)`,
        textAlign: align,
        maxWidth,
        fontFamily: FONT_STACK,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Scene-local, deterministic push/zoom for a device or screen crop. */
export function DeviceZoom({
  children,
  fromScale = 0.94,
  toScale = 1,
  fromX = 0,
  toX = 0,
  fromY = 36,
  toY = 0,
  delay = 0,
  style,
}: {
  children: ReactNode;
  fromScale?: number;
  toScale?: number;
  fromX?: number;
  toX?: number;
  fromY?: number;
  toY?: number;
  delay?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 19, stiffness: 82, mass: 0.9 } });
  const scale = interpolate(p, [0, 1], [fromScale, toScale]);
  const x = interpolate(p, [0, 1], [fromX, toX]);
  const y = interpolate(p, [0, 1], [fromY, toY]);
  return <div style={{ transform: `translate3d(${x}px, ${y}px, 0) scale(${scale})`, transformOrigin: 'center', ...style }}>{children}</div>;
}

/** Curated transitions for screenshots. The screen itself remains a real capture. */
export function ScreenTransition({
  children,
  kind = 'fade',
  delay = 0,
  style,
}: {
  children: ReactNode;
  kind?: 'fade' | 'wipe' | 'slide' | 'soft-zoom';
  delay?: number;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 22, stiffness: 95 } });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const x = kind === 'slide' ? interpolate(p, [0, 1], [54, 0]) : 0;
  const scale = kind === 'soft-zoom' ? interpolate(p, [0, 1], [0.93, 1]) : 1;
  const clip = kind === 'wipe'
    ? `inset(0 ${interpolate(p, [0, 1], [100, 0])}% 0 0 round 36px)`
    : undefined;
  return (
    <div style={{ opacity, transform: `translate3d(${x}px, 0, 0) scale(${scale})`, clipPath: clip, ...style }}>
      {children}
    </div>
  );
}

/** A realistic, premium smartphone chassis around a source screenshot. */
export function PhoneFrame({
  screenshot,
  width = 460,
  height = Math.round(width * 844 / 390),
  maskStart,
  screenScale = 1,
  screenY = 0,
  style,
  notch = true,
  shadow = true,
}: {
  screenshot: string;
  width?: number;
  height?: number;
  maskStart?: number;
  screenScale?: number;
  screenY?: number;
  style?: CSSProperties;
  notch?: boolean;
  shadow?: boolean;
}) {
  return (
    <div
      style={{
        width,
        height,
        padding: 9,
        borderRadius: 68,
        position: 'relative',
        background: 'linear-gradient(140deg, #E2E6EE 0%, #687283 4%, #1A2230 11%, #080C14 35%, #202938 69%, #748094 94%, #D3D9E4 100%)',
        border: '1px solid rgba(255,255,255,0.53)',
        boxShadow: shadow ? '0 52px 120px rgba(0,0,0,0.48), 0 18px 46px rgba(2,8,24,0.5), inset 0 1px 1px rgba(255,255,255,0.75)' : undefined,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -5,
          top: 205,
          width: 4,
          height: 88,
          borderRadius: '4px 0 0 4px',
          background: 'linear-gradient(180deg, #7E8796, #232B38 35%, #151C27 70%, #818A99)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -5,
          top: 225,
          width: 4,
          height: 116,
          borderRadius: '0 4px 4px 0',
          background: 'linear-gradient(180deg, #7E8796, #232B38 35%, #151C27 70%, #818A99)',
        }}
      />
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 59,
          backgroundColor: BRAND.midnight,
          border: '1px solid rgba(0,0,0,0.9)',
        }}
      >
        <AppScreen screenshot={screenshot} maskStart={maskStart} screenScale={screenScale} screenY={screenY} />
        {notch ? (
          <div
            style={{
              position: 'absolute',
              zIndex: 3,
              top: 13,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 116,
              height: 27,
              borderRadius: 20,
              background: 'linear-gradient(180deg, #010204, #080A0E)',
              boxShadow: '0 2px 7px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ position: 'absolute', right: 19, top: 8, width: 9, height: 9, borderRadius: 9, background: '#182838', boxShadow: 'inset 0 0 0 1px #263C51' }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Pixels come straight from Expo Web captures; optional masks add only a soft composition fade. */
export function AppScreen({
  screenshot,
  maskStart,
  screenScale = 1,
  screenY = 0,
}: {
  screenshot: string;
  maskStart?: number;
  screenScale?: number;
  screenY?: number;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', backgroundColor: BRAND.midnight }}>
      <Img
        src={staticFile(screenshot)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
          transform: `translate3d(0, ${screenY}px, 0) scale(${screenScale})`,
          transformOrigin: 'top center',
        }}
      />
      {maskStart !== undefined ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background: `linear-gradient(180deg, rgba(11,16,38,0) 0%, rgba(11,16,38,0) ${Math.max(0, maskStart * 100 - 7)}%, rgba(11,16,38,0.82) ${maskStart * 100 + 9}%, rgba(11,16,38,0.98) 75%, rgba(11,16,38,1) 100%)`,
          }}
        />
      ) : null}
    </div>
  );
}

export type FeatureIconName = 'chart' | 'calendar' | 'book' | 'message' | 'sparkle' | 'school';

function FeatureIcon({ name, color = BRAND.cyan }: { name: FeatureIconName; color?: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  const paths: Record<FeatureIconName, ReactNode> = {
    chart: <><path {...common} d="M6 34V24M16 34V17M26 34V10M36 34V5" /><path {...common} d="M4 39h35" /></>,
    calendar: <><rect {...common} x="5" y="8" width="34" height="31" rx="6" /><path {...common} d="M12 4v8M32 4v8M5 16h34M13 23h4M23 23h4M13 31h4M23 31h4" /></>,
    book: <><path {...common} d="M5 9c8-2 14 0 18 4v26c-4-4-10-6-18-4V9Z" /><path {...common} d="M43 9c-8-2-14 0-20 4v26c5-4 12-6 20-4V9Z" /></>,
    message: <><path {...common} d="M7 7h34v25H21l-11 8v-8H7V7Z" /><path {...common} d="M14 16h20M14 23h14" /></>,
    sparkle: <><path {...common} d="M23 4l4.2 13.8L41 22l-13.8 4.2L23 40l-4.2-13.8L5 22l13.8-4.2L23 4Z" /><path {...common} d="M38 31l1.7 5.3L45 38l-5.3 1.7L38 45l-1.7-5.3L31 38l5.3-1.7L38 31Z" /></>,
    school: <><path {...common} d="M5 18 24 7l19 11-19 11L5 18Z" /><path {...common} d="M12 23v12c7 5 17 5 24 0V23M43 19v12" /><circle {...common} cx="43" cy="34" r="2" /></>,
  };
  return (
    <svg width="44" height="44" viewBox="0 0 48 48" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
}

export function FeatureCard({
  title,
  detail,
  icon = 'sparkle',
  delay = 0,
  accent = BRAND.cyan,
  width = 450,
  compact = false,
  style,
}: {
  title: string;
  detail: string;
  icon?: FeatureIconName;
  delay?: number;
  accent?: string;
  width?: number;
  compact?: boolean;
  style?: CSSProperties;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 21, stiffness: 95 } });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const x = interpolate(p, [0, 1], [26, 0]);
  const pad = compact ? 19 : 23;
  const iconSize = compact ? 58 : 66;
  return (
    <div
      style={{
        width,
        display: 'flex',
        alignItems: 'center',
        gap: 19,
        padding: `${pad}px 25px`,
        borderRadius: 26,
        background: 'linear-gradient(135deg, rgba(255,255,255,0.085), rgba(255,255,255,0.035))',
        border: '1px solid rgba(206,220,255,0.12)',
        boxShadow: '0 22px 48px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.07)',
        backdropFilter: 'blur(18px)',
        opacity,
        transform: `translate3d(${x}px, 0, 0)`,
        fontFamily: FONT_STACK,
        ...style,
      }}
    >
      <div
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: compact ? 17 : 20,
          display: 'grid',
          placeItems: 'center',
          background: `linear-gradient(145deg, ${accent}2C, ${accent}12)`,
          border: `1px solid ${accent}35`,
        }}
      >
        <FeatureIcon name={icon} color={accent} />
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: compact ? 5 : 7 }}>
        <div style={{ color: BRAND.white, fontSize: compact ? 26 : 30, lineHeight: 1.1, fontWeight: 700, letterSpacing: -0.5 }}>{title}</div>
        <div style={{ color: BRAND.muted, fontSize: compact ? 19 : 21, lineHeight: 1.28, fontWeight: 500 }}>{detail}</div>
      </div>
    </div>
  );
}

export function LogoReveal({ size = 152, delay = 0, showName = false }: { size?: number; delay?: number; showName?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 16, stiffness: 105, mass: 0.7 } });
  const scale = interpolate(p, [0, 1], [0.62, 1]);
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const rotate = interpolate(p, [0, 1], [-6, 0]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, opacity, transform: `scale(${scale}) rotate(${rotate}deg)` }}>
      <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.24), overflow: 'hidden', boxShadow: '0 16px 46px rgba(0,0,0,0.28), 0 0 55px rgba(87,132,173,0.28)' }}>
        <Img src={staticFile('mbk-logo.png')} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'contain' }} />
      </div>
      {showName ? <div style={{ fontFamily: FONT_STACK, color: BRAND.white, fontWeight: 700, fontSize: 42, letterSpacing: -1 }}>MBK Parent Portal</div> : null}
    </div>
  );
}

export function CTA({ compact = false }: { compact?: boolean }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: Math.max(0, frame - 5), fps, config: { damping: 19, stiffness: 95 } });
  const opacity = interpolate(p, [0, 1], [0, 1]);
  const y = interpolate(p, [0, 1], [24, 0]);
  return (
    <div style={{ opacity, transform: `translate3d(0,${y}px,0)`, fontFamily: FONT_STACK, width: compact ? 440 : 490 }}>
      <div style={{ color: BRAND.cyan, fontSize: compact ? 18 : 21, fontWeight: 700, letterSpacing: 2.1, textTransform: 'uppercase', marginBottom: 18 }}>
        For MBK parents & guardians
      </div>
      <div style={{ color: BRAND.white, fontSize: compact ? 48 : 58, lineHeight: 1.06, letterSpacing: -2.1, fontWeight: 700, marginBottom: 20 }}>
        School life,<br />closer together.
      </div>
      <div style={{ color: BRAND.muted, fontSize: compact ? 22 : 24, lineHeight: 1.45, fontWeight: 400, marginBottom: 30 }}>
        Use the email address your school registered for you.
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          minWidth: compact ? 360 : 430,
          padding: compact ? '20px 25px' : '23px 28px',
          borderRadius: 18,
          color: '#FFFFFF',
          fontWeight: 700,
          fontSize: compact ? 22 : 24,
          background: 'linear-gradient(100deg, #3D5AFE 0%, #00BCD4 100%)',
          boxShadow: '0 16px 45px rgba(61,90,254,0.25), inset 0 1px 0 rgba(255,255,255,0.22)',
        }}
      >
        <span>Sign in</span>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </div>
    </div>
  );
}

export function Eyebrow({ children, color = BRAND.cyan }: { children: ReactNode; color?: string }) {
  return <div style={{ color, fontFamily: FONT_STACK, fontSize: 21, fontWeight: 700, letterSpacing: 2.6, textTransform: 'uppercase' }}>{children}</div>;
}
