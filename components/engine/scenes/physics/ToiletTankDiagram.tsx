import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  /** 0-100 float valve arm position: 0 = fully down (empty tank), 100 = fully up (full tank) */
  armPosition: number;
  color: string;
}

/**
 * The tank interior viewed with the float valve arm visible — used by the
 * DragMechanism "float valve" activity. Distinct from ToiletFlushDiagram
 * (which shows the whole toilet during a flush); this one zooms into just
 * the tank mechanism since that's what the learner is manipulating.
 */
export default function ToiletTankDiagram({ armPosition, color }: Props) {
  const waterHeight = 10 + (armPosition / 100) * 60;
  const armAngle = -40 + (armPosition / 100) * 60; // arm tilts up as float rises

  return (
    <View style={styles.tank}>
      <View style={[styles.water, { height: `${waterHeight}%`, backgroundColor: `${color}88` }]} />
      <View style={[styles.armPivot, { transform: [{ rotate: `${armAngle}deg` }] }]}>
        <View style={[styles.arm, { backgroundColor: color }]} />
        <View style={[styles.float, { backgroundColor: color, bottom: `${Math.max(0, waterHeight - 8)}%` }]} />
      </View>
      <View style={styles.valveTop}>
        <Ionicons name="water" size={14} color={color} />
      </View>
      <View style={styles.overflowTube} />
    </View>
  );
}

const styles = StyleSheet.create({
  tank: {
    width: 140, height: 130, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(232,236,245,0.4)',
    backgroundColor: 'rgba(232,236,245,0.05)', overflow: 'hidden', justifyContent: 'flex-end', position: 'relative',
  },
  water: { width: '100%' },
  valveTop: {
    position: 'absolute', top: 8, right: 10, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  armPivot: {
    position: 'absolute', top: 20, right: 20, width: 60, height: 4, alignItems: 'flex-start',
  },
  arm: { width: 50, height: 3, borderRadius: 2 },
  float: { position: 'absolute', left: 40, width: 16, height: 16, borderRadius: 8 },
  overflowTube: {
    position: 'absolute', left: 14, top: 10, bottom: 10, width: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
