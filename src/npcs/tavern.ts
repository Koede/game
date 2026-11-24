/**
 * The starting tavern (docs/api/npcs.md): a 13 x 9 hall of planks, logs and stone brick with a bar, shelves, a fireplace, tables,
 * windows, a door gap in the north wall and a back door onto a yard with Old Bram's lean-to. A staircase in the north-west corner
 * climbs to an upper floor (a corridor and two bedrooms, with a closet sealed by a brick patch between them); a stairwell in the
 * yard goes down to a cellar, whose false brick wall hides a vault under the yard. Built once, at the start of a NEW
 * world, around the spawn point; old worlds are not touched. `layoutBlocks` is pure (tavern-local placements): testable without a world.
 */
import { blockId } from '../core/registry';
import { Facing, makeVoxel, type IWorld } from '../core/types';

export const TAVERN_W = 13;
export const TAVERN_D = 9;
export const TAVERN_H = 5;
/** Top of the upper floor's roof (tavern-local y), and how deep the cellar floor lies below the hall floor. */
export const TAVERN_TOP = 10;
export const BASEMENT_DEPTH = 4;
/** The yard behind the hall (z from TAVERN_D to TAVERN_D + YARD_D - 1), where the hermit lives. */
export const YARD_D = 6;
/** Where the player stands when the world opens, tavern-local, facing the bar (south). */
export const TAVERN_START: readonly [number, number, number] = [6, 1, 2];
/** Hearths the tavern keeps burning: the fireplace in the hall and the hermit's cooking fire. */
export const FIRE_SPOTS: readonly (readonly [number, number, number])[] = [[11, 1, 2], [6, 1, 13]];

/**
 * The guest beds upstairs (wool pallets), tavern-local: where a paid sleep puts the player (standing on the pallet, the room's own
 * bedroom), west bedroom first. The east bedroom opens with Rosa's first room upgrade.
 */
export const GUEST_BEDS: readonly (readonly [number, number, number])[] = [[1.5, 6.5, 6.5], [11.5, 6.5, 6.5]];

export interface Placement {
  x: number;
  y: number;
  z: number;
  block: string;
  facing?: Facing;
}

export function layoutBlocks(): Placement[] {
  const out: Placement[] = [];
  const put = (x: number, y: number, z: number, block: string, facing?: Facing): void => {
    out.push({ x, y, z, block, facing });
  };
  const W = TAVERN_W - 1;
  const D = TAVERN_D - 1;
  for (let x = 0; x <= W; x++) {
    for (let z = 0; z <= D; z++) {
      const edge = x === 0 || x === W || z === 0 || z === D;
      put(x, 0, z, edge ? 'stone_brick' : 'plank');
      if (edge) {
        // A stone footing, oak logs at the corners and under the roof, planks between.
        const corner = (x === 0 || x === W) && (z === 0 || z === D);
        for (let y = 1; y < TAVERN_H; y++) {
          const beam = y === TAVERN_H - 1;
          put(x, y, z, corner || beam ? 'oak_log' : y === 1 ? 'stone_brick' : 'plank');
        }
      }
      put(x, TAVERN_H, z, 'plank'); // the roof
    }
  }
  // The front door gap (two high), a back door to the yard, and windows of glass.
  put(6, 1, 0, 'air');
  put(6, 2, 0, 'air');
  put(1, 1, D, 'air');
  put(1, 2, D, 'air');
  for (const [x, z] of [[0, 3], [0, 5], [W, 5], [4, D], [9, D], [6, D]] as const) {
    put(x, 2, z, 'glass');
    put(x, 3, z, 'glass');
  }
  // The quest board and the wall clock are set into the north wall, faces to the room (out of the way of the doors and paths).
  put(3, 2, 0, 'quest_board', Facing.South);
  put(5, 3, 0, 'wall_clock', Facing.South);
  put(8, 1, 1, 'jukebox', Facing.South);
  // The bar: a counter of planks across the room with stools (chopping blocks) on the customers' side.
  for (let x = 3; x <= 9; x++) put(x, 1, 5, 'plank');
  for (const x of [4, 6, 8]) put(x, 1, 4, 'chopping_block');
  // Shelves of crates behind it, and torches on the counter.
  for (let x = 3; x <= 9; x++) {
    put(x, 1, 7, 'crate');
    if (x % 2 === 1) put(x, 2, 7, 'crate');
  }
  put(4, 2, 5, 'torch');
  put(8, 2, 5, 'torch');
  // The fireplace by the east wall with a brick chimney, and the artificer's workbench in the back corner.
  put(W - 1, 1, 2, 'furnace_clay', Facing.West);
  put(W - 1, 2, 2, 'brick');
  put(W - 1, 3, 2, 'brick');
  put(W - 1, 1, 7, 'workbench');
  put(W - 2, 1, 7, 'crate');
  // Tables: planks on a log, one in the witch's corner and one in the smith's.
  for (const [x, z] of [[10, 5], [2, 5]] as const) {
    put(x, 1, z, 'oak_log');
    put(x, 2, z, 'plank');
  }
  // Torches by the door so the way in is lit at night.
  put(5, 2, 1, 'torch');
  put(7, 2, 1, 'torch');

  // ---- the yard and Old Bram's lean-to --------------------------------------------------------------------------
  for (let x = 0; x <= W; x++) for (let z = D + 1; z < D + YARD_D; z++) put(x, 0, z, 'dirt');
  // Posts, a plank roof, a back wall, crates, a stool and a cooking fire.
  for (const [x, z] of [[3, 10], [9, 10], [3, 13], [9, 13]] as const) {
    put(x, 1, z, 'oak_log');
    put(x, 2, z, 'oak_log');
  }
  for (let x = 3; x <= 9; x++) {
    // The front row is a slanted roof block, sloping down to the front like an eave; the rest are planks.
    put(x, 3, 10, 'plank_roof', Facing.North);
    for (let z = 11; z <= 13; z++) put(x, 3, z, 'plank');
    put(x, 1, 14, 'plank');
    put(x, 2, 14, 'plank');
  }
  put(4, 1, 13, 'crate');
  put(4, 2, 13, 'crate');
  put(8, 1, 13, 'crate');
  put(8, 2, 13, 'torch');
  put(6, 1, 13, 'furnace_clay', Facing.North);
  put(5, 1, 11, 'chopping_block');
  put(9, 1, 11, 'crate');

  upstairs(put, W, D);
  cellar(put, W, D);
  return out;
}

