/**
 * Decides when groups appear (spec 12.5): the first-load roll of every chunk column (from 'chunk:loaded' plus a
 * once-a-second sweep around the player, so chunks loaded before the manager existed are rolled too), the
 * guarantee near world spawn, and daytime keep-alive spawns out of the player's sight. The set of rolled columns
 * and the keep-alive timer are saved by the manager.
 */
import {
  MOB_KEEPALIVE_AFTER_S,
  MOB_KEEPALIVE_MIN_ADULTS,
  MOB_KEEPALIVE_MIN_DISTANCE,
  MOB_KEEPALIVE_RADIUS,
  MOB_SPAWN_GUARANTEE_RADIUS,
} from '../core/constants';
import { mulberry32 } from '../core/math';
import { CREATURES } from '../core/registry';
import { CHUNK_SIZE, type CreatureSpec, type IWorld } from '../core/types';
import { findAnchor, groupSize, placeGroup, rollChunk, rollsGroup, type SpawnSpot } from './spawning';
import type { BiomeLookup, Mob, MobClock, MobPlayer } from './types';

/** Chunk radius around the player checked for unrolled loaded columns, once per second. */
export const SWEEP_RADIUS = 7;
/** Keep-alive groups appear at most this far from the player. */
export const KEEPALIVE_MAX_DISTANCE = 56;
/** Half-angle of the player's view cone keep-alive spawns avoid (radians). */
export const KEEPALIVE_VIEW_HALF_ANGLE = Math.PI / 3;
/** Sunlight at or above which it counts as daytime for keep-alive spawning. */
export const DAYTIME_SUNLIGHT = 0.5;

const SALT_GUARANTEE = 0x67756172;
const OFFSET = 0x100000;

/** One number per chunk column (|cx|, |cz| < 2^20). */
export const columnKey = (cx: number, cz: number): number => (cx + OFFSET) * 0x200000 + (cz + OFFSET);

/** What the spawner needs from the manager. */
export interface SpawnHost {
  readonly world: IWorld;
  readonly seed: number;
  readonly biomeAt: BiomeLookup;
  readonly rng: () => number;
  /** Every animal (loaded or frozen). */
  readonly all: readonly Mob[];
  /** Whether another group of `count` may be added now (loaded and stored caps). */
  room(count: number): boolean;
  add(spec: CreatureSpec, spot: SpawnSpot, baby: boolean): void;
}

export class Spawner {
  readonly rolled = new Set<number>();
  guaranteed = false;
  keepAliveS = 0;
  private readonly queue: number[] = [];
  private sweepS = 0;
  private keepAliveCheckS = 0;

  constructor(
    private readonly host: SpawnHost,
    private readonly spawn: { x: number; z: number } | null,
  ) {}

  /** A chunk column finished loading (from 'chunk:loaded'). */
  chunkLoaded(cx: number, cz: number): void {
    this.queue.push(cx, cz);
  }

  tick(dt: number, player: MobPlayer, clock: MobClock): void {
    for (let i = 0; i < this.queue.length; i += 2) this.roll(this.queue[i], this.queue[i + 1]);
    this.queue.length = 0;
    this.sweepS -= dt;
    if (this.sweepS <= 0) {
      this.sweepS = 1;
      this.sweep(player);
      if (!this.guaranteed) this.guarantee();
    }
    this.keepAliveCheckS -= dt;
    if (this.keepAliveCheckS <= 0) {
      this.keepAliveCheckS = 1;
      this.keepAlive(player, clock);
    }
  }

  /**
   * Rolls a loaded column once in its life. A column whose group does not fit under the caps right now stays
   * unrolled, so a later sweep (or its next load) places the group once there is room.
   */
  roll(cx: number, cz: number): void {
    const key = columnKey(cx, cz);
    if (this.rolled.has(key)) return;
    const world = this.host.world;
    if (!world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) return;
    if (!rollsGroup(this.host.seed, cx, cz)) {
      this.rolled.add(key);
      return;
    }
    // Cheap test first: sweeps retry waiting columns every second.
    if (!this.host.room(1)) return;
    const plan = rollChunk(world, this.host.seed, cx, cz, this.host.biomeAt);
    if (plan && !this.host.room(plan.spots.length)) return;
    this.rolled.add(key);
    if (plan) for (const s of plan.spots) this.host.add(plan.species, s, false);
  }

