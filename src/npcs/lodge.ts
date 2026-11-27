/**
 * The lodge and its upgrade path (docs/plans/just-you-and-orrin.md, phases 3 and 4). Gruk builds one plot as the lodge, then the
 * rooms are added one at a time until the plot is the full Hearth & Anvil (tavern.ts `layoutBlocks`).
 *
 * Pure. The final tavern is split into five groups by region (`groupOf`). Stage k is the cumulative state of groups 0..k
 * (`layoutAt`), plus the temporary rooms that stand at that stage (`roomCells`: walls, a 2-high door, a bed, a bench and a torch,
 * which the upper floor takes down again). A stage's template is the diff from the stage before: the cells it places and the air
 * it clears. Lodge plus all upgrades, applied in order, ends exactly on `layoutBlocks()` (lodge.test.ts checks it cell by cell).
 *
 * Coordinates are tavern-local, the origin at the north-west floor corner of the plot (rot 0). y = 0 is the floor.
 */
import { Facing } from '../core/types';
import { FIRE_SPOTS, layoutBlocks, TAVERN_D, TAVERN_H, TAVERN_TOP, TAVERN_W, YARD_D, type Placement } from './tavern';
import type { TownCell, TownStage, TownTemplate } from './townTemplates';

/** The stages of the path, in build order. Index 0 is the lodge; the last is the full tavern. */
export const LODGE_PATH = ['lodge', 'lodge_bar', 'lodge_kitchen', 'lodge_upper', 'lodge_tavern'] as const;
export type LodgeKey = (typeof LODGE_PATH)[number];
/** What each stage adds, for the toasts. */
export const LODGE_NAMES: readonly string[] = [
  'the lodge and its bedroom',
  'the bar counter and a second bedroom',
  'the kitchen, the pantry and a third bedroom',
  'the upper floor and its guest rooms',
  'the full Hearth & Anvil',
];

/** The plot a lodge takes: the tavern's footprint, the hall (13 x 9) and its yard (6 deep). */
export const LODGE_W = TAVERN_W;
export const LODGE_D = TAVERN_D + YARD_D;

/** The first bedroom's bed, and where the player stands to sleep in it (tavern-local). */
export const LODGE_BED: readonly [number, number, number] = [1, 1, 1];
export const LODGE_SPAWN: readonly [number, number, number] = [2, 1, 2];
/** Gruk tends the hearth from one spot in the common room (clear of the bedrooms, the bar and the tables). */
export const LODGE_ROUTINE: readonly [number, number, number] = [6, 1, 3];
/** The hearth the lodge keeps burning: the furnace in the common room (the tavern's first fire spot). */
export const LODGE_FIRES: readonly (readonly [number, number, number])[] = [FIRE_SPOTS[0]];

type Key = string;
const keyOf = (x: number, y: number, z: number): Key => `${x},${y},${z}`;

/** One block of a stage: its block key and facing ('air' clears). */
export interface LodgeBlock {
  x: number;
  y: number;
  z: number;
  block: string;
  facing: number;
}

/**
 * The group each placement of the final layout belongs to: 0 the lodge (the common room, hearth, tables, first bedroom), 1 the bar,
 * 2 the kitchen and pantry, 3 the upper floor, 4 the yard, pool, cellar, jukebox and party button.
 */
