import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  value: number; // 0-100
  color: string;
}

const TOWER_TRACK_HEIGHT = 130;

export default function WaterTowerScene({ value, color }: Props) {
  const tankBottom = 10 + (value / 100) * (TOWER_TRACK_HEIGHT - 40);
  const pressurePct = value; // pressure scales directly with height for this teaching diagram
  const sprayLength = 8 + (pressurePct / 100) * 56;
  const gaugeAngle = -90 + (pressurePct / 100) * 180; // -90 (empty) to +90 (full)

  return (
    <View style={styles.root}>
      <View style={styles.sceneRow}>
        <View style={styles.towerColumn}>
          <View style={[styles.tank, { bottom: tankBottom, backgroundColor: `${color}33`, borderColor: color }]}>
            <Text style={styles.tankLabel}>TANK</Text>
          </View>
          <View style={styles.pole} />
          <View style={styles.groundLine} />
        </View>

        <View style={styles.pipeArea}>
          <View style={[styles.pipe, { backgroundColor: `${color}88` }]} />
          <View style={styles.sprayRow}>
            <View style={[styles.sprayStream, { width: sprayLength, backgroundColor: color, opacity: 0.35 + (pressurePct / 100) * 0.5 }]} />
          </View>
          <Text style={styles.tapLabel}>tap</Text>
        </View>

        <View style={styles.gaugeBox}>
          <Text style={styles.gaugeLabel}>PRESSURE</Text>
          <View style={styles.gaugeArc}>
            <View style={[styles.gaugeNeedle, { transform: [{ rotate: `${gaugeAngle}deg` }], backgroundColor: color }]} />
          </View>
          <Text style={[styles.gaugeValue, { color }]}>{Math.round(pressurePct)}%</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center' },
  sceneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  towerColumn: { width: 70, height: TOWER_TRACK_HEIGHT, alignItems: 'center', justifyContent: 'flex-end' },
  pole: { width: 6, height: TOWER_TRACK_HEIGHT - 10, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3 },
  groundLine: { position: 'absolute', bottom: 0, width: 70, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 2 },
  tank: {
    position: 'absolute', width: 56, height: 40, borderRadius: 10, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  tankLabel: { fontSize: 9, fontWeight: '800', color: '#CCCCCC', letterSpacing: 0.5 },
  pipeArea: { width: 90, height: TOWER_TRACK_HEIGHT, justifyContent: 'flex-end', alignItems: 'flex-start', paddingBottom: 6, gap: 6 },
  pipe: { width: '100%', height: 6, borderRadius: 3 },
  sprayRow: { height: 10, justifyContent: 'center' },
  sprayStream: { height: 5, borderRadius: 3 },
  tapLabel: { fontSize: 9, color: '#4A5080' },
  gaugeBox: { alignItems: 'center', gap: 4, width: 70 },
  gaugeLabel: { fontSize: 8, fontWeight: '800', color: '#8892B0', letterSpacing: 1 },
  gaugeArc: {
    width: 56, height: 30, borderTopLeftRadius: 56, borderTopRightRadius: 56,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', borderBottomWidth: 0,
    alignItems: 'center', overflow: 'visible',
  },
  gaugeNeedle: { width: 3, height: 24, borderRadius: 2, position: 'absolute', bottom: 0 },
  gaugeValue: { fontSize: 13, fontWeight: '800' },
});
