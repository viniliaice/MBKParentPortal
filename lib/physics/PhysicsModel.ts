/*
 * Generic contract a "physics sandbox" activity needs from any simulation
 * model, regardless of subject. lib/physics/toiletSimulation.ts is one
 * concrete model; a future Biology "population sandbox" or Chemistry
 * "reaction sandbox" would implement this exact same shape so
 * components/engine/PhysicsSandbox.tsx never needs to change.
 */
export interface PhysicsModel<TInputs, TState> {
  createRestingState: (inputs: TInputs) => TState;
  /** advance the simulation by dtSec given the current state + inputs */
  step: (state: TState, inputs: TInputs, dtSec: number) => TState;
  /** fired when the sandbox's primary trigger button is pressed */
  trigger?: (state: TState) => TState;
  /**
   * Lets the host stop rendering simulation frames while a model is at rest.
   * This is optional because some models intentionally evolve continuously.
   */
  isActive?: (state: TState, inputs: TInputs) => boolean;
}
