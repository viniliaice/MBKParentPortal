import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  value: number; // 0-100 = rotor speed
  color: string;
}

const LIFTOFF_THRESHOLD = 78;

export default function HelicopterScene({ value, color }: Props) {
  const spin = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current?.stop();
    if (value <= 2) {
      spin.setValue(0);
      return;
    }
    // Faster slider value -> faster spin duration. Loops continuously while
    // the slider sits at a given speed so the blades feel alive, not static.
    const duration = Math.max(120, 900 - value * 7);
    spin.setValue(0);
    loopRef.current = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }),
    );
    loopRef.current.start();
    return () => loopRef.current?.stop();
  }, [value, spin]);

  const rotateStr = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const liftedOff = value >= LIFTOFF_THRESHOLD;
  const height = liftedOff ? Math.min(60, (value - LIFTOFF_THRESHOLD) * 2.8) : 0;

  return (
    <View style={styles.root}>
      <View style={[styles.heli, { transform: [{ translateY: -height }] }]}>
        <Animated.View style={[styles.rotor, { transform: [{ rotate: rotateStr }] }]}>
          <View style={[styles.blade, { backgroundColor: color }]} />
          <View style={[styles.blade, styles.bladeCross, { backgroundColor: color }]} />
        </Animated.View>
        <View style={styles.mast} />
        <View style={[styles.body, { borderColor: color }]}>
          <Ionicons name="airplane" size={16} color={color} style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
      </View>
      <View style={styles.groundLine} />
      <Text style={[styles.statusText, liftedOff && { color }]}>
        {liftedOff ? 'Lift beats gravity — liftoff!' : value > 10 ? 'Spinning up... not enough lift yet' : 'Blades at rest'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%', alignItems: 'center', gap: 8, paddingTop: 10 },
  heli: { alignItems: 'center' },
  rotor: { width: 100, height: 6, alignItems: 'center', justifyContent: 'center' },
  blade: { position: 'absolute', width: 100, height: 4, borderRadius: 2 },
  bladeCross: { transform: [{ rotate: '90deg' }] },
  mast: { width: 3, height: 10, backgroundColor: 'rgba(255,255,255,0.3)' },
  body: {
    width: 64, height: 34, borderRadius: 17, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)',
  },
  groundLine: { width: 140, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 4 },
  statusText: { fontSize: 12, color: '#8892B0', fontWeight: '600', marginTop: 4 },
});
