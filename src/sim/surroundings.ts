/**
 * What each machine sees around it (water, lava, open sky, touching furnaces and crates), and which machines a
 * block change can concern. Recomputed per node only when something near it changed, never per tick.
 */
import { machine } from '../core/registry';
import { CHUNK_SIZE, FACE_DIRS, WORLD_HEIGHT, type IWorld } from '../core/types';
import { isFurnace, posKey, type FurnaceEntity, type MachineEntity, type SimNode } from './entities';

/** Generators that share their output with others of their kind nearby: kind -> share radius (Chebyshev blocks). */
const SHARE_RADIUS: ReadonlyMap<string, number> = new Map(
  ['water_wheel', 'wind_turbine', 'solar_panel'].map((k) => [k, machine(k).params?.shareRadius ?? 0] as const).filter(([, r]) => r > 0),
);
/** True for a machine kind whose output is shared with others of its kind within a radius. */
export const isShared = (kind: string | null | undefined): boolean => !!kind && SHARE_RADIUS.has(kind);
/** Machines whose `furnaces` list is every furnace touching them. */
const TOUCHES_FURNACE = new Set(['thermopile', 'blower']);
/** Machines that need open sky (or, for the furnace, feel the rain): a change anywhere in the column above them concerns them. */
const SKY = new Set(['wind_turbine', 'solar_panel', 'furnace']);

const chebyshev = (n: SimNode, x: number, y: number, z: number): number =>
  Math.max(Math.abs(n.e.x - x), Math.abs(n.e.y - y), Math.abs(n.e.z - z));

/** The furnace a block of a formed hearth's shell stands for (spec 17), or null. */
export type ShellOwner = (key: string) => FurnaceEntity | null;

/**
 * Recomputes the surroundings of one node. `tickers` are every non-furnace, non-crate node (for shared generators). A
 * block of a formed hearth's shell counts as its controller: a thermopile or blower touching the shell touches the
 * furnace, a steam engine on the shell sits on it.
 */
export function surroundings(
  world: IWorld, byKey: ReadonlyMap<string, SimNode>, tickers: readonly SimNode[], n: SimNode, shellOwner: ShellOwner | null = null,
): void {
  const { x, y, z, kind } = n.e;
  n.water = 0;
  n.sideWater = 0;
  n.lava = 0;
  n.furnaces.length = 0;
  n.crates.length = 0;
  if (kind === 'crate') return;
  for (const [dx, dy, dz] of FACE_DIRS) {
    const liquid = world.getBlock(x + dx, y + dy, z + dz).liquid;
    if (liquid === 'water') {
      n.water++;
      if (dy === 0) n.sideWater++;
    } else if (liquid === 'lava') n.lava++;
    const key = posKey(x + dx, y + dy, z + dz);
    const other = byKey.get(key);
    if (other && other.e.kind === 'crate') {
      n.crates.push(other.e as MachineEntity);
      continue;
    }
    if (!TOUCHES_FURNACE.has(kind) && !((kind === 'steam_engine' || kind === 'boiler') && dy === -1)) continue;
    const furnace = other && isFurnace(other.e) ? other.e : shellOwner ? shellOwner(key) : null;
    if (furnace && !n.furnaces.includes(furnace)) n.furnaces.push(furnace);
  }
  if (SKY.has(kind)) {
    n.openSky = true;
    for (let yy = y + 1; yy < WORLD_HEIGHT && n.openSky; yy++) if (world.getBlock(x, yy, z).solid) n.openSky = false;
  }
  const radius = SHARE_RADIUS.get(kind);
  if (radius !== undefined) {
    n.wheels = 0;
    for (const o of tickers) if (o.e.kind === kind && chebyshev(o, x, y, z) <= radius) n.wheels++;
  }
}

/** Whether a block change at x,y,z can alter this node's surroundings. `shared`: the kind of shared generator that came or went, if any. */
export function concerns(n: SimNode, x: number, y: number, z: number, shared: string | null): boolean {
  const d = chebyshev(n, x, y, z);
  if (d <= 1) return true;
  if (shared !== null && n.e.kind === shared && d <= (SHARE_RADIUS.get(shared) ?? 0)) return true;
  return SKY.has(n.e.kind) && n.e.x === x && n.e.z === z && y > n.e.y;
}

/** Whether a node stands in chunk column (cx, cz) or touches it. */
export function nearChunk(n: SimNode, cx: number, cz: number): boolean {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  return n.e.x >= x0 - 1 && n.e.x <= x0 + CHUNK_SIZE && n.e.z >= z0 - 1 && n.e.z <= z0 + CHUNK_SIZE;
}
