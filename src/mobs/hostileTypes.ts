/**
 * Shapes of the Emberbound's behaviour (spec 19.2-19.3): the per-automaton state the hostile brain keeps on a Mob,
 * the hooks the game injects (safe zones, damage to the player, knockback, the sky), projectiles and snapshots.
 */
import type { SkyFacts } from '../core/hostile';
import type { DamageCause } from '../core/gameEvents';
import type { HostileAttack, ProjectileKind } from '../core/types';

/**
 * Where automatons never go and never spawn (spec 19.2 / 19.4): the warm zone of a furnace at or above
 * HOSTILE_WARM_ZONE_MIN_C and the radius of a powered ward beacon. Provided by the simulation (src/sim); it must be
 * cheap (it is asked a few times per automaton per tick). x, y, z are world block coordinates (fractions allowed).
 */
export interface SafeZones {
  isSafe(x: number, y: number, z: number): boolean;
}

/**
 * Hurts the player: `amount` is after the difficulty multiplier (HOSTILE_DAMAGE_MULT) and before armour; `cause` is
 * always 'automaton' (blows, zaps, slams, dashes and ember bolt impacts); (sourceX, sourceZ) is where it came from
 * (the automaton or the bolt) for the HUD's damage indicator; `kind` is the automaton's species key ('forge_warden')
 * for the death screen. 'player:attacked' was emitted just before with the attack kind (a 'bolt' means: start the
 * species' `hostile.burn`).
 */
export type DamagePlayer = (amount: number, cause: DamageCause, sourceX: number, sourceZ: number, kind: string) => void;

/** Throws the player: adds this velocity (blocks per second) to theirs. */
export type KnockPlayer = (vx: number, vy: number, vz: number) => void;

/** What the game plugs into the automatons (MobManager.useHostileHooks). Every hook is optional. */
export interface HostileHooks {
  /** Default: nowhere is safe. */
  safeZones?: SafeZones | null;
  /** Default: nothing happens to the player (only the events are emitted). */
  damagePlayer?: DamagePlayer | null;
  knockPlayer?: KnockPlayer | null;
  /** Storm and moon for the drones' habitat (spec 19.1). Default: a clear sky at full moon (no drones). */
  sky?: (() => SkyFacts) | null;
}

/**
 * What an automaton is doing:
 *  dormant - wound down (daylight under open sky): still, dark, takes damage, wakes when hit or when night falls
 *  roam    - awake without a target (or after giving up): idles and wanders, guards around their ruin
 *  chase   - steering at the player (or where they were last sensed)
 *  windup  - telegraphing an attack (standing still; the attack is judged when it ends)
 *  dash    - the bellows hound's charge after its wind-up
 *  return  - a ruin guard walking back inside its leash
 *  retreat - inside a safe zone (a furnace was lit or a beacon powered around it): walking out, never attacking
 */
export type HostileMode = 'dormant' | 'roam' | 'chase' | 'windup' | 'dash' | 'return' | 'retreat';

/** 'natural' (night spawner, despawns), 'guard' (forge warden of a ruin), 'turret' (kiln sentry of a ruin). */
export type HostileRole = 'natural' | 'guard' | 'turret';

/** The behaviour state of one automaton (Mob.hostile). Owned by the hostile layer; read it, never write it. */
export interface HostileState {
  role: HostileRole;
  mode: HostileMode;
  /** Ruin centre for guards and turrets (feet height of the ruin floor + 1); the spawn spot for natural ones. */
  homeX: number;
  homeY: number;
  homeZ: number;
  /** Key of the ruin a guard or turret belongs to ('' for natural automatons). */
  ruin: string;
  /** Knows where the player is (noticed them, or was hit). */
  aware: boolean;
  /** Seconds since the player was last sensed (forgets after HOSTILE_FORGET_S). */
  unseenS: number;
  /** Where the player was last sensed (feet). */
  lastX: number;
  lastY: number;
  lastZ: number;
  /** Seconds to the next look at the player (senses run at 4 Hz, staggered). */
  senseS: number;
  /** Line of sight to the player at the last look. */
  sees: boolean;
  /** Open sky above it at the last look (daylight wind-down applies only then). */
  skyOpen: boolean;
  /** Seconds since the last wind-up began (the attack period: next wind-up once >= cooldownS). */
  periodS: number;
  /** Seconds into the current wind-up; whether its sound has started. */
  windS: number;
  windSfx: boolean;
  /** The dash: unit direction and blocks left to run; whether it has already hit. */
  dashX: number;
  dashZ: number;
  dashLeft: number;
  dashHit: boolean;
  /** Seconds steering without getting anywhere (gives up at HOSTILE_GIVE_UP_S), and seconds of roaming left after. */
  blockedS: number;
  roamS: number;
  /** Seconds stunned (arc maul): no moving, no attacking. */
  stunS: number;
  /** Progress of the daylight wind-down (0..HOSTILE_WIND_DOWN_S). */
  windDownS: number;
  /** Ember glow 0 (dark) .. 1, eased; and its value at the start of the last tick. */
  glow: number;
  pglow: number;
  /** Seconds it stays awake in daylight after being hit (does not wind down while > 0). */
  provokedS: number;
  /** Flyers: blocks above the ground they hold (HOSTILE_HOVER_MIN..MAX). */
  hover: number;
  /** Blocks walked since the last footstep sound. */
  stepAcc: number;
}

/** An ember bolt in flight. */
export interface Projectile {
  id: number;
  kind: ProjectileKind;
  /** Species and mob id of the launcher. */
  species: string;
  from: number;
  x: number;
  y: number;
  z: number;
  /** Position at the start of the last tick (for interpolation). */
  px: number;
  py: number;
  pz: number;
  vx: number;
  vy: number;
  vz: number;
  ageS: number;
  /** Damage on a hit (after difficulty, before armour). */
  damage: number;
  /** The attack that launched it (always 'bolt' today). */
  attack: HostileAttack;
}

/** A projectile for the renderer, interpolated between ticks (reused objects). */
export interface ProjectileView {
  id: number;
  kind: ProjectileKind;
  x: number;
  y: number;
  z: number;
  /** Velocity (blocks per second): the direction its trail streams from. */
  vx: number;
  vy: number;
  vz: number;
  /** Seconds in flight. */
  ageS: number;
}

/** A saved automaton (its id shares the animals' id space). */
export interface SavedHostile {
  id: number;
  species: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  health: number;
  role: HostileRole;
  home: [number, number, number];
  ruin: string;
  dormant: boolean;
  hover: number;
}

/** The automatons' part of MobsSnapshot (absent in saves made before spec 19's behaviour). */
export interface HostilesSnapshot {
  /** Keys of the ruins whose guards were already created (never again). */
  guarded: string[];
  /** Seconds to the next spawn try. */
  spawnS: number;
  mobs: SavedHostile[];
}

/** Extras of a player's hit (MobManager.hit): the weapon's numbers. */
export interface HitOptions {
  /** Seconds before this creature can be hit again (default MOB_HIT_COOLDOWN_S; weapons WEAPON_HIT_COOLDOWN_S). */
  cooldownS?: number;
  /** Stuns an automaton for this long: no moving, no attacking, a wind-up is broken off (the arc maul's weapon.stunS). */
  stunS?: number;
}
