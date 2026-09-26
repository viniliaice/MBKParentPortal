import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withRepeat, Easing } from 'react-native-reanimated';
import AnimatedWaterSurface from '@/components/engine/primitives/AnimatedWaterSurface';
import FlowPipe from '@/components/engine/primitives/FlowPipe';
import { FloatingLabel } from '@/components/engine/primitives/DiscoveryHighlight';

interface Props {
  /** 0-100 float valve arm position: 0 = fully down (empty tank), 100 = fully up (full tank) */
  armPosition: number;
  color: string;
}

/**
 * The tank interior with the float valve arm — substantially deepened:
 * water is a live shimmering AnimatedWaterSurface instead of a flat block,
 * the arm settles into position with a spring (slight overshoot, like a
 * real hinged lever), the overflow tube pulses to show refill flow, and the
 * valve glows once the tank reads "full" so the cause-and-effect (float up
 * -> valve shuts -> flow stops) is unmistakable at a glance.
 */
export default function ToiletTankDiagram({ armPosition, color }: Props) {
  const waterHeight = 8 + (armPosition / 100) * 62;
  const armAngleTarget = -42 + (armPosition / 100) * 64;
  const isRefilling = armPosition < 92;
  const isNearFull = armPosition >= 88;

  const armAngle = useSharedValue(armAngleTarget);
  useEffect(() => {
    armAngle.value = withSpring(armAngleTarget, { damping: 9, stiffness: 90, mass: 0.6 });
  }, [armAngleTarget]);

  const glow = useSharedValue(0);
  useEffect(() => {
    glow.value = isNearFull
      ? withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.sin) }), -1, true)
      : withTiming(0, { duration: 200 });
  }, [isNearFull]);

  const armStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));

  const valveGlowStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + glow.value * 0.55,
    transform: [{ scale: 1 + glow.value * 0.18 }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.tank}>
        <View style={styles.waterClip}>
          <AnimatedWaterSurface level={waterHeight} color={color} turbulence={isRefilling ? 0.7 : 0.25} flowing={isRefilling} />
        </View>

        <Animated.View style={[styles.armPivot, armStyle]}>
          <View style={[styles.arm, { backgroundColor: color }]} />
          <View style={[styles.float, { backgroundColor: color, bottom: `${Math.max(0, waterHeight - 8)}%` }]} />
        </Animated.View>

        <View style={styles.valveTop}>
          <Animated.View style={[styles.valveGlow, valveGlowStyle, { backgroundColor: color }]} />
          <Ionicons name="water" size={14} color={color} />
          <View style={styles.valveLabelAnchor}>
            <FloatingLabel text="Valve sealed!" color={color} visible={isNearFull} />
          </View>
        </View>

        <View style={styles.overflowTube}>
          <FlowPipe color={color} horizontal={false} length={78} thickness={6} active={isRefilling} speedMs={480} />
        </View>
      </View>

      <View style={[styles.groundShadow, { opacity: 0.18 + (armPosition / 100) * 0.12 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  tank: {
    width: 140, height: 130, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(232,236,245,0.4)',
    backgroundColor: 'rgba(232,236,245,0.05)', overflow: 'hidden', justifyContent: 'flex-end', position: 'relative',
  },
  waterClip: { position: 'absolute', bottom: 0, left: 0, right: 0, top: 0, justifyContent: 'flex-end', overflow: 'hidden' },
  valveTop: {
    position: 'absolute', top: 8, right: 10, width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
    overflow: 'visible',
  },
  valveLabelAnchor: { position: 'absolute', top: -28, left: -30, width: 90, alignItems: 'center' },
  valveGlow: { position: 'absolute', width: 30, height: 30, borderRadius: 15 },
  armPivot: {
    position: 'absolute', top: 20, right: 20, width: 60, height: 4, alignItems: 'flex-start',
  },
  arm: { width: 50, height: 3, borderRadius: 2 },
  float: { position: 'absolute', left: 40, width: 16, height: 16, borderRadius: 8 },
  overflowTube: {
    position: 'absolute', left: 14, top: 10, bottom: 10, width: 6,
  },
  groundShadow: {
    width: 90, height: 10, borderRadius: 6, backgroundColor: '#000000', marginTop: 4,
  },
});
