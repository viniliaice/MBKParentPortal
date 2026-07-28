import React from 'react';
import ToiletFlushDiagram from '@/components/engine/scenes/physics/ToiletFlushDiagram';
import ToiletTankDiagram from '@/components/engine/scenes/physics/ToiletTankDiagram';

/*
 * Resolves the plain string keys stored in data/learningData.ts (sceneKey,
 * narrateKey, describeKey) into actual render functions / text generators.
 * This indirection is what keeps the curriculum data file pure and
 * serializable (per its existing convention — see ExplorableConfig) while
 * still letting each engine activity render a real, subject-specific
 * illustration. A future Biology module would add its own
 * biologySceneRegistry.tsx next to this one; ActivityRenderer never needs
 * to change.
 */

export const physicsSceneRegistry: Record<string, (progress: number, stageIndex: number, color: string) => React.ReactNode> = {
  toiletFlush: (progress, _stageIndex, color) => <ToiletFlushDiagram progress={progress} color={color} />,
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
