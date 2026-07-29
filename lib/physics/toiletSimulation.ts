import type { PhysicsModel } from '@/lib/physics/PhysicsModel';

/** Inputs expressed as learner-friendly percentages, except gravity (Earth = 1). */
export interface ToiletSimInputs {
  flushForce: number;
  pipeDiameter: number;
  leakSize: number;
  floatCutoff: number;
  tankVolume: number;
  gravity: number;
}

/** State is deliberately renderer-agnostic and contains only simulated quantities. */
export interface ToiletSimState {
  tankLevel: number;
  bowlLevel: number;
  trapAscendingFill: number;
  trapDescendingFill: number;
  siphonActive: boolean;
  tankPressure: number;
  inflowRate: number;
  outflowRate: number;
  valveOpen: boolean;
  refilling: boolean;
  /** 0–1 indication that a leak is greater than the available refill supply. */
  refillFailureRisk: number;
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

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
const clamp01 = (value: number) => clamp(value, 0, 1);
const clamp100 = (value: number) => clamp(value, 0, 100);

function normaliseInputs(inputs: ToiletSimInputs): ToiletSimInputs {
  return {
    flushForce: clamp100(inputs.flushForce),
    pipeDiameter: clamp100(inputs.pipeDiameter),
    leakSize: clamp100(inputs.leakSize),
    floatCutoff: clamp100(inputs.floatCutoff),
    tankVolume: clamp100(inputs.tankVolume),
    // Zero gravity is a valid experiment: it should stop gravity-driven flows.
    gravity: clamp(inputs.gravity, 0, 3),
  };
}

/**
 * Advances a simplified but state-driven toilet model. It is not a CFD model:
 * its purpose is to preserve the causal relationships learners can test:
 * hydrostatic pressure rises with height and gravity, flow rises with the
 * square root of pressure, a trap primes before a siphon can run, capacity
 * changes how quickly a level changes, and a leak competes with refill.
 */
export function stepToiletSim(previous: ToiletSimState, rawInputs: ToiletSimInputs, rawDtSec: number): ToiletSimState {
  const inputs = normaliseInputs(rawInputs);
  // Prevent a suspended JS thread from integrating several seconds in one jump.
  const dtSec = clamp(rawDtSec, 0, 0.1);
  const gravity = inputs.gravity;
  const pipeFactor = 0.35 + inputs.pipeDiameter / 100 * 1.15;
  const capacity = 0.5 + inputs.tankVolume / 100;
  const flushOpening = 0.5 + inputs.flushForce / 200;

  let tankLevel = clamp100(previous.tankLevel);
  let bowlLevel = clamp100(previous.bowlLevel);
  let ascending = clamp01(previous.trapAscendingFill);
  let descending = clamp01(previous.trapDescendingFill);
  let siphonActive = previous.siphonActive;
  let valveOpen = previous.valveOpen && tankLevel > 0.01;

  const pressure = clamp100(tankLevel * gravity);
  const inflowRate = valveOpen
    ? clamp100(Math.sqrt(pressure / 100) * 100 * pipeFactor * flushOpening)
    : 0;
  // Rates are level-points/second. A leak is always active, including at rest.
  const leakRate = inputs.leakSize / 100 * 18 * gravity / capacity;
  const tankToBowlRate = inflowRate / 100 * 26 / capacity;

  tankLevel = clamp100(tankLevel - (leakRate + (valveOpen ? tankToBowlRate : 0)) * dtSec);
  if (valveOpen) bowlLevel = clamp100(bowlLevel + tankToBowlRate * capacity * dtSec);

  if (!siphonActive && bowlLevel > 55) {
    ascending = clamp01(ascending + dtSec * 0.9 * pipeFactor * gravity);
    if (ascending >= 1) siphonActive = true;
  } else if (!siphonActive) {
    ascending = clamp01(ascending - dtSec * 0.4);
  }

  let outflowRate = 0;
  if (siphonActive) {
    const pullRate = 0.85 * pipeFactor * gravity * 34;
    bowlLevel = clamp100(bowlLevel - pullRate * dtSec);
    descending = clamp01(descending + dtSec * 1.1 * pipeFactor);
    outflowRate = clamp100(pullRate / 34 * 100);
    if (bowlLevel <= 8) {
      siphonActive = false;
      ascending = 0;
    }
  } else {
    descending = clamp01(descending - dtSec * 0.6);
    // The trap retains a seal rather than draining the bowl to zero.
    if (!valveOpen && bowlLevel > 30) bowlLevel = Math.max(30, bowlLevel - 4 * dtSec);
  }

  // The flush valve closes when the tank is empty, or once the siphon has
  // drained and the bowl is back below the weir. Neither condition is timed.
  if (valveOpen && (tankLevel <= 0.01 || (!siphonActive && descending <= 0.02 && bowlLevel < 35 && previous.elapsedSec > 0.6))) {
    valveOpen = false;
  }

  const refillSupplyRate = 22 * pipeFactor / capacity;
  const refilling = !valveOpen && tankLevel < inputs.floatCutoff - 0.01;
  if (refilling) {
    // A correctly adjusted float valve stops at its cutoff; it cannot keep
    // adding water past that target merely because a simulation frame was large.
    tankLevel = Math.min(inputs.floatCutoff, clamp100(tankLevel + (refillSupplyRate - leakRate) * dtSec));
  }

  return {
    tankLevel,
    bowlLevel,
    trapAscendingFill: ascending,
    trapDescendingFill: descending,
    siphonActive,
    tankPressure: clamp100(tankLevel * gravity),
    inflowRate,
    outflowRate,
    valveOpen,
    refilling,
    refillFailureRisk: refilling ? clamp01((leakRate - refillSupplyRate) / refillSupplyRate) : 0,
    elapsedSec: previous.elapsedSec + dtSec,
  };
}

export function createRestingState(rawInputs: ToiletSimInputs = DEFAULT_SIM_INPUTS): ToiletSimState {
  const inputs = normaliseInputs(rawInputs);
  return {
    tankLevel: inputs.floatCutoff,
    bowlLevel: 30,
    trapAscendingFill: 0,
    trapDescendingFill: 0,
    siphonActive: false,
    tankPressure: clamp100(inputs.floatCutoff * inputs.gravity),
    inflowRate: 0,
    outflowRate: 0,
    valveOpen: false,
    refilling: false,
    refillFailureRisk: 0,
    elapsedSec: 0,
  };
}

export function triggerFlush(state: ToiletSimState): ToiletSimState {
  // A trigger cannot create water: an empty tank remains unable to flush.
  return { ...state, valveOpen: state.tankLevel > 0.01, refilling: false, elapsedSec: 0 };
}

export const toiletSimulationModel: PhysicsModel<ToiletSimInputs, ToiletSimState> = {
  createRestingState,
  step: stepToiletSim,
  trigger: triggerFlush,
  isActive: (state, inputs) => state.valveOpen || state.siphonActive || state.refilling || (inputs.leakSize > 0 && state.tankLevel > 0),
};
