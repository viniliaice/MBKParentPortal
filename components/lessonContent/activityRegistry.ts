/*
 * Application composition root for curriculum-specific renderers and models.
 * Engine components receive resolved functions/models; they do not know which
 * subject or lesson supplied them. Add future subject registries here rather
 * than adding subject branches to ActivityRenderer or components/engine.
 */
import {
  physicsDescribeRegistry,
  physicsNarrateRegistry,
  physicsSandboxModelRegistry,
  physicsSandboxNarrateRegistry,
  physicsSandboxSceneRegistry,
  physicsSceneRegistry,
  physicsTankSceneRegistry,
} from '@/components/lessonContent/physics/toiletActivityRegistry';

export const sceneRegistry = physicsSceneRegistry;
export const parameterSceneRegistry = physicsTankSceneRegistry;
export const describeRegistry = physicsDescribeRegistry;
export const narrateRegistry = physicsNarrateRegistry;
export const sandboxModelRegistry = physicsSandboxModelRegistry;
export const sandboxSceneRegistry = physicsSandboxSceneRegistry;
export const sandboxNarrateRegistry = physicsSandboxNarrateRegistry;
