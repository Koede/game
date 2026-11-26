/**
 * Ruin guards (spec 19.3): each Old Works ruin gets its forge wardens (and on half of the ruins a kiln sentry on a
 * wall) once, when every chunk the ruin touches has loaded, from the deterministic plan in src/world/ruinGuards.ts.
 * The set of ruins already guarded is saved, so guards are never created twice and never respawned.
 */
import { creature } from '../core/registry';
import { CHUNK_SIZE, type CreatureSpec, type IWorld } from '../core/types';
import { ruinGuardPlans, type RuinGuardPlan } from '../world/ruinGuards';
import { structureGuardPlans, type StructureGuardPlan } from '../world/structures';
import { caveLairSite, chunkHasLair, chunkHoldsCamp, lairKey, type CaveLair } from '../world/caveLair';
import { floorAt } from './hostileSpawner';
import { clearanceOf } from './terrain';

/** Chunk radius around the player checked once a second for ruins without guards (a safety net behind chunk:loaded). */
export const GUARD_SWEEP_RADIUS = 4;
/** A sentry stands on a wall at least this many blocks above the ruin floor. */
const SENTRY_MIN_WALL = 2;

/** What a guard needs to know of the place it keeps: an id, a centre and the floor (ruins and structures both fit). */
export type GuardHome = Pick<RuinGuardPlan, 'key' | 'x' | 'z' | 'floor'>;

export interface GuardHost {
  readonly world: IWorld;
  readonly seed: number;
  readonly guarded: Set<string>;
  addGuard(spec: CreatureSpec, x: number, y: number, z: number, yaw: number, role: 'guard' | 'turret', ruin: GuardHome): void;
}

/** Feet height for a body of `clearance` cells standing in column (x, z) at or just above `from`, or -1. */
function standY(world: IWorld, x: number, z: number, from: number, to: number, clearance: number): number {
  for (let y = from; y <= to; y++) if (floorAt(world, x, y, z, clearance)) return y;
  return -1;
}

function loaded(world: IWorld, p: Pick<RuinGuardPlan, 'x0' | 'z0' | 'x1' | 'z1'>): boolean {
  for (let cz = Math.floor(p.z0 / CHUNK_SIZE); cz <= Math.floor(p.z1 / CHUNK_SIZE); cz++) {
    for (let cx = Math.floor(p.x0 / CHUNK_SIZE); cx <= Math.floor(p.x1 / CHUNK_SIZE); cx++) {
      if (!world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) return false;
    }
  }
  return true;
}

/** Creates the guards of one ruin if they were never created and the whole ruin is loaded. True when it did. */
export function guardRuin(host: GuardHost, p: RuinGuardPlan): boolean {
  if (host.guarded.has(p.key) || !loaded(host.world, p)) return false;
  host.guarded.add(p.key);
  const world = host.world;
  const warden = creature('forge_warden');
  const wardenRoom = clearanceOf(warden.size.h);
  for (const c of p.wardens) {
    const y = standY(world, c.x, c.z, p.floor + 1, p.floor + 4, wardenRoom);
    if (y < 0) continue;
    const yaw = Math.atan2(-(p.x - c.x - 0.5), -(p.z - c.z - 0.5));
    host.addGuard(warden, c.x + 0.5, y, c.z + 0.5, yaw, 'guard', p);
  }
  if (p.sentry.length > 0) {
    const sentry = creature('kiln_sentry');
    const room = clearanceOf(sentry.size.h);
    for (const c of p.sentry) {
      const y = standY(world, c.x, c.z, p.floor + 1 + SENTRY_MIN_WALL, p.floor + 8, room);
      if (y < 0) continue;
      // Facing out of the ruin, the way trouble comes from.
      const yaw = Math.atan2(-(c.x + 0.5 - p.x), -(c.z + 0.5 - p.z));
      host.addGuard(sentry, c.x + 0.5, y, c.z + 0.5, yaw, 'turret', p);
      break;
    }
  }
  return true;
}

/** Creates the guardians of one generated structure once, when all of it has loaded. True when it did. */
export function guardStructure(host: GuardHost, p: StructureGuardPlan): boolean {
  if (host.guarded.has(p.key) || !loaded(host.world, p)) return false;
  host.guarded.add(p.key);
  for (const g of p.slots) {
    const spec = creature(g.species);
    const room = clearanceOf(spec.size.h);
    const y = standY(host.world, g.x, g.z, p.floor + 1 + g.up, p.floor + 1 + g.up + 6, room);
    if (y < 0) continue;
    const yaw = Math.atan2(-(p.x - g.x - 0.5), -(p.z - g.z - 0.5));
    host.addGuard(spec, g.x + 0.5, y, g.z + 0.5, g.role === 'turret' ? yaw + Math.PI : yaw, g.role, p);
  }
  return true;
}

/** Slag Colossus the lair's boss (content/automatons.ts); a natural one still roams the deep and never counts as the lair's. */
export const LAIR_BOSS = 'slag_colossus';

/** Puts the boss in one cave lair, once. True when it did. The lair is chosen from the live chunk (src/world/caveLair.ts). */
export function guardLair(host: GuardHost, p: CaveLair): boolean {
  if (host.guarded.has(p.key)) return false;
  host.guarded.add(p.key);
  const spec = creature(LAIR_BOSS);
  const y = standY(host.world, Math.floor(p.x), Math.floor(p.z), p.floor + 1, p.floor + 2, clearanceOf(spec.size.h));
  if (y < 0) return false;
  host.addGuard(spec, p.x, y, p.z, 0, 'guard', p);
  return true;
}

/** Looks for the lair of chunk (cx, cz) if it has one and was never guarded (cheap: a hash first, the scan only for lair chunks). */
const lairsTried = new WeakMap<GuardHost, Set<string>>();
export function guardLairOfChunk(host: GuardHost, cx: number, cz: number): void {
  const key = lairKey(cx, cz);
  if (!(chunkHasLair(host.seed, cx, cz) || chunkHoldsCamp(host.seed, cx, cz)) || host.guarded.has(key)) return;
  let tried = lairsTried.get(host);
  if (!tried) lairsTried.set(host, (tried = new Set()));
  if (tried.has(key) || !host.world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) return;
  tried.add(key);
  const site = caveLairSite(host.world, host.seed, cx, cz);
  if (site) guardLair(host, site);
}

/** Guards every not-yet-guarded ruin touching the chunks around (x, z) that has fully loaded. */
export function sweepRuins(host: GuardHost, x: number, z: number): void {
  const pcx = Math.floor(x / CHUNK_SIZE);
  const pcz = Math.floor(z / CHUNK_SIZE);
  for (let dz = -GUARD_SWEEP_RADIUS; dz <= GUARD_SWEEP_RADIUS; dz++) {
    for (let dx = -GUARD_SWEEP_RADIUS; dx <= GUARD_SWEEP_RADIUS; dx++) {
      const cx = pcx + dx;
      const cz = pcz + dz;
      if (!host.world.isLoaded(cx * CHUNK_SIZE, cz * CHUNK_SIZE)) continue;
      for (const p of ruinGuardPlans(host.seed, cx, cz)) guardRuin(host, p);
      for (const p of structureGuardPlans(host.seed, cx, cz)) guardStructure(host, p);
      guardLairOfChunk(host, cx, cz);
    }
  }
}
