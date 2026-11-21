/** What the hostile brain and its attacks may read and call on each tick (the hostile layer provides it). */
import type { GameBus } from '../core/context';
import type { HostileSpec, IWorld } from '../core/types';
import type { SafeTest } from './hostileMove';
import type { Mob, MobPlayer } from './types';

export interface HostileCtx {
  readonly world: IWorld;
  readonly bus: GameBus;
  readonly rng: () => number;
  /** The player this tick. */
  player: MobPlayer;
  /** The player stands in a safe zone: nothing attacks them there. */
  playerSafe: boolean;
  /** The player stands in water (zaps hit harder). */
  playerWet: boolean;
  /** Clock sunlight below HOSTILE_NIGHT_SUNLIGHT. */
  night: boolean;
  /** Clock sunlight at or above HOSTILE_WIND_DOWN_SUNLIGHT. */
  daylight: boolean;
  /** Inside a safe zone (furnace warmth, ward beacon). */
  safe: SafeTest;
  /**
   * A landed attack: `mult` on the type's damage (zap in water), knockback `knock` along (dx, dz), coming from
   * (sx, sy, sz). Emits 'player:attacked', then hurts and throws the player through the hooks.
   */
  hurtPlayer(m: Mob, spec: HostileSpec, mult: number, dx: number, dz: number, knock: number, sx: number, sy: number, sz: number): void;
  /** Launches an ember bolt from (x, y, z) with this velocity. */
  fireBolt(m: Mob, spec: HostileSpec, x: number, y: number, z: number, vx: number, vy: number, vz: number): void;
}
