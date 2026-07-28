import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: number; // 0-100
  color: string;
}

const PORCELAIN = '#E8ECF5';
const PORCELAIN_DIM = 'rgba(232,236,245,0.35)';

/**
 * Was previously a labelled rounded-bottom rectangle ("BOWL") that read as
 * an abstract blob, not a toilet. Rebuilt as a recognizable side-view
 * silhouette: tank -> oval rim -> tapered bowl body -> pedestal base,
 * all in porcelain white/grey so it reads as bathroom fixtures rather than
 * a generic diagram. Still a simplified schematic (no SVG in this project),
 * just a clearer one.
 */
export default function ToiletScene({ value, color }: Props) {
  // Flapper opens 0->45deg over the first third of the drag.
  const flapperAngle = Math.min(45, (value / 30) * 45);
  // Bowl water rises from a resting level, peaks mid-drag, then the siphon
  // empties it near the end — a simple triangular profile is enough to read.
  let waterLevel: number;
  if (value < 55) {
    waterLevel = 22 + (value / 55) * 48; // rises 22% -> 70%
  } else if (value < 78) {
    waterLevel = 70; // peak, about to trigger the siphon
  } else {
    const drain = (value - 78) / 22;
    waterLevel = 70 - drain * 62; // rushes down to ~8%
  }
  const siphonActive = value >= 75 && value < 95;

  return (
    <View style={styles.root}>
      <View style={styles.tankRow}>
        <View style={styles.tank}>
          <View
            style={[
              styles.flapper,
              { backgroundColor: color, transform: [{ rotate: `${flapperAngle}deg` }] },
            ]}
          />
        </View>
        {siphonActive && (
          <View style={styles.whooshBadge}>
            <Ionicons name="sync" size={14} color="#22D3EE" />
          </View>
        )}
      </View>
      <View style={styles.tankToBowlPipe} />

      <View style={styles.toiletSilhouette}>
        {/* rim — the oval opening you'd sit over */}
        <View style={styles.rim}>
          <View style={styles.rimHole}>
            <View style={[styles.bowlWater, { height: `${Math.max(4, waterLevel)}%`, backgroundColor: `${color}CC` }]} />
          </View>
        </View>
        {/* bowl body tapering down from the rim */}
        <View style={styles.bowlBody} />
        {/* pedestal base connecting the bowl to the floor/trap */}
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
  tankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 0 },
  tank: {
    width: 100, height: 40, borderRadius: 6, borderWidth: 2, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.06)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  flapper: { width: 26, height: 6, borderRadius: 3 },
  whooshBadge: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(34,211,238,0.15)', borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)',
  },
  tankToBowlPipe: { width: 8, height: 8, backgroundColor: PORCELAIN_DIM, borderRadius: 2 },

  toiletSilhouette: { alignItems: 'center' },
  // Flattened ellipse = the seat/rim opening viewed from the side.
  rim: {
    width: 132, height: 34, borderRadius: 66, borderWidth: 4, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  rimHole: {
    width: 108, height: 20, borderRadius: 54, overflow: 'hidden',
    backgroundColor: 'rgba(8,12,30,0.5)', justifyContent: 'flex-end',
  },
  bowlWater: { width: '100%', borderRadius: 4 },
  // Wide at the top (matches the rim), tapering in toward the pedestal —
  // this taper is what makes it read as a bowl instead of a rectangle.
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
