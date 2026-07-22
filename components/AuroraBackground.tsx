import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props { children: React.ReactNode }

export default function AuroraBackground({ children }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#0B1026', '#0F1B3D', '#0B1026']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.orb, styles.orb1]} />
      <View style={[styles.orb, styles.orb2]} />
      <View style={[styles.orb, styles.orb3]} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B1026' },
  orb: { position: 'absolute', borderRadius: 999 },
  orb1: { width: 280, height: 280, top: -80, right: -60, backgroundColor: 'rgba(61,90,254,0.08)' },
  orb2: { width: 200, height: 200, top: 250, left: -80, backgroundColor: 'rgba(0,188,212,0.06)' },
  orb3: { width: 240, height: 240, bottom: 100, right: -50, backgroundColor: 'rgba(46,204,113,0.05)' },
});
