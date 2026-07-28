import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: number; // 0-100 = compressor speed
  color: string;
}

export default function FridgeScene({ value, color }: Props) {
  const insideTemp = Math.round(20 - (value / 100) * 24); // 20C down to -4C
  const backTemp = Math.round(20 + (value / 100) * 22); // 20C up to 42C
  const insidePct = Math.max(0, Math.min(1, (insideTemp + 4) / 24)); // 0 (cold) -> 1 (warm)
  const backPct = Math.max(0, Math.min(1, (backTemp - 20) / 22));

  const insideColor = mixColor('#3D5AFE', '#8892B0', insidePct);
  const backColor = mixColor('#8892B0', '#FF5370', backPct);

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.column}>
          <View style={[styles.thermBox, { borderColor: insideColor }]}>
            <Ionicons name="snow" size={18} color={insideColor} />
            <Text style={[styles.thermValue, { color: insideColor }]}>{insideTemp}°C</Text>
          </View>
          <Text style={styles.label}>Inside fridge</Text>
        </View>

        <View style={styles.arrowColumn}>
          <Ionicons name="arrow-forward" size={16} color={value > 5 ? color : 'rgba(255,255,255,0.15)'} />
          <Text style={styles.arrowLabel}>heat moves out</Text>
        </View>

        <View style={styles.column}>
          <View style={[styles.thermBox, { borderColor: backColor }]}>
            <Ionicons name="flame" size={18} color={backColor} />
            <Text style={[styles.thermValue, { color: backColor }]}>{backTemp}°C</Text>
          </View>
          <Text style={styles.label}>Back coils</Text>
        </View>
      </View>

      <View style={styles.compressorRow}>
        <View style={[styles.compressorDot, value > 5 && { backgroundColor: color }]} />
        <Text style={styles.compressorLabel}>{value > 5 ? 'Compressor running' : 'Compressor off'}</Text>
      </View>
    </View>
  );
}

function mixColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bch = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bch})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center', gap: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  column: { alignItems: 'center', gap: 6 },
  thermBox: {
    width: 84, height: 64, borderRadius: 16, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  thermValue: { fontSize: 15, fontWeight: '800' },
  label: { fontSize: 11, color: '#8892B0', fontWeight: '600' },
  arrowColumn: { alignItems: 'center', gap: 2 },
  arrowLabel: { fontSize: 8, color: '#4A5080', width: 60, textAlign: 'center' },
  compressorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  compressorDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.15)' },
  compressorLabel: { fontSize: 12, color: '#CCCCCC', fontWeight: '600' },
});
