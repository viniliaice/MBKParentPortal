import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useColors } from '@/hooks/useColors';

interface Props { children: React.ReactNode }

/**
 * The wash behind every screen. It follows the selected appearance: the dark
 * gradient in dark mode, a pale one in light mode, so screens never end up with a
 * dark backdrop behind light-mode cards.
 */
export default function AuroraBackground({ children }: Props) {
  const c = useColors();

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <LinearGradient
        colors={c.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orb1, { backgroundColor: c.glowPrimary }]} />
      <View style={[styles.orb, styles.orb2, { backgroundColor: c.glowSecondary }]} />
      <View style={[styles.orb, styles.orb3, { backgroundColor: c.glowAccent }]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 280, height: 280, top: -80, right: -60 },
  orb2: { width: 200, height: 200, top: 250, left: -80 },
  orb3: { width: 240, height: 240, bottom: 100, right: -50 },
});
