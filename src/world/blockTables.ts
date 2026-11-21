/**
 * Per-block-id lookup tables for the hot loops of lighting and meshing. Every table has 1024 entries so a
 * masked voxel id can index it without a bounds check; ids without a block behave like air.
 */
import { BLOCKS, faceLayer } from '../core/registry';
import { VOXEL_ID_MASK, type BlockShape, type Face, type Facing } from '../core/types';

const SIZE = VOXEL_ID_MASK + 1;

export const SHAPE_NONE = 0;
export const SHAPE_CUBE = 1;
export const SHAPE_LIQUID = 2;
export const SHAPE_CROSS = 3;
export const SHAPE_TORCH = 4;
export const SHAPE_CABLE = 5;
export const SHAPE_SLAB = 6;
const SHAPE_CODES: Record<BlockShape, number> = {
  none: SHAPE_NONE, cube: SHAPE_CUBE, liquid: SHAPE_LIQUID, cross: SHAPE_CROSS, torch: SHAPE_TORCH, cable: SHAPE_CABLE, slab: SHAPE_SLAB,
};

export const BATCH_OPAQUE = 0;
export const BATCH_CUTOUT = 1;
export const BATCH_TRANSLUCENT = 2;

/** Light passes freely. */
export const LIGHT_CLEAR = 0;
/** Light passes but loses 2 extra levels per block (water). */
export const LIGHT_FILTER = 1;
/** Light stops here (opaque cubes, lava). */
export const LIGHT_BLOCKED = 2;

export const SHAPE = new Uint8Array(SIZE);
/** 1 for blocks that hide the faces behind them and cast ambient occlusion. */
export const OPAQUE = new Uint8Array(SIZE);
export const LIGHT_CLASS = new Uint8Array(SIZE);
/** Light emitted while inactive / active. */
export const EMIT = new Uint8Array(SIZE);
export const EMIT_ACTIVE = new Uint8Array(SIZE);
export const BATCH = new Uint8Array(SIZE);
/** 0 none, 1 water, 2 lava, 3 oil. */
export const LIQUID = new Uint8Array(SIZE);
/** 1 for blocks a cable grows an arm towards. */
export const POWERED = new Uint8Array(SIZE);
/** 1 for non-opaque blocks that hide the faces between two blocks of the same id (liquids, glass). */
export const MERGES = new Uint8Array(SIZE);

/** Bits 10-12 of a voxel (facing and active flag) select one of 8 visual states. */
export const voxelState = (v: number): number => (v >> 10) & 7;
const STATES = 8;
/** Texture layer per (id, state, face): index with `faceSlot(v) + face`. */
export const FACE_LAYER = new Uint16Array(BLOCKS.length * STATES * 6);
/** 1 where that face shows the block's glowing "active" texture while the voxel emits light. */
export const FACE_GLOW = new Uint8Array(BLOCKS.length * STATES * 6);
export const faceSlot = (v: number): number => ((v & VOXEL_ID_MASK) * STATES + voxelState(v)) * 6;

for (const def of BLOCKS) {
  const id = def.id;
  SHAPE[id] = SHAPE_CODES[def.shape];
  OPAQUE[id] = def.opaque ? 1 : 0;
  LIQUID[id] = def.liquid === 'water' ? 1 : def.liquid === 'lava' ? 2 : def.liquid === 'oil' ? 3 : 0;
  LIGHT_CLASS[id] = def.opaque || def.liquid === 'lava' ? LIGHT_BLOCKED : def.liquid ? LIGHT_FILTER : LIGHT_CLEAR;
  EMIT[id] = def.light;
  EMIT_ACTIVE[id] = def.lightActive;
  BATCH[id] = def.translucent ? BATCH_TRANSLUCENT : def.shape === 'cross' || def.shape === 'torch' ? BATCH_CUTOUT : BATCH_OPAQUE;
  POWERED[id] = def.power ? 1 : 0;
  MERGES[id] = !def.opaque && (def.shape === 'liquid' || def.shape === 'cube') ? 1 : 0;
  for (let state = 0; state < STATES; state++) {
    const facing = (state & 3) as Facing;
    const active = (state & 4) !== 0;
    for (let face = 0; face < 6; face++) {
      const slot = (id * STATES + state) * 6 + face;
      const layer = faceLayer(def, face as Face, facing, active);
      FACE_LAYER[slot] = layer;
      FACE_GLOW[slot] = active && def.lightActive > 0 && layer !== faceLayer(def, face as Face, facing, false) ? 1 : 0;
    }
  }
}
