import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';

interface Props {
  /** 0-1 through the flush sequence */
  progress: number;
  color: string;
}

const PORCELAIN = '#E8ECF5';

/**
 * The toilet silhouette (tank, oval seat rim, tapered bowl, pedestal) reused
 * from components/explorables/scenes/ToiletScene.tsx's visual language, but
 * rebuilt on Reanimated shared styles so it can be driven by
 * CauseEffectExplorer's animated progress value smoothly, including the
 * siphon "whoosh" and refill motion, instead of the older component's
 * discrete progress-band calculation.
 */
export default function ToiletFlushDiagram({ progress, color }: Props) {
  const flapperAngle = Math.min(45, (progress * 100 / 30) * 45);

  let waterLevel: number;
  const p = progress * 100;
  if (p < 55) {
    waterLevel = 22 + (p / 55) * 48;
  } else if (p < 78) {
    waterLevel = 70;
  } else {
    const drain = (p - 78) / 22;
    waterLevel = 70 - drain * 62;
  }
  const siphonActive = p >= 75 && p < 95;

  const flapperStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${flapperAngle}deg`, { duration: 120 }) }],
  }));

  const waterStyle = useAnimatedStyle(() => ({
    height: withTiming(`${Math.max(4, waterLevel)}%`, { duration: 120 }),
  }));

  return (
    <View style={styles.root}>
      <View style={styles.tankRow}>
        <View style={styles.tank}>
          <Animated.View style={[styles.flapper, flapperStyle, { backgroundColor: color }]} />
        </View>
        {siphonActive && (
          <View style={styles.whooshBadge}>
            <Ionicons name="sync" size={14} color={color} />
          </View>
        )}
      </View>
      <View style={styles.tankToBowlPipe} />

      <View style={styles.toiletSilhouette}>
        <View style={styles.rim}>
          <View style={styles.rimHole}>
            <Animated.View style={[styles.bowlWater, waterStyle, { backgroundColor: `${color}CC` }]} />
          </View>
        </View>
        <View style={styles.bowlBody} />
        <View style={styles.pedestal} />
      </View>

      <View style={styles.trapRow}>
        <View style={[styles.trapPipe, siphonActive && { borderColor: color }]} />
        <Ionicons
          name={siphonActive ? 'arrow-down-circle' : 'ellipse-outline'}
          size={18}
          color={siphonActive ? color : 'rgba(255,255,255,0.2)'}
        />
        <View style={[styles.trapPipe, siphonActive && { borderColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', width: '100%' },
  tankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tank: {
    width: 100, height: 40, borderRadius: 6, borderWidth: 2, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  flapper: { width: 26, height: 6, borderRadius: 3 },
  whooshBadge: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)',
  },
  tankToBowlPipe: { width: 8, height: 8, backgroundColor: 'rgba(232,236,245,0.35)', borderRadius: 2 },
  toiletSilhouette: { alignItems: 'center' },
  rim: {
    width: 132, height: 34, borderRadius: 66, borderWidth: 4, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  rimHole: {
    width: 108, height: 20, borderRadius: 54, overflow: 'hidden',
    backgroundColor: 'rgba(8,12,30,0.5)', justifyContent: 'flex-end',
  },
  bowlWater: { width: '100%', borderRadius: 4 },
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
  trapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  trapPipe: { width: 22, height: 9, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 5 },
});
