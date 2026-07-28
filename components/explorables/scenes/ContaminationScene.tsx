import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  value: number; // 0-100 = filter fineness
  color: string;
}

interface Particle {
  key: string;
  size: number;
  blockedAt: number; // fineness level (0-100) at which this particle gets stopped
  top: number;
  emoji: string;
}

// Bigger emoji = bigger particle = blocked earlier (lower fineness needed).
const PARTICLE_DEFS: Omit<Particle, 'top'>[] = [
  { key: 'leaf', size: 20, blockedAt: 5, emoji: '🍂' },
  { key: 'sand', size: 14, blockedAt: 15, emoji: '⚪' },
  { key: 'sediment', size: 10, blockedAt: 40, emoji: '🟤' },
  { key: 'bacteria', size: 7, blockedAt: 70, emoji: '🦠' },
  { key: 'salt', size: 5, blockedAt: 88, emoji: '🔹' },
];

export default function ContaminationScene({ value, color }: Props) {
  const particles = useMemo<Particle[]>(
    () => PARTICLE_DEFS.map((p, i) => ({ ...p, top: 10 + i * 16 })),
    [],
  );

  return (
    <View style={styles.root}>
      <View style={styles.pipe}>
        <Text style={styles.sideLabel}>DIRTY</Text>
        {particles.map(p => {
          const blocked = value >= p.blockedAt;
          return (
            <View
              key={p.key}
              style={[
                styles.particle,
                { top: p.top, left: blocked ? '38%' : '68%' },
              ]}
            >
              <Text style={{ fontSize: p.size, opacity: blocked ? 1 : 0.85 }}>{p.emoji}</Text>
            </View>
          );
        })}

        <View style={[styles.filter, { borderColor: color, backgroundColor: `${color}22` }]}>
          <View style={styles.filterMeshRow}>
            {Array.from({ length: 5 }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.meshDot,
                  { backgroundColor: color, opacity: 0.3 + (value / 100) * 0.7 },
                ]}
              />
            ))}
          </View>
        </View>

        <Text style={[styles.sideLabel, { color: '#2ECC71' }]}>CLEAN</Text>
      </View>
      <Text style={[styles.filterCaptionLabel, { color }]}>▲ filter</Text>

      <Text style={styles.caption}>
        {value < 15 ? 'Coarse filter — only stops big debris' :
         value < 45 ? 'Blocks sediment, still lets bacteria through' :
         value < 75 ? 'Household-grade filter — chlorine and sediment removed' :
         value < 90 ? 'Blocks bacteria — this is serious filtration' :
         'Reverse-osmosis grade — almost nothing gets through'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center', gap: 10 },
  pipe: {
    width: '100%', height: 100, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.03)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, overflow: 'hidden',
  },
  sideLabel: { fontSize: 9, fontWeight: '800', color: '#8892B0', letterSpacing: 1, position: 'absolute', top: 4 },
  particle: { position: 'absolute' },
  filter: {
    position: 'absolute', left: '48%', width: 20, height: '90%', borderRadius: 4, borderWidth: 2,
    alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4,
  },
  filterMeshRow: { flexDirection: 'column', gap: 6, alignItems: 'center', flex: 1, justifyContent: 'center' },
  meshDot: { width: 4, height: 4, borderRadius: 2 },
  filterCaptionLabel: { fontSize: 10, fontWeight: '700' },
  caption: { fontSize: 12, color: '#CCCCCC', textAlign: 'center', paddingHorizontal: 12, lineHeight: 18 },
});
