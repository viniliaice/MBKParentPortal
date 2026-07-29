import { createRestingState, stepToiletSim, triggerFlush, type ToiletSimInputs, type ToiletSimState } from '@/lib/physics/toiletSimulation';
import type { PhysicsModel } from '@/lib/physics/PhysicsModel';

/**
 * Adapts lib/physics/toiletSimulation.ts's free functions to the generic
 * PhysicsModel<TInputs, TState> contract PhysicsSandbox.tsx expects. Kept
 * as a tiny separate file (not inlined into the registry) so the toilet
 * simulation module itself stays framework-agnostic and independently
 * testable, per the existing convention of physicsSceneRegistry.tsx being
 * the one place that wires subject-specific pieces together.
 *
 * The sandbox UI exposes gravity as an intuitive "% of Earth-normal"
 * slider (20-250%) — friendlier to read/round on a live label than the raw
 * 0-2.5 multiplier the (already numerically-verified) simulation core
 * expects internally. This adapter is the one place that does the /100
 * conversion, so lib/physics/toiletSimulation.ts's validated unit
 * convention (gravity=1 means Earth-normal) never has to change.
 */
export type ToiletSandboxInputs = Omit<ToiletSimInputs, 'gravity'> & { gravity: number };

function toSimInputs(inputs: ToiletSandboxInputs): ToiletSimInputs {
  return { ...inputs, gravity: inputs.gravity / 100 };
}

export const toiletPhysicsModel: PhysicsModel<ToiletSandboxInputs, ToiletSimState> = {
  createRestingState: (inputs) => createRestingState(toSimInputs(inputs)),
  step: (state, inputs, dtSec) => stepToiletSim(state, toSimInputs(inputs), dtSec),
  trigger: triggerFlush,
  isActive: (state, inputs) => state.valveOpen || state.siphonActive || state.refilling || (inputs.leakSize > 0 && state.tankLevel > 0),
};

