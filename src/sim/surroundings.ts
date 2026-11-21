/**
 * What each machine sees around it (water, lava, open sky, touching furnaces and crates), and which machines a
 * block change can concern. Recomputed per node only when something near it changed, never per tick.
 */
import { machine } from '../core/registry';
import { CHUNK_SIZE, FACE_DIRS, WORLD_HEIGHT, type IWorld } from '../core/types';
import { isFurnace, posKey, type MachineEntity, type SimNode } from './entities';

const WHEEL_RADIUS = machine('water_wheel').params?.shareRadius ?? 0;
/** Machines whose `furnaces` list is every furnace touching them. */
const TOUCHES_FURNACE = new Set(['thermopile', 'blower']);
/** Machines that need open sky: a change anywhere in the column above them concerns them. */
const SKY = new Set(['wind_turbine', 'solar_panel']);

const chebyshev = (n: SimNode, x: number, y: number, z: number): number =>
  Math.max(Math.abs(n.e.x - x), Math.abs(n.e.y - y), Math.abs(n.e.z - z));

/** Recomputes the surroundings of one node. `tickers` are every non-furnace, non-crate node (for water wheels). */
export function surroundings(world: IWorld, byKey: ReadonlyMap<string, SimNode>, tickers: readonly SimNode[], n: SimNode): void {
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
    const other = byKey.get(posKey(x + dx, y + dy, z + dz));
    if (!other) continue;
    if (other.e.kind === 'crate') n.crates.push(other.e as MachineEntity);
    else if (isFurnace(other.e) && (TOUCHES_FURNACE.has(kind) || (kind === 'steam_engine' && dy === -1))) n.furnaces.push(other.e);
  }
  if (SKY.has(kind)) {
    n.openSky = true;
    for (let yy = y + 1; yy < WORLD_HEIGHT && n.openSky; yy++) if (world.getBlock(x, yy, z).solid) n.openSky = false;
  } else if (kind === 'water_wheel') {
    n.wheels = 0;
    for (const o of tickers) if (o.e.kind === 'water_wheel' && chebyshev(o, x, y, z) <= WHEEL_RADIUS) n.wheels++;
  }
}

/** Whether a block change at x,y,z can alter this node's surroundings. `wheel`: a water wheel came or went. */
export function concerns(n: SimNode, x: number, y: number, z: number, wheel: boolean): boolean {
  const d = chebyshev(n, x, y, z);
  if (d <= 1) return true;
  if (SKY.has(n.e.kind)) return n.e.x === x && n.e.z === z && y > n.e.y;
  return wheel && n.e.kind === 'water_wheel' && d <= WHEEL_RADIUS;
}

/** Whether a node stands in chunk column (cx, cz) or touches it. */
export function nearChunk(n: SimNode, cx: number, cz: number): boolean {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  return n.e.x >= x0 - 1 && n.e.x <= x0 + CHUNK_SIZE && n.e.z >= z0 - 1 && n.e.z <= z0 + CHUNK_SIZE;
}
