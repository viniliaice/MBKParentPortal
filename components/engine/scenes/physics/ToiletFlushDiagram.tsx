import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withRepeat, Easing,
} from 'react-native-reanimated';
import AnimatedWaterSurface from '@/components/engine/primitives/AnimatedWaterSurface';
import WaterDroplets from '@/components/engine/primitives/WaterDroplets';
import RippleSplash from '@/components/engine/primitives/RippleSplash';
import FlowPipe from '@/components/engine/primitives/FlowPipe';
import AmbientFloat from '@/components/engine/primitives/AmbientFloat';
import { FloatingLabel } from '@/components/engine/primitives/DiscoveryHighlight';

interface Props {
  /** 0-1 through the flush sequence */
  progress: number;
  color: string;
}

const PORCELAIN = '#E8ECF5';

/**
 * The toilet silhouette (tank, oval seat rim, tapered bowl, pedestal),
 * substantially deepened from the first pass: the bowl water is a live
 * AnimatedWaterSurface (continuously shimmering, not a static rectangle),
 * the tank->bowl pipe pulses to show water actively moving, the siphon
 * moment fires a droplet spray + ripple burst + a floating "SIPHON!" label
 * right where it's happening, and the whole toilet gets a
 * barely-perceptible idle float so the screen never looks frozen even
 * before the student presses anything.
 */
export default function ToiletFlushDiagram({ progress, color }: Props) {
  const flapperAngle = Math.min(48, (progress * 100 / 28) * 48);

  let waterLevel: number;
  const p = progress * 100;
  const isFilling = p > 0.5 && p < 55;
  if (p < 55) {
    waterLevel = 22 + (p / 55) * 50;
  } else if (p < 76) {
    waterLevel = 72;
  } else {
    const drain = (p - 76) / 22;
    waterLevel = 72 - drain * 66;
  }
  const siphonActive = p >= 76 && p < 96;

  const [splashTrigger, setSplashTrigger] = useState(0);
  const firedSplashRef = useRef(false);
  useEffect(() => {
    if (siphonActive && !firedSplashRef.current) {
      firedSplashRef.current = true;
      setSplashTrigger(n => n + 1);
    }
    if (!siphonActive) firedSplashRef.current = false;
  }, [siphonActive]);

  // Swirl the bowl water faster while the siphon pulls it down.
  const swirl = useSharedValue(0);
  useEffect(() => {
    swirl.value = withRepeat(withTiming(1, { duration: siphonActive ? 500 : 3200, easing: Easing.linear }), -1, false);
  }, [siphonActive]);

  const flapperStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${flapperAngle}deg`, { duration: 140 }) }],
  }));

  const swirlStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${swirl.value * 360}deg` }],
    opacity: siphonActive ? 0.55 : 0.12,
  }));

  const trapGlowStyle = useAnimatedStyle(() => ({
    opacity: withTiming(siphonActive ? 1 : 0.15, { duration: 200 }),
  }));

  return (
    <AmbientFloat distance={2} durationMs={4200} style={styles.root}>
      <View style={styles.root}>
        <View style={styles.tankRow}>
          <View style={styles.tank}>
            <View style={styles.tankWaterClip}>
              <AnimatedWaterSurface level={isFilling ? 78 : 30} color={color} turbulence={isFilling ? 0.9 : 0.2} flowing={isFilling} />
            </View>
            <Animated.View style={[styles.flapper, flapperStyle, { backgroundColor: color }]} />
          </View>
          {siphonActive && (
            <Animated.View style={[styles.whooshBadge, { transform: [{ scale: 1.05 }] }]}>
              <Ionicons name="sync" size={14} color={color} />
            </Animated.View>
          )}
        </View>

        <FlowPipe color={color} horizontal={false} length={14} thickness={8} active={isFilling} speedMs={500} />

        <View style={styles.toiletSilhouette}>
          <View style={styles.rim}>
            <View style={styles.rimHole}>
              <AnimatedWaterSurface level={Math.max(4, waterLevel)} color={color} turbulence={siphonActive ? 1 : 0.35} flowing={siphonActive || isFilling} />
              <Animated.View style={[styles.bowlSwirl, swirlStyle, { borderColor: '#FFFFFF' }]} />
            </View>
            <View style={styles.splashAnchor}>
              <WaterDroplets trigger={splashTrigger} color={color} count={10} directionDeg={0} spreadDeg={100} />
              <RippleSplash trigger={splashTrigger} color={color} size={90} />
            </View>
          </View>
          <View style={styles.bowlBody} />
          <View style={styles.pedestal} />
        </View>

        <View style={styles.trapRow}>
          <Animated.View style={[styles.trapGlow, trapGlowStyle, { backgroundColor: color }]} />
          <FlowPipe color={color} horizontal length={22} thickness={9} active={siphonActive} speedMs={280} />
          <Ionicons
            name={siphonActive ? 'arrow-down-circle' : 'ellipse-outline'}
            size={18}
            color={siphonActive ? color : 'rgba(255,255,255,0.2)'}
          />
          <FlowPipe color={color} horizontal length={22} thickness={9} active={siphonActive} speedMs={280} />
          <View style={styles.trapLabelAnchor}>
            <FloatingLabel text="Siphon!" color={color} visible={siphonActive} />
          </View>
        </View>
      </View>
    </AmbientFloat>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', width: '100%' },
  tankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tank: {
    width: 100, height: 40, borderRadius: 6, borderWidth: 2, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tankWaterClip: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', overflow: 'hidden' },
  flapper: { width: 26, height: 6, borderRadius: 3 },
  whooshBadge: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)',
  },
  toiletSilhouette: { alignItems: 'center' },
  rim: {
    width: 132, height: 34, borderRadius: 66, borderWidth: 4, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  rimHole: {
    width: 108, height: 20, borderRadius: 54, overflow: 'hidden',
    backgroundColor: 'rgba(8,12,30,0.5)', justifyContent: 'flex-end', position: 'relative',
  },
  bowlSwirl: {
    position: 'absolute', top: '15%', left: '32%', width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderStyle: 'dashed',
  },
  splashAnchor: { position: 'absolute', top: '0%', left: '50%', width: 0, height: 0 },
  bowlBody: {
    width: 116, height: 46, marginTop: -6,
    borderBottomLeftRadius: 20, borderBottomRightRadius: 20,
    borderWidth: 3, borderTopWidth: 0, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.04)',
  },
  pedestal: {
    width: 46, height: 22, marginTop: -2,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 6,
    borderWidth: 3, borderTopWidth: 0, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.04)',
  },
  trapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, position: 'relative' },
  trapGlow: {
    position: 'absolute', top: -4, left: '35%', width: 30, height: 30, borderRadius: 15, opacity: 0.15,
  },
  trapLabelAnchor: { position: 'absolute', top: -30, left: '50%', width: 90, marginLeft: -45, alignItems: 'center' },
});