type Put = (x: number, y: number, z: number, block: string, facing?: Facing) => void;

function box(put: Put, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, block: string): void {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) put(x, y, z, block);
}

/** The staircase, the upper walls and roof, a balcony over the hall, two bedrooms and the sealed closet between them. */
function upstairs(put: Put, W: number, D: number): void {
  // A staircase up the west wall, rising north over five cells (z 5 -> 1): each is a stair block on a column of planks, so
  // the climb is two half-steps per cell and the top tread is level with the upper floor.
  for (let i = 0; i < 5; i++) {
    const z = 5 - i;
    if (i > 0) box(put, 1, 1, z, 1, i, z, 'plank');
    put(1, i + 1, z, 'plank_stairs', Facing.South);
  }
  // Walls (corner logs, a log beam under the roof) and the new roof.
  for (let x = 0; x <= W; x++) {
    for (let z = 0; z <= D; z++) {
      put(x, TAVERN_TOP, z, 'plank');
      if (!(x === 0 || x === W || z === 0 || z === D)) continue;
      const corner = (x === 0 || x === W) && (z === 0 || z === D);
      for (let y = TAVERN_H + 1; y < TAVERN_TOP; y++) put(x, y, z, corner || y === TAVERN_TOP - 1 ? 'oak_log' : 'plank');
    }
  }
  for (const [x, z] of [[3, 0], [9, 0], [0, 5], [W, 5], [3, D], [9, D]] as const) {
    put(x, 7, z, 'glass');
    put(x, 8, z, 'glass');
  }
  // The chimney carries on up through the corridor's east end.
  for (let y = 4; y < TAVERN_TOP; y++) put(W - 1, y, 2, 'brick');
  // The balcony: the hall ceiling is open over x 4-10, z 1-2 (the front of the room: door, dance floor, the bar beyond). It is
  // fenced by a railing on the ledge at z 3 and at x 3; the walkway is the row z 4, with the stairs arriving at the west end.
  box(put, 4, TAVERN_H, 1, W - 2, TAVERN_H, 2, 'air');
  for (let x = 3; x <= W - 2; x++) put(x, 6, 3, 'fence');
  put(3, 6, 1, 'fence');
  put(3, 6, 2, 'fence');
  // A wall splits the walkway from the two bedrooms (z 6-7); doors at x 3 and 9. Another splits the two rooms.
  box(put, 1, 6, 5, W - 1, 9, 5, 'plank');
  for (const x of [3, 9]) box(put, x, 6, 5, x, 7, 5, 'air');
  box(put, 5, 6, 6, 7, 9, 7, 'plank');
  // The hole in the floor over the upper part of the stair (z 2-4), so there is head room to climb it.
  box(put, 1, TAVERN_H, 2, 1, TAVERN_H, 4, 'air');
  // Bedroom west: two pallets along the wall, a chest and a nightstand with a torch on each; bedroom east the same.
  for (const z of [6, 7]) {
    put(1, 6, z, 'wool_bedding');
    put(W - 1, 6, z, 'wool_bedding');
  }
  for (const [x, z] of [[2, 7], [4, 7], [10, 7], [8, 7]] as const) {
    put(x, 6, z, 'crate');
    put(x, 7, z, 'torch');
  }
  // Lanterns (torches) hanging over the balcony and by the stairs.
  for (const x of [5, 8]) put(x, 8, 2, 'torch');
  put(2, 7, 1, 'torch');
  // The closet in the thick wall between the bedrooms (1 x 2 x 2), sealed by a patch of brick that does not match.
  box(put, 6, 6, 6, 6, 7, 7, 'air');
  put(6, 6, 5, 'brick');
  put(6, 7, 5, 'brick');
  put(6, 6, 7, 'crate');
  put(6, 7, 6, 'torch');
  rafters(put, W);
}

