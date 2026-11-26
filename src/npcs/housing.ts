/**
 * Room check for housing (docs/api/housing.md). A flood fill from a bed decides whether the air around it is a bedroom:
 * enclosed, big enough, with a door, a light, the bed and a seat or table. Pure over IWorld; the game does not call it yet.
 */
import { voxelLight } from '../core/registry';
import { WORLD_HEIGHT, type IWorld } from '../core/types';

/** Room floors and interiors above this many cells are a hall, not a bedroom. */
export const ROOM_MAX_CELLS = 300;
/** A fill that grows past this many open cells without closing is treated as leaking outside. */
export const ROOM_SEARCH_LIMIT = 2000;
export const ROOM_MIN_FLOOR = 3;
export const ROOM_MIN_HEIGHT = 3;

/** Block keys that count as a bed (single-cell bed model, src/world/bedModel.ts). */
export const BED_KEYS: ReadonlySet<string> = new Set(['wool_bedding']);
/** Block keys that count as a seat or a table. */
export const SEAT_KEYS: ReadonlySet<string> = new Set(['dining_table', 'plank_bench']);
/**
 * Block keys that count as a door. Content has no door block yet, so this is empty and every room reads "needs a door"
 * until one is added; callers and tests can pass their own set through `RoomOptions.doors`.
 */
export const DOOR_KEYS: ReadonlySet<string> = new Set<string>();

export interface RoomOptions {
  /** Door block keys for this check. Defaults to DOOR_KEYS. */
  doors?: ReadonlySet<string>;
}

export interface RoomCheck {
  ok: boolean;
  /** Empty when ok. Reasons are short labels: 'not enclosed', 'too large', 'too small', 'too low', 'needs a bed', 'needs a door', 'needs a light', 'needs a seat or table'. */
  reasons: string[];
  /** Open (air) cells counted as the room. */
  cells: number;
}

type Cell = readonly [number, number, number];
const DIRS: readonly Cell[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const cellKey = (x: number, y: number, z: number): string => `${x},${y},${z}`;

/** True when some y layer of the cells holds a full size x size square. */
function hasSquare(cells: readonly Cell[], size: number): boolean {
  const set = new Set(cells.map(([x, y, z]) => cellKey(x, y, z)));
  for (const [x, y, z] of cells) {
    let whole = true;
    for (let i = 0; i < size && whole; i++) {
      for (let j = 0; j < size && whole; j++) whole = set.has(cellKey(x + i, y, z + j));
    }
    if (whole) return true;
  }
  return false;
}

/**
 * Checks the room around the bed at (bedX, bedY, bedZ). The fill starts at the bed and spreads through non-solid cells.
 * Solid furniture (bed, seat, table) touching the room joins the interior but stops the fill. Reaching sky, an unloaded
 * column or more than ROOM_SEARCH_LIMIT open cells means the room is not enclosed. Closing with more than ROOM_MAX_CELLS
 * open cells is a hall: 'too large'.
 */
export function checkRoom(world: IWorld, bedX: number, bedY: number, bedZ: number, opts: RoomOptions = {}): RoomCheck {
  const doors = opts.doors ?? DOOR_KEYS;
  if (!BED_KEYS.has(world.getBlock(bedX, bedY, bedZ).key)) return { ok: false, reasons: ['needs a bed'], cells: 0 };

  const seen = new Set<string>([cellKey(bedX, bedY, bedZ)]);
  const room: Cell[] = [];
  const furniture: Cell[] = [[bedX, bedY, bedZ]];
  const queue: Cell[] = [[bedX, bedY, bedZ]];

  for (let i = 0; i < queue.length; i++) {
    const [x, y, z] = queue[i];
    for (const [dx, dy, dz] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const k = cellKey(nx, ny, nz);
      if (seen.has(k)) continue;
      seen.add(k);
      if (ny >= WORLD_HEIGHT || !world.isLoaded(nx, nz)) return { ok: false, reasons: ['not enclosed'], cells: room.length };
      if (ny < 0) continue; // bedrock below the world: solid
      const def = world.getBlock(nx, ny, nz);
      if (def.solid) {
        if (BED_KEYS.has(def.key) || SEAT_KEYS.has(def.key)) furniture.push([nx, ny, nz]);
        continue;
      }
      room.push([nx, ny, nz]);
      queue.push([nx, ny, nz]);
      if (room.length > ROOM_SEARCH_LIMIT) return { ok: false, reasons: ['not enclosed'], cells: room.length };
    }
  }

  if (room.length > ROOM_MAX_CELLS) return { ok: false, reasons: ['too large'], cells: room.length };

  const reasons: string[] = [];
  const interior: Cell[] = [...room, ...furniture];
  if (!hasSquare(interior, ROOM_MIN_FLOOR)) reasons.push('too small');
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of room) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  if (maxY - minY + 1 < ROOM_MIN_HEIGHT) reasons.push('too low');

  // Door, light, seat or table: inside the room or in the block bordering it.
  let hasDoor = false;
  let hasLight = false;
  let hasSeat = false;
  for (const [x, y, z] of interior) {
    for (const [cx, cy, cz] of [[x, y, z], ...DIRS.map(([dx, dy, dz]): Cell => [x + dx, y + dy, z + dz])] as Cell[]) {
      if (cy < 0 || cy >= WORLD_HEIGHT) continue;
      const voxel = world.getVoxel(cx, cy, cz);
      const key = world.getBlock(cx, cy, cz).key;
      if (doors.has(key)) hasDoor = true;
      if (SEAT_KEYS.has(key)) hasSeat = true;
      if (voxelLight(voxel) > 0) hasLight = true;
    }
  }
  if (!hasDoor) reasons.push('needs a door');
  if (!hasLight) reasons.push('needs a light');
  if (!hasSeat) reasons.push('needs a seat or table');

  return { ok: reasons.length === 0, reasons, cells: room.length };
}
