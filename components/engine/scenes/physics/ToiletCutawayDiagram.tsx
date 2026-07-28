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

interface Props {
  /** 0-100 through the whole flush cycle */
  progress: number;
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
 * Piecewise-linear interpolation across a sorted list of (at, value)
 * keyframes — used for every visual quantity in this diagram (water
 * levels, valve angle, trap fill) so each curve is a single readable list
 * of "at this progress %, be at this value" points instead of scattered
 * if/else branches that are easy to leave inconsistent with each other.
 */
function lerpKeyframes(p: number, keyframes: [number, number][]): number {
  if (p <= keyframes[0][0]) return keyframes[0][1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    const [atA, valA] = keyframes[i];
    const [atB, valB] = keyframes[i + 1];
    if (p <= atB) {
      const t = atB === atA ? 1 : (p - atA) / (atB - atA);
      return valA + (valB - valA) * t;
    }
  }
  return keyframes[keyframes.length - 1][1];
}

/**
 * A cross-sectional cutaway of an entire toilet — tank interior, float
 * valve, flush valve, overflow tube, trapway/siphon, bowl water, and outlet
 * pipe are all drawn in one continuous "sliced in half" illustration and
 * stay visible for the whole lesson (nothing is hidden behind taps). The
 * whole assembly is tilted a few degrees so the trapway's up-then-down
 * shape — the actual mechanism of the siphon — reads clearly instead of
 * being a straight vertical drop. Every visual value (water levels, valve
 * angles, trap fill, outlet flow) is a pure function of `progress`
 * (0-100), so CauseEffectExplorer's stage system and camera can drive it
 * to any point, forward or backward, at any speed.
 *
 * The physical model matches the lesson's 9 stages (see phy1_flush in
 * data/learningData.ts): the flush valve stays open for the entire time
 * the tank is draining into the bowl AND while the siphon is running (it
 * only shuts once the bowl has fully evacuated), so there's always a
 * visible, honest source for the bowl's rising water — nothing rises with
 * an invisible cause.
 */
export default function ToiletCutawayDiagram({ progress, color }: Props) {
  const p = Math.max(0, Math.min(100, progress));

  // Tank: full at rest -> drains steadily while the valve is open -> holds
  // near-empty through the siphon -> refills once the valve reseats.
  const tankLevel = lerpKeyframes(p, [
    [0, 82], [8, 82], [20, 45], [60, 14], [82, 10], [100, 84],
  ]);

  // Flush valve stays open from the handle press through the whole siphon
  // event, then reseats as the tank starts refilling.
  const flapperOpen = p >= 8 && p < 84;
  const flapperAngle = lerpKeyframes(p, [
    [0, 0], [8, 0], [20, 52], [78, 52], [84, 0], [100, 0],
  ]);

  // Bowl: resting seal -> rises as the tank pours in -> holds at the brim
  // right as the trapway fills -> rapid siphon evacuation -> settles to a
  // fresh resting seal once the siphon breaks.
  const bowlLevel = lerpKeyframes(p, [
    [0, 30], [10, 30], [40, 68], [48, 75], [60, 74], [75, 12], [82, 8], [100, 28],
  ]);

  // Trapway: the rising leg fills as the bowl approaches the brim; once
  // full it triggers the siphon, and the falling leg carries that same
  // water down to the outlet before draining empty again.
  const ascendingFill = lerpKeyframes(p, [[0, 0], [35, 0], [55, 1], [100, 1]]);
  const descendingFill = lerpKeyframes(p, [[0, 0], [55, 0], [70, 1], [80, 1], [88, 0], [100, 0]]);
  const siphonActive = p >= 53 && p < 82;
  const outletFlowing = p >= 58 && p < 86;

  // Float valve arm is mechanically tied to the tank's own water level —
  // the same physical cause the lesson is teaching, not a separate cue.
  const floatArmAngle = -38 + (tankLevel / 100) * 66;
  const isRefilling = p >= 82;

  const [splashKey, setSplashKey] = React.useState(0);
  const wasSiphon = React.useRef(false);
  React.useEffect(() => {
    if (siphonActive && !wasSiphon.current) {
      wasSiphon.current = true;
      setSplashKey(k => k + 1);
    }
    if (!siphonActive) wasSiphon.current = false;
  }, [siphonActive]);

  const flapperStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${flapperAngle}deg`, { duration: 200 }) }],
  }));

  const floatArmStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(`${floatArmAngle}deg`, { duration: 260 }) }],
  }));

  return (
    <View style={{ width: CUTAWAY_SCENE_WIDTH, height: CUTAWAY_SCENE_HEIGHT }}>
      <View style={styles.tiltWorld}>
        {/* ============ TANK INTERIOR ============ */}
        <View style={styles.tank}>
          <View style={styles.tankInteriorLabel}>
            <PartLabel text="Tank interior" />
          </View>
          <View style={styles.tankWaterClip}>
            <AnimatedWaterSurface level={tankLevel} color={color} turbulence={flapperOpen ? 0.9 : 0.25} flowing={flapperOpen || isRefilling} />
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

        {/* Short connector from tank down into the bowl */}
        <PipeSegment from={{ x: 115, y: 132 }} to={{ x: 115, y: 168 }} thickness={16} color={AIR} borderColor={PORCELAIN_LINE} />

        {/* ============ BOWL ============ */}
        <View style={styles.bowlBasin}>
          <View style={styles.bowlWaterClip}>
            <AnimatedWaterSurface level={Math.max(3, bowlLevel)} color={color} turbulence={siphonActive ? 1 : 0.35} flowing={siphonActive || flapperOpen} />
          </View>
          <View style={styles.bowlLabelAnchor}><PartLabel text="Bowl water" small /></View>
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
            <WaterDroplets trigger={splashKey} color={color} count={8} directionDeg={90} spreadDeg={80} />
            <RippleSplash trigger={splashKey} color={color} size={60} />
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
  tank: {
    position: 'absolute', left: 30, top: 10, width: 170, height: 122,
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
  bowlBasin: {
    position: 'absolute', left: 62, top: 168, width: 176, height: 80,
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