/** Fence rafters: beams across the upper floor just under the roof (they tie into the log walls and the roof boards), and across
 * the hall below the upper floor, clear of the stairs. */
function rafters(put: Put, W: number): void {
  for (const z of [2, 4, 7]) {
    for (let x = 1; x <= W - 1; x++) {
      if (z === 7 && x >= 5 && x <= 7) continue; // the thick wall is there already
      if (z === 2 && x === W - 1) continue; // the chimney
      put(x, TAVERN_TOP - 1, z, 'fence');
    }
  }
  for (const z of [3, 6]) for (let x = z === 3 ? 3 : 1; x <= W - 1; x++) put(x, TAVERN_H - 1, z, 'fence');
}

/** The cellar under the hall, the stairwell down from the yard, and a vault behind a false wall. */
function cellar(put: Put, W: number, D: number): void {
  const floor = -BASEMENT_DEPTH;
  box(put, 0, floor, 0, W, floor, D, 'stone_brick');
  for (let x = 0; x <= W; x++) for (let z = 0; z <= D; z++) {
    const edge = x === 0 || x === W || z === 0 || z === D;
    box(put, x, floor + 1, z, x, -1, z, edge ? 'stone_brick' : 'air');
  }
  // Two pillars, a row of casks (crates), a bench and torches.
  for (const x of [4, 8]) box(put, x, floor + 1, 4, x, -1, 4, 'oak_log');
  for (const x of [2, 3, 4]) put(x, floor + 1, 1, 'crate');
  put(3, floor + 2, 1, 'crate');
  put(W - 2, floor + 1, 2, 'workbench');
  for (const [x, z] of [[2, 2], [10, 2], [2, 6], [10, 6]] as const) put(x, -2, z, 'torch');
  // The stairwell in the yard: four steps down along x = 11, then in through the doorway in the cellar's south wall.
  for (const [z, k] of [[12, 1], [11, 2], [10, 3], [9, 4]] as const) {
    box(put, W - 1, 1 - k, z, W - 1, 2, z, 'air');
    put(W - 1, -k, z, 'stone_brick');
  }
  put(W - 1, floor + 1, D, 'air');
  put(W - 1, floor + 2, D, 'air');
  put(W - 2, 1, 11, 'torch');
  put(W, 1, 11, 'torch');
  // The vault under the yard, behind two blocks of brick in the cellar's south wall.
  box(put, 3, floor, 9, 9, floor, 12, 'stone_brick');
  box(put, 3, floor + 1, 9, 3, -1, 12, 'stone_brick');
  box(put, 9, floor + 1, 9, 9, -1, 12, 'stone_brick');
  box(put, 4, floor + 1, 12, 8, -1, 12, 'stone_brick');
  box(put, 4, floor + 1, 9, 8, -1, 11, 'air');
  put(6, floor + 1, D, 'brick');
  put(6, floor + 2, D, 'brick');
  for (const x of [4, 5, 8]) put(x, floor + 1, 11, 'crate');
  put(6, floor + 1, 10, 'oak_log');
  put(6, floor + 2, 10, 'plank');
  put(4, -2, 9, 'torch');
  put(8, -2, 9, 'torch');
}

/** Flattens the ground under the tavern and yard, clears the air above it, and places every block. Returns false when the area is not loaded. */
export function buildTavern(world: IWorld, ox: number, oy: number, oz: number): boolean {
  if (!world.isLoaded(ox - 1, oz - 1) || !world.isLoaded(ox + TAVERN_W, oz + TAVERN_D + YARD_D + 1)) return false;
  const air = makeVoxel(blockId('air'));
  const dirt = makeVoxel(blockId('dirt'));
  // Foundation and clearing, a margin of one block all round.
  for (let x = -1; x <= TAVERN_W; x++) {
    for (let z = -1; z <= TAVERN_D + YARD_D; z++) {
      for (let y = oy - BASEMENT_DEPTH - 2; y < oy; y++) {
        if (world.getVoxel(ox + x, y, oz + z) === air) world.setVoxel(ox + x, y, oz + z, dirt, 'sim');
      }
      for (let y = oy; y <= oy + TAVERN_TOP + 6; y++) world.setVoxel(ox + x, y, oz + z, air, 'sim');
    }
  }
  for (const p of layoutBlocks()) {
    world.setVoxel(ox + p.x, oy + p.y, oz + p.z, makeVoxel(blockId(p.block), p.facing ?? Facing.North), 'sim');
  }
  return true;
}
