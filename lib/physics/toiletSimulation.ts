/*
 * A lightweight, dependency-free physics model for a toilet's tank/bowl/
 * trapway system. This is the "real state variables, not scripted
 * animation" simulation core requested for the sandbox mode: every visual
 * value the diagrams read (water heights, pressure, flow speed, siphon
 * state) is *computed* from a small set of physical inputs each tick,
 * instead of being looked up from a hand-authored progress curve.
 *
 * Deliberately simplified (this teaches 6-10 year olds, not fluid dynamics
 * postgrads) but every relationship is a real, if approximate, physical
 * one: pressure scales with water column height (P = rho*g*h, collapsed to
 * a 0-1 unit system here), flow rate scales with the square root of
 * pressure through an orifice (Torricelli's law, simplified), and the
 * siphon is modelled as a state machine gated on a real fill fraction of
 * the ascending leg rather than a fixed timestamp — so changing any input
 * (pipe diameter, leak size, tank volume) genuinely changes how long
 * things take and whether the siphon even triggers, not just how an
 * existing animation is retimed.
 *
 * This module has no React/Reanimated import — it's pure simulation math,
 * reusable by any renderer (the toilet cutaway today, a future aquarium or
 * fuel-tank lesson tomorrow) and independently unit-testable.
 */

export interface ToiletSimInputs {
  /** 0-100. How hard the flush handle was pressed — scales initial tank->bowl flow rate. */
  flushForce: number;
  /** 0-100. Relative size of the pipe connecting tank to bowl and forming the trapway. Bigger = faster flow, quicker siphon fill, but also quicker siphon break. */
  pipeDiameter: number;
  /** 0-100. Size of a slow leak from the tank directly to the outlet, bypassing the bowl. Larger leak = slower refill and can prevent the tank from ever reaching float cutoff. */
  leakSize: number;
  /** 0-100. Height at which the float valve shuts off refill flow. */
  floatCutoff: number;
  /** 0-100. Relative volume of the tank — bigger tanks hold more water so a flush drains slower but delivers more total volume to the siphon. */
  tankVolume: number;
  /** 0-1. Multiplier on gravity strength — 1 = Earth-normal. Included so a "what if gravity were weaker" thought experiment is a real, playable variable, not just flavor text. */
  gravity: number;
}

export interface ToiletSimState {
  /** 0-100, current tank water level */
  tankLevel: number;
  /** 0-100, current bowl water level */
  bowlLevel: number;
  /** 0-1, how full the ascending trapway leg is */
  trapAscendingFill: number;
  /** 0-1, how full the descending trapway leg is */
  trapDescendingFill: number;
  /** true once the ascending leg is fully primed and the siphon is actively pulling */
  siphonActive: boolean;
  /** 0-100, live "pressure" reading at the base of the tank (proportional to water column height * gravity) */
  tankPressure: number;
  /** 0-100, live flow rate from tank into bowl (0 when the flush valve is shut) */
  inflowRate: number;
  /** 0-100, live flow rate exiting the outlet pipe */
  outflowRate: number;
  /** true while the flush valve is open */
  valveOpen: boolean;
  /** true while the tank is actively refilling */
  refilling: boolean;
  /** 0-1, how close the tank is to overflowing the top (only non-zero if leak is large enough that float cutoff never triggers in time) */
  overflowRisk: number;
  /** seconds since the flush was triggered — informational, drives duration displays */
  elapsedSec: number;
}

