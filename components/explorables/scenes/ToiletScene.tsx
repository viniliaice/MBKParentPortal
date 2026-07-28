import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: number; // 0-100
  color: string;
}

/**
 * Simplified cross-section diagram, not a photoreal toilet — matches the
 * "idealized schematic that reacts to the slider" style of Brilliant's
 * explorables rather than trying to be a literal illustration.
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
          <Text style={styles.tankLabel}>TANK</Text>
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
            <Text style={styles.whooshText}>SIPHON!</Text>
          </View>
        )}
      </View>

      <View style={styles.bowl}>
        <View style={[styles.bowlWater, { height: `${Math.max(4, waterLevel)}%`, backgroundColor: `${color}AA` }]} />
        <Text style={styles.bowlLabel}>BOWL</Text>
      </View>

      <View style={styles.trapRow}>
        <View style={[styles.trapPipe, siphonActive && { borderColor: color }]} />
        <Ionicons
          name={siphonActive ? 'arrow-down-circle' : 'ellipse-outline'}
          size={20}
          color={siphonActive ? color : 'rgba(255,255,255,0.2)'}
        />
        <View style={[styles.trapPipe, siphonActive && { borderColor: color }]} />
      </View>
      <Text style={styles.trapCaption}>the trap — always holds some water</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 4, width: '100%' },
  tankRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tank: {
    width: 120, height: 46, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  tankLabel: { fontSize: 9, fontWeight: '800', color: '#8892B0', letterSpacing: 1, position: 'absolute', top: 4 },
  flapper: { width: 30, height: 6, borderRadius: 3, marginTop: 10 },
  whooshBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,211,238,0.15)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(34,211,238,0.4)',
  },
  whooshText: { fontSize: 11, fontWeight: '800', color: '#22D3EE' },
  bowl: {
    width: 150, height: 90, borderBottomLeftRadius: 70, borderBottomRightRadius: 70,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', borderTopWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.04)', overflow: 'hidden', justifyContent: 'flex-end', alignItems: 'center',
  },
  bowlWater: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  bowlLabel: { position: 'absolute', top: 6, fontSize: 9, fontWeight: '800', color: '#8892B0', letterSpacing: 1 },
  trapRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  trapPipe: { width: 24, height: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 6 },
  trapCaption: { fontSize: 10, color: '#4A5080', marginTop: 2 },
});
