/** Shared shapes of src/mobs: the live animal record, what the manager needs from its surroundings, snapshots. */
import type { BiomeKey, CreatureSpec, ItemAmount } from '../core/types';

/** What an animal is doing. 'breed' covers walking to a partner and the 3 s together; 'dying' is the tip-over. */
export type MobState = 'idle' | 'wander' | 'graze' | 'flee' | 'follow' | 'breed' | 'swim' | 'dying';

/** One live animal. Mutable, owned by the MobManager; read it, never write it from outside. */
export interface Mob {
  readonly id: number;
  readonly spec: CreatureSpec;
  /** Centre of the feet, blocks. */
  x: number;
  y: number;
  z: number;
  /** Position and facing at the start of the last tick (for interpolation). */
  px: number;
  py: number;
  pz: number;
  pyaw: number;
  vx: number;
  vy: number;
  vz: number;
  /** Facing, radians; 0 looks north (-Z), positive turns left (the camera convention). */
  yaw: number;
  health: number;
  baby: boolean;
  /** Seconds lived (babies grow up at MOB_GROW_UP_S). */
  ageS: number;
  state: MobState;
  /** Seconds left in the current idle / graze / wander state. */
  stateS: number;
  /** Where it is walking to (wander, follow, breed, swim). */
  tx: number;
  tz: number;
  hasTarget: boolean;
  /** Seconds of eagerness left after being fed (0 = not eager). */
  eagerS: number;
  /** Seconds before it can breed again. */
  cooldownS: number;
  /** Partner while breeding (0 = none), and seconds spent together. */
  partner: number;
  breedS: number;
  /** Flee burst left, and the point it runs from. */
  fleeS: number;
  fleeX: number;
  fleeZ: number;
  /** The flee point follows the player (hurt by the player) rather than staying put (hurt by a hazard). */
  fleeFromPlayer: boolean;
  /** Red flash left (seconds), and the invulnerability after a hit. */
  hurtS: number;
  hitCooldownS: number;
  /** Seconds to the next idle call. */
  callS: number;
  /** Seconds since it died (only while state === 'dying'). */
  deadS: number;
  /** Drops rolled at the killing blow, handed out when the tip-over ends; and what killed it. */
  pendingDrops: ItemAmount[] | null;
  deathCause: DeathCause;
  /** Seconds to the next contact-damage hit (lava). */
  contactS: number;
  onGround: boolean;
  inLiquid: boolean;
  /** The last physics step ran into a wall. */
  blocked: boolean;
  /** Facing an idle animal is slowly turning to (NaN = none). */
  lookYaw: number;
  /** Horizontal speed reached last tick (m/s), for leg swing. */
  speed: number;
  /** Distance walked (blocks), the leg-swing phase; and its value at the start of the last tick. */
  walk: number;
  pwalk: number;
  /** 0..1 how far the head is lowered (grazing). */
  head: number;
  phead: number;
  /** Seconds the current walk target has been pursued without progress. */
  stuckS: number;
}

/** The player, as far as animals care. `heldItem()` is the key of the item in the hand, or null. */
export interface MobPlayer {
  x: number;
  y: number;
  z: number;
  /** View yaw (keep-alive spawns avoid the view direction). */
  yaw: number;
  heldItem(): string | null;
}

/** The game clock, as far as animals care (GameClock satisfies it). */
export interface MobClock {
  readonly timeOfDay: number;
  sunlight(): number;
}

export type BiomeLookup = (x: number, z: number) => BiomeKey;

/** Why an animal died: hit by the player, or the world (lava, falling out). */
export type DeathCause = 'player' | 'world';

/** Handed to death listeners once the tip-over is over (MOB_DEATH_S after the killing blow). */
export interface MobDeath {
  id: number;
  species: string;
  x: number;
  y: number;
  z: number;
  cause: DeathCause;
  /** What the player gets (empty for babies and for deaths not caused by the player). */
  drops: ItemAmount[];
}

export type HitResult =
  | { ok: true; health: number; killed: boolean }
  | { ok: false; reason: 'missing' | 'dead' | 'cooldown' };

export type FeedResult = { ok: true } | { ok: false; reason: string };

/** Result of MobManager.raycast (the same object is reused by every call). */
export interface MobRayHit {
  id: number;
  /** Distance along the ray to the animal's box. */
  distance: number;
}

/**
 * What the renderer draws for one animal, already interpolated between two ticks. The objects are reused by
 * MobManager.views(); copy what you keep.
 */
export interface MobView {
  id: number;
  spec: CreatureSpec;
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 1 for adults, MOB_BABY_SCALE for babies. */
  scale: number;
  /** Leg-swing phase (blocks walked) and how strongly the legs swing (0 still .. 1 running). */
  walk: number;
  stride: number;
  /** 0..1 head lowered (grazing). */
  head: number;
  /** 0..1 red hurt flash. */
  flash: number;
  /** 0..1 tip-over progress after death, and 0..1 fade-out once it lies on its side. */
  tip: number;
  fade: number;
  onGround: boolean;
  eager: boolean;
}

/** A saved animal. */
export interface SavedMob {
  id: number;
  species: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  baby: boolean;
  ageS: number;
  eagerS: number;
  cooldownS: number;
}

export interface MobsSnapshot {
  version: 1;
  nextId: number;
  /** Chunk columns already rolled for spawning, as flat [cx0, cz0, cx1, cz1, ...]. */
  rolled: number[];
  /** True once the spawn-area guarantee was applied. */
  guaranteed: boolean;
  /** Daytime seconds spent with too few adults near the player. */
  keepAliveS: number;
  mobs: SavedMob[];
}
