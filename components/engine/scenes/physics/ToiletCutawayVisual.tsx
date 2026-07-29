import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import AnimatedWaterSurface from '@/components/engine/primitives/AnimatedWaterSurface';
import FlowPipe from '@/components/engine/primitives/FlowPipe';
import WaterDroplets from '@/components/engine/primitives/WaterDroplets';
import RippleSplash from '@/components/engine/primitives/RippleSplash';
import PipeSegment from '@/components/engine/primitives/PipeSegment';

export const CUTAWAY_SCENE_WIDTH = 340;
export const CUTAWAY_SCENE_HEIGHT = 400;

export interface ToiletCutawayVisualState {
  tankLevel: number; // 0-100
  bowlLevel: number; // 0-100
  /** 0-1, how open the flush valve currently is */
  flapperOpenAmount: number;
  /** 0-1, how full the ascending trapway leg is */
  ascendingFill: number;
  /** 0-1, how full the descending trapway leg is */
  descendingFill: number;
  siphonActive: boolean;
  outletFlowing: boolean;
  isRefilling: boolean;
  /** 0-1, drives the float arm angle directly (independent of tankLevel so a sandbox can desync them, e.g. a stuck float) */
  floatAmount: number;
  splashTrigger: number;
}

interface Props {
  state: ToiletCutawayVisualState;
  color: string;
}

const PORCELAIN = '#E8ECF5';
const PORCELAIN_LINE = 'rgba(232,236,245,0.55)';
const AIR = 'rgba(232,236,245,0.03)';

// Fixed world-space coordinates for the cutaway's plumbing skeleton — a
// simplified P-trap: water leaves the bowl, climbs the ascending leg over
// the "weir" (the high point that normally keeps a resting seal of water
// in the bowl), then falls down the descending leg to the outlet. Once the
// ascending leg is completely full of water, the whole trapway acts like a
// bent straw and siphons the bowl empty — that's the entire teaching point
// of this cutaway, so its shape needs to read clearly even without labels.
const BOWL_BOTTOM = { x: 150, y: 246 };
const WEIR_PEAK = { x: 205, y: 214 };
const TRAP_LOW = { x: 244, y: 288 };
const OUTLET_END = { x: 300, y: 330 };

/**
 * The presentational toilet cutaway artwork — tank interior, float valve,
 * flush valve, overflow tube, trapway/siphon, bowl water, and outlet pipe,
 * all visible at once, tilted a few degrees so the trapway's climb-then-
 * fall shape reads clearly. This component only *renders* a given state;
 * it has no opinion about where that state comes from. Two different data
 * sources drive it elsewhere in this codebase:
 *
 *   - ToiletCutawayDiagram.tsx: a hand-authored progress curve (used by
 *     the guided, staged CauseEffectExplorer lesson flow)
 *   - ToiletSandboxScene.tsx: a live, continuous physics simulation
 *     (lib/physics/toiletSimulation.ts) driven by free-play sliders
 *
 * Keeping the artwork itself decoupled from both is what makes "add a
 * sandbox mode" an additive change instead of a fork of the diagram.
 */
