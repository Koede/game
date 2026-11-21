/**
 * Night and dark spawning near the player (spec 19.3): one try every HOSTILE_SPAWN_INTERVAL_S while fewer than the
 * difficulty's cap are loaded - a spot 24-40 blocks away on a solid floor, block light below HOSTILE_SPAWN_LIGHT,
 * never under open sky by day, never in a safe zone (warm furnace, powered ward beacon), never in view of the
 * camera; the type picked by place and weight (spawnPlacesAt + pickAutomaton), then a group from CreatureSpec.group.
 */
import {
  HOSTILE_HOVER_MIN,
  HOSTILE_SPAWN_LIGHT,
  HOSTILE_SPAWN_MAX_DISTANCE,
  HOSTILE_SPAWN_MIN_DISTANCE,
  PLAYER_EYE,
} from '../core/constants';
import { pickAutomaton, spawnPlacesAt, type SkyFacts } from '../core/hostile';
import { blockOf } from '../core/registry';
import { WORLD_HEIGHT, type CreatureSpec, type IWorld } from '../core/types';
import type { SafeTest } from './hostileMove';
import { blockLightAt, lineClear, skyOpenAt } from './sight';
import { clearanceOf, hazardAt, solidHeight } from './terrain';
import type { BiomeLookup, MobPlayer } from './types';

/** Half-angle of the camera's view cone: a spot inside it with a clear line from the eye is "in view". */
export const SPAWN_VIEW_HALF_ANGLE = (75 * Math.PI) / 180;
/** Candidate floors are looked for this far above and below the player's feet. */
const FLOOR_SPAN = 24;
/** Group members stand within this many blocks of the first one. */
const GROUP_SPREAD = 2;

export interface HostileSpawnHost {
  readonly world: IWorld;
  readonly rng: () => number;
  readonly biomeAt: BiomeLookup;
  safe: SafeTest;
  /** How many automatons of a type are loaded now. */
  loadedOf(key: string): number;
  add(spec: CreatureSpec, x: number, y: number, z: number, yaw: number): void;
}

/** What the clock and sky say for this try. */
export interface SpawnSky {
  night: boolean;
  sky: SkyFacts;
}

/** A cell an automaton's body can occupy: loaded, not solid, not liquid. */
function open(world: IWorld, x: number, y: number, z: number): boolean {
  if (y >= WORLD_HEIGHT) return true;
  if (y < 0 || !world.isLoaded(x, z)) return false;
  const def = blockOf(world.getVoxel(x, y, z));
  return !def.solid && def.liquid === null;
}

/** Feet cell y stands on a solid floor (not a hazard) with `clearance` open cells. */
export function floorAt(world: IWorld, x: number, y: number, z: number, clearance: number): boolean {
  if (y < 1 || y + clearance > WORLD_HEIGHT) return false;
  if (solidHeight(world, x, y - 1, z) < 1 || hazardAt(world, x, y - 1, z)) return false;
  for (let c = y; c < y + clearance; c++) if (!open(world, x, c, z) || hazardAt(world, x, c, z)) return false;
  return true;
}

/** Is the spot in the player's view: inside the view cone with a clear line from the eye. */
export function inView(world: IWorld, player: MobPlayer, x: number, y: number, z: number): boolean {
  const dx = x - player.x;
  const dz = z - player.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return true;
  const cos = (dx * -Math.sin(player.yaw) + dz * -Math.cos(player.yaw)) / d;
  if (cos < Math.cos(SPAWN_VIEW_HALF_ANGLE)) return false;
  const ey = player.y + PLAYER_EYE;
  return lineClear(world, player.x, ey, player.z, x, y + 1, z, 'sight') || lineClear(world, player.x, ey, player.z, x, y + 0.2, z, 'sight');
}

const floors: number[] = [];

/** The spawn rules for one spot (dark, not sunlit by day, not safe, not in view, floor and headroom). */
function spotOk(host: HostileSpawnHost, player: MobPlayer, s: SpawnSky, x: number, y: number, z: number, clearance: number): { skyOpen: boolean } | null {
  const world = host.world;
  if (!floorAt(world, x, y, z, clearance)) return null;
  const skyOpen = skyOpenAt(world, x, y, z);
  if (skyOpen && !s.night) return null;
  if (blockLightAt(world, x, y, z, HOSTILE_SPAWN_LIGHT) >= HOSTILE_SPAWN_LIGHT) return null;
  if (host.safe(x + 0.5, y + 0.5, z + 0.5)) return null;
  if (inView(world, player, x + 0.5, y, z + 0.5)) return null;
  return { skyOpen };
}

/**
 * One spawn try. `room` is how many more hostiles may be loaded. Returns how many automatons were added (0 when the
 * spot or the type did not work out).
 */
export function trySpawn(host: HostileSpawnHost, player: MobPlayer, s: SpawnSky, room: number): number {
  if (room <= 0) return 0;
  const world = host.world;
  const rng = host.rng;
  const a = rng() * Math.PI * 2;
  const r = HOSTILE_SPAWN_MIN_DISTANCE + rng() * (HOSTILE_SPAWN_MAX_DISTANCE - HOSTILE_SPAWN_MIN_DISTANCE);
  const x = Math.floor(player.x + Math.cos(a) * r);
  const z = Math.floor(player.z + Math.sin(a) * r);
  if (!world.isLoaded(x, z)) return 0;
  // Every floor of the column near the player's height: surface, overhangs and cave floors alike.
  floors.length = 0;
  const top = Math.min(WORLD_HEIGHT - 2, Math.floor(player.y) + FLOOR_SPAN);
  for (let y = Math.max(1, Math.floor(player.y) - FLOOR_SPAN); y <= top; y++) if (floorAt(world, x, y, z, 2)) floors.push(y);
  if (floors.length === 0) return 0;
  const y = floors[Math.floor(rng() * floors.length)];
  const first = spotOk(host, player, s, x, y, z, 2);
  if (!first) return 0;
  const places = spawnPlacesAt({ skyOpen: first.skyOpen, y, night: s.night, biome: host.biomeAt(x, z) });
  const spec = pickAutomaton(places, s.sky, (key) => host.loadedOf(key), rng);
  if (!spec) return 0;
  const clearance = clearanceOf(spec.size.h);
  if (!floorAt(world, x, y, z, clearance)) return 0;
  const count = Math.min(room, spec.group[0] + Math.floor(rng() * (spec.group[1] - spec.group[0] + 1)));
  const lift = spec.hostile?.flying ? HOSTILE_HOVER_MIN : 0;
  host.add(spec, x + 0.5, y + lift, z + 0.5, rng() * Math.PI * 2);
  let added = 1;
  for (let attempt = 0; attempt < 10 && added < count; attempt++) {
    const mx = x + Math.floor(rng() * (GROUP_SPREAD * 2 + 1)) - GROUP_SPREAD;
    const mz = z + Math.floor(rng() * (GROUP_SPREAD * 2 + 1)) - GROUP_SPREAD;
    if (mx === x && mz === z) continue;
    for (let my = y - 1; my <= y + 1; my++) {
      if (!spotOk(host, player, s, mx, my, mz, clearance)) continue;
      host.add(spec, mx + 0.5, my + lift, mz + 0.5, rng() * Math.PI * 2);
      added++;
      break;
    }
  }
  return added;
}
