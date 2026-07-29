import React from 'react';
import ToiletCutawayDiagram from '@/components/engine/scenes/physics/ToiletCutawayDiagram';
import ToiletTankDiagram from '@/components/engine/scenes/physics/ToiletTankDiagram';
import ToiletSandboxScene from '@/components/engine/scenes/physics/ToiletSandboxScene';
import { toiletPhysicsModel } from '@/components/engine/registry/toiletPhysicsModel';
import type { ToiletSimState } from '@/lib/physics/toiletSimulation';
import type { PhysicsModel } from '@/lib/physics/PhysicsModel';

/*
 * Resolves the plain string keys stored in data/learningData.ts (sceneKey,
 * narrateKey, describeKey, modelKey) into actual render functions / text
 * generators / simulation models. This indirection is what keeps the
 * curriculum data file pure and serializable (per its existing convention
 * — see ExplorableConfig) while still letting each engine activity render
 * a real, subject-specific illustration and run a real simulation model.
 * A future Biology module would add its own biologySceneRegistry.tsx next
 * to this one; ActivityRenderer never needs to change.
 */

export const physicsSceneRegistry: Record<string, (progress: number, color: string) => React.ReactNode> = {
  toiletCutaway: (progress, color) => <ToiletCutawayDiagram progress={progress} color={color} />,
};

export const physicsTankSceneRegistry: Record<string, (params: Record<string, number>, color: string) => React.ReactNode> = {
  toiletTank: (params, color) => <ToiletTankDiagram armPosition={params.floatHeight ?? 0} color={color} />,
};

export const physicsDescribeRegistry: Record<string, (position: number) => string> = {
  floatValve: (position) => {
    if (position < 15) return 'Tank empty — the float sits low, holding the valve wide open so water rushes in fast.';
    if (position < 45) return 'Water is filling. The float is rising with it, slowly closing the valve.';
    if (position < 80) return 'Almost full — the float is nearly at the top, the valve is nearly shut.';
    return 'Tank full! The float has risen all the way, shutting the valve completely so no water overflows.';
  },
};

export const physicsNarrateRegistry: Record<string, (params: Record<string, number>) => string> = {
  floatValveExperiment: (params) => {
    const h = params.floatHeight ?? 0;
    if (h < 15) return 'Notice both gauges are maxed out — an empty tank means the valve is wide open, letting water rush in as fast as possible.';
    if (h < 50) return 'Watch closely: as you drag the float up, both the refill speed and the valve pressure fall together. They\'re controlled by the exact same mechanism.';
    if (h < 85) return 'Almost there — the valve is nearly shut, so almost no water is flowing and pressure is nearly zero.';
    return 'You found it: at full height the valve seals completely. Zero flow, zero pressure — this is exactly how a tank avoids overflowing without anyone watching it.';
  },
};

/**
 * Sandbox-mode registries: a PhysicsSandbox activity resolves modelKey ->
 * a PhysicsModel implementation, and sceneKey -> a renderer of that
 * model's own state type. Kept separate from physicsSceneRegistry above
 * (which renders a plain 0-100 progress number) since a sandbox scene
 * needs the model's full state shape, not a single number.
 */
export const physicsSandboxModelRegistry: Record<string, PhysicsModel<any, any>> = {
  toilet: toiletPhysicsModel,
};

export const physicsSandboxSceneRegistry: Record<string, (state: any, color: string) => React.ReactNode> = {
  toiletSandbox: (state: ToiletSimState, color: string) => <ToiletSandboxScene state={state} color={color} />,
};

export const physicsSandboxNarrateRegistry: Record<string, (state: ToiletSimState, inputs: Record<string, number>) => string> = {
  toiletSandbox: (state, inputs) => {
    if (state.siphonActive) {
      return `SIPHON RUNNING — the trapway is completely full, pulling water out at ${Math.round(state.outflowRate)}% flow. Bigger pipes make this happen faster.`;
    }
    if (state.refilling) {
      if (state.overflowRisk > 0.05) {
        return `Refilling, but the float cutoff is set so high (${Math.round(inputs.floatCutoff)}%) there's barely any safety margin before overflow — try lowering it.`;
      }
      return `Refilling now. The float rises with the tank and will shut the valve at ${Math.round(inputs.floatCutoff)}%.`;
    }
    if (state.valveOpen) {
      return `Flushing — pressure at the base of the tank is ${Math.round(state.tankPressure)}%, pushing water into the bowl at ${Math.round(state.inflowRate)}% flow.`;
    }
    if (inputs.leakSize > 40) {
      return 'A leak this size drains the tank faster than it can refill — try shrinking it and watch the refill behave normally again.';
    }
    return 'Everything at rest. Try the sliders — every one of them changes how the flush behaves.';
  },
};