export function groupOf(p: Placement): number {
  if (p.block === 'jukebox' || p.block === 'party_button' || p.y < 0 || p.z >= TAVERN_D) return 4;
  // The upper floor: everything above the roof row, the stairwell, the balcony hole, the chimney above the hearth, the rafters.
  if (p.y > TAVERN_H) return 3;
  // The stairwell: the steps and their columns (the roof row over it is the lodge's own roof, until the balcony hole cuts it).
  if (p.block === 'plank_stairs' || (p.x === 1 && p.z >= 1 && p.z <= 5 && p.y >= 1 && (p.y < TAVERN_H || p.block !== 'plank'))) return 3;
  if (p.x === TAVERN_W - 2 && p.z === 2 && p.y >= 4) return 3;
  if (p.block === 'fence' && p.y === TAVERN_H - 1) return 3;
  if (p.block === 'air' && p.y === TAVERN_H) return 3;
  // The kitchen and pantry: the workbench and the crates of the shelves behind the bar.
  if (p.block === 'workbench' || (p.block === 'crate' && p.z === 7 && p.y <= 2 && p.x >= 3 && p.x <= TAVERN_W - 3)) return 2;
  // The bar: the counter, its stools and the two torches over it.
  if ((p.block === 'plank' && p.y === 1 && p.z === 5 && p.x >= 3 && p.x <= 9) || (p.block === 'chopping_block' && p.z === 4) || (p.block === 'torch' && p.z === 5 && p.y === 2 && (p.x === 4 || p.x === 8))) return 1;
  return 0;
}

/** The temporary cells of one room (0 lodge bedroom, 1 second bedroom, 2 third bedroom). */
function roomCells(room: number): Map<Key, LodgeBlock> {
  const m = new Map<Key, LodgeBlock>();
  const put = (x: number, y: number, z: number, block: string, facing: number = Facing.North): void => {
    m.set(keyOf(x, y, z), { x, y, z, block, facing });
  };
  // A box of planks, inclusive, from y0 to y1 (the walls run to the roof row's floor).
  const walls = (x0: number, z0: number, x1: number, z1: number, y0 = 1, y1 = TAVERN_H - 1): void => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) put(x, y, z, 'plank');
  };
  if (room === 0) {
    // Bedroom one: x 1..3, z 1..3; the east wall (x 4) has a door at z 2; the south wall is z 4.
    walls(4, 1, 4, 3);
    put(4, 1, 2, 'wooden_door', Facing.West);
    put(4, 2, 2, 'wooden_door', Facing.West);
    walls(1, 4, 3, 4);
    put(LODGE_BED[0], LODGE_BED[1], LODGE_BED[2], 'wool_bedding', Facing.East);
    put(3, 1, 3, 'plank_bench');
    put(2, TAVERN_H - 1, 2, 'torch');
  } else if (room === 1) {
    // Bedroom two: x 8..10, z 1..3; the west wall is x 7 (door at z 2, over the layout's torch at z 1); the east wall is x 11 (the hearth
    // and its chimney stay as they are); the south wall is z 4 (the bar's chopping block at x 8 is already solid).
    walls(7, 1, 7, 3);
    put(7, 1, 2, 'wooden_door', Facing.East);
    put(7, 2, 2, 'wooden_door', Facing.East);
    walls(11, 1, 11, 1);
    walls(11, 3, 11, 3);
    put(11, 4, 2, 'plank');
    walls(9, 4, 10, 4);
    walls(8, 4, 8, 4, 2, TAVERN_H - 1);
    put(10, 1, 1, 'wool_bedding', Facing.West);
    put(8, 1, 3, 'plank_bench');
    put(9, TAVERN_H - 1, 2, 'torch');
  } else if (room === 2) {
    // Bedroom three: x 1..3, z 5..7. The table (x 2) and the bar's end (x 3) and the crates behind it are taken out for the room; the
    // back door at x 1 is shut; the east wall is x 4, with a door at z 6. The bar's plank at (4, 1, 5) stays as the wall.
    for (const [x, y, z] of [[2, 1, 5], [2, 2, 5], [3, 1, 5], [3, 1, 7], [3, 2, 7]] as const) put(x, y, z, 'air');
    walls(4, 5, 4, 7);
    put(4, 1, 5, 'plank');
    put(4, 1, 6, 'wooden_door', Facing.West);
    put(4, 2, 6, 'wooden_door', Facing.West);
    walls(1, 8, 2, 8, 1, 2);
    put(LODGE_BED[0], LODGE_BED[1], 6, 'wool_bedding', Facing.East);
    put(3, 1, 6, 'plank_bench');
    put(2, TAVERN_H - 1, 6, 'torch');
  }
  return m;
}