export default function ToiletCutawayVisual({ state, color }: Props) {
  const {
    tankLevel, bowlLevel, flapperOpenAmount, ascendingFill, descendingFill,
    siphonActive, outletFlowing, isRefilling, floatAmount, splashTrigger,
  } = state;

  const flapperAngle = flapperOpenAmount * 52;
  const floatArmAngle = -38 + floatAmount * 66;

  const flapperStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${flapperAngle}deg`, { duration: 180 }) }],
  }));

  const floatArmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${floatArmAngle}deg`, { duration: 220 }) }],
  }));

  return (
    <View style={{ width: CUTAWAY_SCENE_WIDTH, height: CUTAWAY_SCENE_HEIGHT }}>
      <View style={styles.tiltWorld}>
        {/* ============ TANK INTERIOR ============ */}
        {/* Shadow lives on an outer, non-clipping wrapper — `overflow:
            hidden` (needed to clip the water fill) also clips shadows if
            they're on the same view, so the shadow has to be one layer
            up. */}
        <View style={styles.tankShadowWrap}>
          <View style={styles.tank}>
            <View style={styles.tankInteriorLabel}>
              <PartLabel text="Tank interior" />
            </View>
            <View style={styles.tankWaterClip}>
              <AnimatedWaterSurface level={tankLevel} color={color} turbulence={flapperOpenAmount > 0.1 ? 0.9 : 0.25} flowing={flapperOpenAmount > 0.1 || isRefilling} />
            </View>

            {/* Overflow tube — always visible, carries refill water down into the bowl */}
            <View style={styles.overflowTube}>
              <FlowPipe color={color} horizontal={false} length={96} thickness={10} active={isRefilling} speedMs={520} />
              <View style={styles.overflowLabelAnchor}><PartLabel text="Overflow tube" small /></View>
            </View>

            {/* Float valve — ball float on an arm, mechanically tied to tank water level */}
            <Animated.View style={[styles.floatArmPivot, floatArmStyle]}>
              <View style={[styles.floatArm, { backgroundColor: color }]} />
              <View style={[styles.floatBall, { borderColor: color }]} />
            </Animated.View>
            <View style={styles.floatLabelAnchor}><PartLabel text="Float valve" small /></View>

            {/* Flush valve (flapper) — hinged seal between tank and bowl */}
            <View style={styles.flushValveSeat}>
              <Animated.View style={[styles.flapper, flapperStyle, { backgroundColor: color, borderColor: PORCELAIN }]} />
              <View style={styles.flushValveLabelAnchor}><PartLabel text="Flush valve" small /></View>
            </View>
          </View>
        </View>

        {/* Short connector from tank down into the bowl */}
        <PipeSegment from={{ x: 115, y: 132 }} to={{ x: 115, y: 168 }} thickness={16} color={AIR} borderColor={PORCELAIN_LINE} />

        {/* ============ BOWL ============ */}
        <View style={styles.bowlShadowWrap}>
          <View style={styles.bowlBasin}>
            <View style={styles.bowlWaterClip}>
              <AnimatedWaterSurface level={Math.max(3, bowlLevel)} color={color} turbulence={siphonActive ? 1 : 0.35} flowing={siphonActive || flapperOpenAmount > 0.1} />
            </View>
            <View style={styles.bowlLabelAnchor}><PartLabel text="Bowl water" small /></View>
          </View>
        </View>

        {/* ============ TRAPWAY / SIPHON ============ */}
        <PipeSegment from={BOWL_BOTTOM} to={WEIR_PEAK} thickness={26} color={AIR} borderColor={PORCELAIN_LINE} fillProgress={Math.max(bowlLevel > 5 ? 0.15 : 0, ascendingFill)} fillColor={`${color}CC`} />
        <PipeSegment from={WEIR_PEAK} to={TRAP_LOW} thickness={24} color={AIR} borderColor={PORCELAIN_LINE} fillProgress={descendingFill} fillColor={`${color}CC`} />
        <PipeSegment from={TRAP_LOW} to={OUTLET_END} thickness={22} color={AIR} borderColor={PORCELAIN_LINE} />

        <View style={[styles.weirLabelAnchor, { left: WEIR_PEAK.x - 30, top: WEIR_PEAK.y - 34 }]}>
          <PartLabel text="Siphon" small highlight={siphonActive} color={color} />
        </View>
        <View style={[styles.trapLabelAnchor, { left: BOWL_BOTTOM.x + 10, top: BOWL_BOTTOM.y + 30 }]}>
          <PartLabel text="Trapway" small />
        </View>

        {siphonActive && (
          <View style={[styles.splashAnchor, { left: WEIR_PEAK.x, top: WEIR_PEAK.y }]}>
            <WaterDroplets trigger={splashTrigger} color={color} count={8} directionDeg={90} spreadDeg={80} />
            <RippleSplash trigger={splashTrigger} color={color} size={60} />
          </View>
        )}

        {/* Outlet pipe to the sewer line */}
        <View style={[styles.outletFlowAnchor, { left: TRAP_LOW.x, top: TRAP_LOW.y }]}>
          <FlowPipe color={color} horizontal length={70} thickness={20} active={outletFlowing} speedMs={260} />
        </View>
        <View style={[styles.outletLabelAnchor, { left: OUTLET_END.x - 40, top: OUTLET_END.y + 12 }]}>
          <PartLabel text="Outlet pipe" small />
        </View>
      </View>
    </View>
  );
}

