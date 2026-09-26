import React, { useEffect, useRef, useState } from 'react';
import ToiletCutawayVisual, { type ToiletCutawayVisualState } from '@/components/engine/scenes/physics/ToiletCutawayVisual';
import type { ToiletSimState } from '@/lib/physics/toiletSimulation';

interface Props {
  state: ToiletSimState;
  color: string;
}

/**
 * Maps a live ToiletSimState (from lib/physics/toiletSimulation.ts, a real
 * continuously-stepped simulation) onto ToiletCutawayVisual's presentational
 * state shape. This is the sandbox-mode counterpart to
 * ToiletCutawayDiagram.tsx (which maps a hand-authored progress curve
 * instead) — both feed the exact same artwork, so improving the visual in
 * one place improves both the guided lesson and the free-play sandbox.
 */
export default function ToiletSandboxScene({ state, color }: Props) {
  const [splashTrigger, setSplashTrigger] = useState(0);
  const wasSiphon = useRef(false);
  useEffect(() => {
    if (state.siphonActive && !wasSiphon.current) {
      wasSiphon.current = true;
      setSplashTrigger(n => n + 1);
    }
    if (!state.siphonActive) wasSiphon.current = false;
  }, [state.siphonActive]);

  const visual: ToiletCutawayVisualState = {
    tankLevel: state.tankLevel,
    bowlLevel: state.bowlLevel,
    flapperOpenAmount: state.valveOpen ? 1 : 0,
    ascendingFill: state.trapAscendingFill,
    descendingFill: state.trapDescendingFill,
    siphonActive: state.siphonActive,
    outletFlowing: state.outflowRate > 5,
    isRefilling: state.refilling,
    floatAmount: state.tankLevel / 100,
    splashTrigger,
  };

  return <ToiletCutawayVisual state={visual} color={color} />;
}
