/**
 * The starting tavern (docs/api/npcs.md): a 13 x 9 hall of planks, logs and stone brick with a bar, shelves, a fireplace, tables,
 * windows and a door gap in the north wall. Built once, at the start of a NEW world, around the spawn point; old worlds are not touched.
 * `layoutBlocks` is pure (a list of tavern-local placements) so it can be tested without a world.
 */
import { blockId } from '../core/registry';
import { Facing, makeVoxel, type IWorld } from '../core/types';

export const TAVERN_W = 13;
export const TAVERN_D = 9;
export const TAVERN_H = 5;
/** Where the player stands when the world opens, tavern-local, facing the bar (south). */
export const TAVERN_START: readonly [number, number, number] = [6, 1, 2];

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
  // The door gap (two high) and windows of glass.
  put(6, 1, 0, 'air');
  put(6, 2, 0, 'air');
  for (const [x, z] of [[0, 3], [0, 5], [W, 5], [3, D], [9, D], [6, D]] as const) {
    put(x, 2, z, 'glass');
    put(x, 3, z, 'glass');
  }
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
  // The fireplace by the east wall with a brick chimney, and a workbench in the back corner.
  put(W - 1, 1, 2, 'furnace_clay', Facing.West);
  put(W - 1, 2, 2, 'brick');
  put(W - 1, 3, 2, 'brick');
  put(W - 2, 2, 2, 'torch');
  put(W - 1, 1, 7, 'workbench');
  // Tables: planks on a log, one in the witch's corner and one in the smith's.
  for (const [x, z] of [[10, 5], [2, 5]] as const) {
    put(x, 1, z, 'oak_log');
    put(x, 2, z, 'plank');
  }
  // Torches by the door so the way in is lit at night.
  put(5, 2, 1, 'torch');
  put(7, 2, 1, 'torch');
  return out;
}

/** Flattens the ground under the tavern, clears the air above it, and places every block. Returns false when the area is not loaded. */
export function buildTavern(world: IWorld, ox: number, oy: number, oz: number): boolean {
  if (!world.isLoaded(ox - 1, oz - 1) || !world.isLoaded(ox + TAVERN_W, oz + TAVERN_D)) return false;
  const air = makeVoxel(blockId('air'));
  const dirt = makeVoxel(blockId('dirt'));
  // Foundation and clearing, a margin of one block round the hall.
  for (let x = -1; x <= TAVERN_W; x++) {
    for (let z = -1; z <= TAVERN_D; z++) {
      for (let y = oy - 6; y < oy; y++) {
        if (world.getVoxel(ox + x, y, oz + z) === air) world.setVoxel(ox + x, y, oz + z, dirt, 'sim');
      }
      for (let y = oy; y <= oy + TAVERN_H + 6; y++) world.setVoxel(ox + x, y, oz + z, air, 'sim');
    }
  }
  for (const p of layoutBlocks()) {
    world.setVoxel(ox + p.x, oy + p.y, oz + p.z, makeVoxel(blockId(p.block), p.facing ?? Facing.North), 'sim');
  }
  return true;
}