function PartLabel({ text, small, highlight, color }: { text: string; small?: boolean; highlight?: boolean; color?: string }) {
  return (
    <View style={styles.labelCounterRotate}>
      <View style={[styles.labelPill, highlight && { backgroundColor: `${color ?? '#22D3EE'}33`, borderColor: color }]}>
        <Text style={[styles.labelText, small && styles.labelTextSmall, highlight && { color: color ?? '#22D3EE' }]}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The whole assembly tilts a few degrees so the trapway's climb-then-fall
  // shape — the actual siphon mechanism — is legible instead of reading as
  // a straight vertical pipe. Rotation is baked into the artwork itself
  // (not the camera), so SceneCamera's pan/zoom math stays simple.
  tiltWorld: {
    width: CUTAWAY_SCENE_WIDTH, height: CUTAWAY_SCENE_HEIGHT,
    transform: [{ rotate: '-7deg' }],
  },
  tankShadowWrap: {
    position: 'absolute', left: 30, top: 10, width: 170, height: 122,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  tank: {
    width: 170, height: 122,
    borderRadius: 10, borderWidth: 2.5, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.05)', overflow: 'hidden',
  },
  tankInteriorLabel: { position: 'absolute', top: 4, left: 6 },
  tankWaterClip: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', overflow: 'hidden' },
  overflowTube: { position: 'absolute', left: 130, top: 14, alignItems: 'center' },
  overflowLabelAnchor: { position: 'absolute', top: -2, left: 14, width: 90 },
  floatArmPivot: {
    position: 'absolute', top: 26, right: 14, width: 60, height: 4, alignItems: 'flex-start',
  },
  floatArm: { width: 46, height: 3, borderRadius: 2 },
  floatBall: { position: 'absolute', left: 40, top: -7, width: 16, height: 16, borderRadius: 8, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.1)' },
  floatLabelAnchor: { position: 'absolute', top: 4, right: 6, width: 80 },
  flushValveSeat: { position: 'absolute', bottom: 4, left: 62, alignItems: 'center' },
  flapper: { width: 34, height: 8, borderRadius: 4, borderWidth: 1.5 },
  flushValveLabelAnchor: { position: 'absolute', bottom: -18, left: -20, width: 90 },
  bowlShadowWrap: {
    position: 'absolute', left: 62, top: 168, width: 176, height: 80,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7,
  },
  bowlBasin: {
    width: 176, height: 80,
    borderRadius: 40, borderWidth: 3, borderColor: PORCELAIN,
    backgroundColor: 'rgba(232,236,245,0.05)', overflow: 'hidden',
  },
  bowlWaterClip: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', overflow: 'hidden' },
  bowlLabelAnchor: { position: 'absolute', top: 6, left: 10 },
  weirLabelAnchor: { position: 'absolute', width: 80 },
  trapLabelAnchor: { position: 'absolute', width: 80 },
  splashAnchor: { position: 'absolute', width: 0, height: 0 },
  outletFlowAnchor: { position: 'absolute' },
  outletLabelAnchor: { position: 'absolute', width: 90 },
  labelPill: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(11,16,38,0.55)', borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  labelCounterRotate: { transform: [{ rotate: '7deg' }] },
  labelText: { fontSize: 9, fontWeight: '700', color: '#CCCCCC', letterSpacing: 0.2 },
  labelTextSmall: { fontSize: 8 },
});