/** The temporary cells standing at stage k: the rooms built so far; none once the upper floor is in. */
function tempAt(k: number): Map<Key, LodgeBlock> {
  const m = new Map<Key, LodgeBlock>();
  if (k >= 3) return m;
  for (let r = 0; r <= Math.min(k, 2); r++) for (const [key, c] of roomCells(r)) m.set(key, c);
  return m;
}

/** The layout after stage k: the placements of groups 0..k in list order (last write wins). */
export function layoutAt(k: number): Map<Key, LodgeBlock> {
  const m = new Map<Key, LodgeBlock>();
  for (const p of layoutBlocks()) {
    if (groupOf(p) > k) continue;
    m.set(keyOf(p.x, p.y, p.z), { x: p.x, y: p.y, z: p.z, block: p.block, facing: p.facing ?? Facing.North });
  }
  return m;
}

/** Every cell the lodge holds after stage k: the layout of groups 0..k, with the temporary rooms over it. */
export function stateAt(k: number): Map<Key, LodgeBlock> {
  const m = layoutAt(k);
  for (const [key, c] of tempAt(k)) m.set(key, c);
  return m;
}

/** What stage k places and clears: the cells of stateAt(k) that differ from stateAt(k - 1), and the cells that drop out (air). */
export function stageBlocks(k: number): LodgeBlock[] {
  const prev = k > 0 ? stateAt(k - 1) : new Map<Key, LodgeBlock>();
  const cur = stateAt(k);
  const out: LodgeBlock[] = [];
  for (const [key, c] of cur) {
    const p = prev.get(key);
    if (!p || p.block !== c.block || p.facing !== c.facing) out.push(c);
  }
  for (const [key, p] of prev) if (!cur.has(key)) out.push({ ...p, block: 'air', facing: Facing.North });
  return out.sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x);
}

const FRAME = new Set(['oak_log', 'stone_brick']);
const FINISH = new Set(['torch', 'wool_bedding', 'crate', 'plank_bench', 'dining_table', 'furnace_clay', 'workbench', 'chopping_block', 'quest_board', 'wall_clock', 'jukebox', 'party_button', 'fence', 'plank_stairs', 'water']);

/** The build stage of a lodge cell: clearing (air), frame (oak and stone only), walls, roof (from the roof row up), or finish (fixtures and furniture). */
export function stageFor(block: string, y: number): TownStage {
  if (block === 'air') return 'clearing';
  if (FRAME.has(block)) return 'frame';
  if (FINISH.has(block)) return 'finish';
  return y >= TAVERN_H ? 'roof' : 'walls';
}

/** The town template of lodge stage k: its own cells (the diff), on the plot, rot 0. */
export function lodgeTemplate(k: number): TownTemplate {
  const cells: TownCell[] = stageBlocks(k).map((c) => ({ x: c.x, y: c.y, z: c.z, block: c.block, facing: c.facing, stage: stageFor(c.block, c.y) }));
  return { key: LODGE_PATH[k], name: LODGE_NAMES[k], w: LODGE_W, d: LODGE_D, door: { x: 6, z: 0, facing: Facing.North }, cells };
}

/** The template for a lodge stage key (`LODGE_PATH`), or null. */
export function lodgeTemplateFor(key: string): TownTemplate | null {
  const k = (LODGE_PATH as readonly string[]).indexOf(key);
  return k < 0 ? null : lodgeTemplate(k);
}

/** The air the lodge needs over the plot, from the floor row to the roof, cleared before the first stage. Tavern-local. */
export function lodgeVolume(): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let y = 0; y <= TAVERN_TOP + 1; y++) for (let z = 0; z < LODGE_D; z++) for (let x = 0; x < LODGE_W; x++) out.push([x, y, z]);
  return out;
}

/** Every block kind the lodge's stages place, in a stable order (the storage bay needs stock of each). */
export function lodgeItems(): string[] {
  const out = new Set<string>();
  for (let k = 0; k < LODGE_PATH.length; k++) for (const c of stateAt(k).values()) if (c.block !== 'air') out.add(c.block);
  return [...out].sort();
}
