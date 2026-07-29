import React from 'react';
import ToiletCutawayVisual, { CUTAWAY_SCENE_WIDTH, CUTAWAY_SCENE_HEIGHT, type ToiletCutawayVisualState } from '@/components/engine/scenes/physics/ToiletCutawayVisual';

export { CUTAWAY_SCENE_WIDTH, CUTAWAY_SCENE_HEIGHT };

interface Props {
  /** 0-100 through the whole flush cycle */
  progress: number;
  color: string;
}

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
 * Adapter for the guided lesson flow: maps a single hand-authored 0-100
 * "progress" number (driven by CauseEffectExplorer's staged playback) onto
 * the shared ToiletCutawayVisual's state shape. This keeps the guided
 * lesson's carefully-timed, always-reproducible 9-stage script intact and
 * separate from the free-play physics sandbox (ToiletSandboxScene.tsx),
 * which drives the exact same visual component from a live simulation
 * instead of a curve — both are "real" uses of the same artwork, chosen
 * for what each activity needs: a repeatable narrative vs. open-ended play.
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

  const state: ToiletCutawayVisualState = {
    tankLevel,
    bowlLevel,
    flapperOpenAmount: flapperAngle / 52,
    ascendingFill,
    descendingFill,
    siphonActive,
    outletFlowing,
    isRefilling,
    floatAmount: tankLevel / 100,
    splashTrigger: splashKey,
  };

  return <ToiletCutawayVisual state={state} color={color} />;
}
