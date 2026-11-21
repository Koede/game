/** Public API of the player module: controls, physics, block targeting and interaction. */
export * from './input';
export { PlayerController, SPRINT_FOV_KICK, type IntentSource, type PlayerControllerOptions } from './controller';
export { PlayerPhysics, MAX_FALL_SPEED, STEP_HEIGHT, type MoveInput, type StepResult } from './physics';
export { raycast, createRayHit, type RayHit } from './raycast';
export {
  Interaction,
  digSound,
  screenFor,
  facingTowards,
  DIG_INTERVAL_S,
  MINING_EVENT_INTERVAL_S,
  BREAK_COOLDOWN_S,
  PLACE_COOLDOWN_S,
  type BodyProbe,
  type SwingTarget,
  type UseOutcome,
} from './interaction';
export { AnimalHands, likedByAnimals, type AnimalTargets, type AnimalUse, type Advisor } from './animals';