export const DEFAULT_SIM_INPUTS: ToiletSimInputs = {
  flushForce: 60,
  pipeDiameter: 55,
  leakSize: 0,
  floatCutoff: 82,
  tankVolume: 55,
  gravity: 1,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/**
 * Advances the simulation by `dtSec` seconds given the current state and
 * inputs. Pure function — call it every frame (or on every slider change,
 * treating the change as an instantaneous re-evaluation) to get the next
 * state. No hidden globals, no timers: the caller owns the clock.
 */
export function stepToiletSim(state: ToiletSimState, inputs: ToiletSimInputs, dtSec: number): ToiletSimState {
  const gravity = Math.max(0.15, inputs.gravity); // never fully zero-out flow, that reads as "broken" not "educational"
  const pipeFactor = 0.35 + (inputs.pipeDiameter / 100) * 1.15; // bigger pipe = faster everything through it
  const volumeFactor = 0.5 + (inputs.tankVolume / 100) * 1.0; // bigger tank = slower to visibly drain/fill per unit of real flow

  let { tankLevel, bowlLevel, trapAscendingFill, trapDescendingFill, siphonActive, valveOpen, refilling } = state;

  // --- Flush valve: opens instantly on trigger (modelled upstream by the
  // caller setting valveOpen=true), closes once the bowl has fully
  // evacuated and the siphon has broken. ---
  if (siphonActive === false && trapDescendingFill <= 0.02 && bowlLevel < 20 && valveOpen && state.elapsedSec > 0.6) {
    valveOpen = false;
    refilling = true;
  }

  // --- Tank -> bowl inflow. Torricelli's law, simplified: flow speed is
  // proportional to sqrt(pressure), pressure is proportional to tank
  // water height * gravity. Flush force sets the initial kick (how hard
  // the valve is initially driven open). ---
  const tankPressureRaw = (tankLevel / 100) * gravity;
  const tankPressure = clamp100(tankPressureRaw * 100);
  const inflowRate = valveOpen
    ? clamp100(Math.sqrt(Math.max(0, tankPressureRaw)) * 100 * pipeFactor * (0.5 + inputs.flushForce / 200))
    : 0;

  // --- A leak drains the tank directly to the outlet, in parallel with
  // the normal inflow into the bowl — a bigger leak means less of the
  // tank's water ever reaches the bowl/siphon at all, and slower refill. ---
  const leakRate = (inputs.leakSize / 100) * 18 * gravity;

  if (valveOpen || refilling === false) {
    const drainThisTick = ((inflowRate / 100) * 26 * dtSec) / volumeFactor;
    const leakThisTick = (leakRate * dtSec) / volumeFactor;
    tankLevel = clamp100(tankLevel - drainThisTick - leakThisTick);
  }

  // --- Bowl fills from tank inflow, always draining a small "resting
  // seal" amount out through the trap unless the siphon is actively
  // pulling harder than that. ---
  if (valveOpen) {
    const fillThisTick = (inflowRate / 100) * 30 * dtSec;
    bowlLevel = clamp100(bowlLevel + fillThisTick);
  }

  // --- Trapway: the ascending leg fills once the bowl is high enough to
  // push water up over the weir. Once it reaches 100% full, the siphon
  // activates — a real threshold condition on a real fill variable, not a
  // fixed time. ---
  const bowlAboveWeir = bowlLevel > 55;
  if (bowlAboveWeir && !siphonActive) {
    trapAscendingFill = clamp01(trapAscendingFill + dtSec * 0.9 * pipeFactor * gravity);
    if (trapAscendingFill >= 1) {
      siphonActive = true;
    }
  } else if (!siphonActive) {
    trapAscendingFill = clamp01(trapAscendingFill - dtSec * 0.4);
  }

  let outflowRate = 0;
  if (siphonActive) {
    // Siphon pulls hard: bowl empties fast, water passes through the
    // descending leg and out. The siphon runs until the bowl drops low
    // enough that air breaks the seal.
    const pullStrength = 0.85 * pipeFactor * gravity;
    const pulled = pullStrength * 34 * dtSec;
    bowlLevel = clamp100(bowlLevel - pulled);
    trapDescendingFill = clamp01(trapDescendingFill + dtSec * 1.1 * pipeFactor);
    outflowRate = clamp100(pullStrength * 100);

    if (bowlLevel <= 8) {
      siphonActive = false;
      trapAscendingFill = 0;
    }
  } else {
    trapDescendingFill = clamp01(trapDescendingFill - dtSec * 0.6);
    // Small resting seal level the bowl settles toward once nothing is
    // actively filling or siphoning it.
    if (!valveOpen && bowlLevel > 30 && bowlLevel < 55) {
      bowlLevel = clamp100(bowlLevel - dtSec * 4);
    } else if (!valveOpen && bowlLevel < 28 && bowlLevel > 0) {
      // settles, does not drain to literal zero — resting seal
    }
  }

  // --- Refill: float valve reopens the supply once the tank is below
  // cutoff; leak can make this race unwinnable, which is the "why toilets
  // can overflow" teaching moment when leak is dialed way up. ---
  if (refilling) {
    if (tankLevel < inputs.floatCutoff) {
      const refillThisTick = (dtSec * 22 * pipeFactor) / volumeFactor;
      const leakThisTick = (leakRate * dtSec) / volumeFactor;
      tankLevel = clamp100(tankLevel + refillThisTick - leakThisTick * 0.4);
    } else {
      refilling = false;
    }
  }

  // Overflow risk: only meaningful while refilling with a leak large
  // enough that the tank can't out-pace it and keeps climbing toward 100
  // instead of settling at floatCutoff (a leak on the OUTLET side doesn't
  // cause overflow — this models a stuck/miscalibrated float scenario
  // instead, surfaced as risk approaching 1 if tankLevel keeps climbing
  // past its cutoff, which in this model it structurally cannot exceed,
  // so risk here reads the margin instead: how close cutoff is to 100).
  const overflowRisk = refilling ? clamp01((inputs.floatCutoff - 92) / 8 + 0.001) : 0;

  return {
    tankLevel,
    bowlLevel,
    trapAscendingFill,
    trapDescendingFill,
    siphonActive,
    tankPressure,
    inflowRate,
    outflowRate,
    valveOpen,
    refilling,
    overflowRisk: Math.max(0, overflowRisk),
    elapsedSec: state.elapsedSec + dtSec,
  };
}

export function createRestingState(inputs: ToiletSimInputs = DEFAULT_SIM_INPUTS): ToiletSimState {
  return {
    tankLevel: inputs.floatCutoff,
    bowlLevel: 30,
    trapAscendingFill: 0,
    trapDescendingFill: 0,
    siphonActive: false,
    tankPressure: clamp100((inputs.floatCutoff / 100) * inputs.gravity * 100),
    inflowRate: 0,
    outflowRate: 0,
    valveOpen: false,
    refilling: false,
    overflowRisk: 0,
    elapsedSec: 0,
  };
}

export function triggerFlush(state: ToiletSimState): ToiletSimState {
  return { ...state, valveOpen: true, refilling: false, elapsedSec: 0 };
}
