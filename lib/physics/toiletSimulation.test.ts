import { describe, expect, it } from 'vitest';
import {
  createRestingState,
  DEFAULT_SIM_INPUTS,
  stepToiletSim,
  triggerFlush,
} from './toiletSimulation';

describe('toilet simulation', () => {
  it('derives flush flow from gravity and pressure instead of replaying a timer', () => {
    const earth = triggerFlush(createRestingState(DEFAULT_SIM_INPUTS));
    const noGravity = triggerFlush(createRestingState({ ...DEFAULT_SIM_INPUTS, gravity: 0 }));

    expect(stepToiletSim(earth, DEFAULT_SIM_INPUTS, 0.05).inflowRate).toBeGreaterThan(0);
    expect(stepToiletSim(noGravity, { ...DEFAULT_SIM_INPUTS, gravity: 0 }, 0.05).inflowRate).toBe(0);
  });

  it('makes a larger pipe produce a higher tank-to-bowl flow rate', () => {
    const state = triggerFlush(createRestingState(DEFAULT_SIM_INPUTS));
    const narrow = stepToiletSim(state, { ...DEFAULT_SIM_INPUTS, pipeDiameter: 10 }, 0.05);
    const wide = stepToiletSim(state, { ...DEFAULT_SIM_INPUTS, pipeDiameter: 100 }, 0.05);

    expect(wide.inflowRate).toBeGreaterThan(narrow.inflowRate);
  });

  it('models a leak as a continuous competing flow and exposes refill failure', () => {
    const inputs = { ...DEFAULT_SIM_INPUTS, pipeDiameter: 10, tankVolume: 10, leakSize: 100 };
    const state = createRestingState(inputs);
    const next = stepToiletSim(state, inputs, 0.1);

    expect(next.refilling).toBe(true);
    expect(next.tankLevel).toBeLessThan(state.tankLevel);
    expect(next.refillFailureRisk).toBeGreaterThan(0);
  });

  it('caps a successful refill at the float cutoff', () => {
    const inputs = { ...DEFAULT_SIM_INPUTS, floatCutoff: 82, leakSize: 0 };
    let state = { ...createRestingState(inputs), tankLevel: 81.9, refilling: true };
    state = stepToiletSim(state, inputs, 0.1);

    expect(state.tankLevel).toBe(82);
    expect(state.refilling).toBe(true);
  });
});