  private sweep(player: MobPlayer): void {
    const pcx = Math.floor(player.x / CHUNK_SIZE);
    const pcz = Math.floor(player.z / CHUNK_SIZE);
    for (let dz = -SWEEP_RADIUS; dz <= SWEEP_RADIUS; dz++) {
      for (let dx = -SWEEP_RADIUS; dx <= SWEEP_RADIUS; dx++) {
        if (!this.rolled.has(columnKey(pcx + dx, pcz + dz))) this.roll(pcx + dx, pcz + dz);
      }
    }
  }

  /**
   * Once every column within MOB_SPAWN_GUARANTEE_RADIUS of world spawn is loaded (and rolled): adds a hen group
   * and a group of another species there if the rolls left none. Deterministic for a seed.
   */
  guarantee(): void {
    if (!this.spawn) {
      this.guaranteed = true;
      return;
    }
    const { x, z } = this.spawn;
    const r = MOB_SPAWN_GUARANTEE_RADIUS;
    const c0x = Math.floor((x - r) / CHUNK_SIZE);
    const c1x = Math.floor((x + r) / CHUNK_SIZE);
    const c0z = Math.floor((z - r) / CHUNK_SIZE);
    const c1z = Math.floor((z + r) / CHUNK_SIZE);
    for (let cz = c0z; cz <= c1z; cz++) {
      for (let cx = c0x; cx <= c1x; cx++) if (!this.host.world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) return;
    }
    for (let cz = c0z; cz <= c1z; cz++) for (let cx = c0x; cx <= c1x; cx++) this.roll(cx, cz);
    this.guaranteed = true;

    let hens = 0;
    let others = 0;
    for (const m of this.host.all) {
      if ((m.x - x) ** 2 + (m.z - z) ** 2 > r * r) continue;
      if (m.spec.key === 'hen') hens++;
      else others++;
    }
    const rand = mulberry32(this.host.seed ^ SALT_GUARANTEE);
    const hen = CREATURES.filter((c) => c.key === 'hen');
    const rest = CREATURES.filter((c) => c.key !== 'hen');
    if (hens === 0) this.addGroupNear(x, z, 4, r - 4, hen, rand);
    if (others === 0) this.addGroupNear(x, z, 4, r - 4, rest, rand);
  }

  /** Spawns one group of one of `choices` around a suitable anchor; false when no spot or no room. */
  private addGroupNear(
    x: number,
    z: number,
    minR: number,
    maxR: number,
    choices: readonly CreatureSpec[],
    rand: () => number,
    blocked?: (dx: number, dz: number) => boolean,
  ): boolean {
    const anchor = findAnchor(this.host.world, x, z, minR, maxR, choices, this.host.biomeAt, rand, 160, blocked);
    if (!anchor) return false;
    const spots = placeGroup(this.host.world, anchor.spec, anchor.x, anchor.z, groupSize(anchor.spec, rand()), rand);
    if (spots.length === 0 || !this.host.room(spots.length)) return false;
    for (const s of spots) this.host.add(anchor.spec, s, false);
    return true;
  }

  /** Spec 12.5 keep-alive: too few adults near the player for 120 s of daytime -> one group out of sight. */
  private keepAlive(player: MobPlayer, clock: MobClock): void {
    if (clock.sunlight() < DAYTIME_SUNLIGHT) return;
    let adults = 0;
    const r2 = MOB_KEEPALIVE_RADIUS * MOB_KEEPALIVE_RADIUS;
    for (const m of this.host.all) {
      if (m.baby || m.state === 'dying') continue;
      if ((m.x - player.x) ** 2 + (m.z - player.z) ** 2 <= r2) adults++;
    }
    if (adults >= MOB_KEEPALIVE_MIN_ADULTS) {
      this.keepAliveS = 0;
      return;
    }
    this.keepAliveS += 1;
    if (this.keepAliveS < MOB_KEEPALIVE_AFTER_S) return;
    // The view direction for yaw: (-sin, -cos). Avoid spots inside the view cone.
    const vx = -Math.sin(player.yaw);
    const vz = -Math.cos(player.yaw);
    const cosCone = Math.cos(KEEPALIVE_VIEW_HALF_ANGLE);
    const inView = (dx: number, dz: number): boolean => (dx * vx + dz * vz) / Math.hypot(dx, dz) > cosCone;
    if (this.addGroupNear(player.x, player.z, MOB_KEEPALIVE_MIN_DISTANCE, KEEPALIVE_MAX_DISTANCE, CREATURES, this.host.rng, inView)) {
      this.keepAliveS = 0;
    }
  }
}
