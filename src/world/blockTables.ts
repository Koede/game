/**
 * Per-block-id lookup tables for the hot loops of lighting and meshing. Every table has 1024 entries so a
 * masked voxel id can index it without a bounds check; ids without a block behave like air.
 */
import { CUP_STAGES, cupStageOfBlock, KETTLE_BLOCK } from '../core/brewing';
import { BLOCKS, blockOrNull, faceLayer, isFluidEndpoint, isItemEndpoint } from '../core/registry';
import { VOXEL_ID_MASK, type BlockShape, type Face, type Facing } from '../core/types';
import { isStationShape, stationIndex } from './stationShapes';

const SIZE = VOXEL_ID_MASK + 1;

export const SHAPE_NONE = 0;
export const SHAPE_CUBE = 1;
export const SHAPE_LIQUID = 2;
export const SHAPE_CROSS = 3;
export const SHAPE_TORCH = 4;
export const SHAPE_CABLE = 5;
export const SHAPE_SLAB = 6;
export const SHAPE_PIPE = 7;
export const SHAPE_CUP = 8;
export const SHAPE_BUCKET = 9;
export const SHAPE_FENCE = 10;
const SHAPE_CODES: Record<BlockShape, number> = {
  none: SHAPE_NONE, cube: SHAPE_CUBE, liquid: SHAPE_LIQUID, cross: SHAPE_CROSS, torch: SHAPE_TORCH, cable: SHAPE_CABLE, slab: SHAPE_SLAB,
  pipe: SHAPE_PIPE,
  cup: SHAPE_CUP, bucket: SHAPE_BUCKET, fence: SHAPE_FENCE,
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
/** Transport families (spec 16), as bits: PIPE_ITEM, PIPE_FLUID. */
export const PIPE_ITEM = 1;
export const PIPE_FLUID = 2;
/** The family of a pipe block (0 for anything else). */
export const PIPE_FAMILY = new Uint8Array(SIZE);
/**
 * The families a block joins: a pipe its own; an endpoint every family it takes or gives. A pipe of family f grows
 * an arm towards a neighbour n exactly when PIPE_JOINS[n] & f (registry.pipeJoins, precomputed).
 */
export const PIPE_JOINS = new Uint8Array(SIZE);
/** 1 for pipe endpoints (not pipes): an arm meeting one gets a collar. */
export const PIPE_ENDPOINT = new Uint8Array(SIZE);
/** 1 for blocks a fence grows an arm towards: other fences and every opaque cube. */
export const FENCE_JOINS = new Uint8Array(SIZE);
/** Colour of the light a block emits: 0 warm firelight, 1 cyan, 2 violet (cool glows of caves, spec 14). */
export const LIGHT_HUE = new Uint8Array(SIZE);
export const HUE_CYAN = 1;
export const HUE_VIOLET = 2;
const COOL_EMITTERS: Readonly<Record<string, number>> = { glowcap: HUE_CYAN, crystal_cluster: HUE_VIOLET };
/** 1 for plants that glow (cross blocks emitting light): drawn full-bright. */
export const GLOWS = new Uint8Array(SIZE);

/** For hand stations (stationShapes.ts): 1 + the index of the block's key in STATION_BOXES, 0 for every other block. They are cubes in the content and boxes in the mesh. */
export const STATION = new Uint8Array(SIZE);

/** For cup blocks: 1 + the index of the stage in CUP_STAGES (0 for every other block). Chooses the parts of the cup mesh. */
export const CUP_STAGE = new Uint8Array(SIZE);
/** For bucket blocks: BUCKET_COLD (a bucket of water), BUCKET_BOILING (it boils: shimmering top) or BUCKET_KETTLE. */
export const BUCKET_KIND = new Uint8Array(SIZE);
export const BUCKET_COLD = 0;
export const BUCKET_BOILING = 1;
export const BUCKET_KETTLE = 2;

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
  // Item pipes are see-through tubes (glass panes in their tile): the blended batch draws back faces first.
  const glassPipe = def.pipe?.family === 'item';
  BATCH[id] = def.translucent || glassPipe ? BATCH_TRANSLUCENT : def.shape === 'cross' || def.shape === 'torch' || def.shape === 'cup' || def.shape === 'bucket' ? BATCH_CUTOUT : BATCH_OPAQUE;
  POWERED[id] = def.power ? 1 : 0;
  FENCE_JOINS[id] = def.shape === 'fence' || def.opaque ? 1 : 0;
  MERGES[id] = !def.opaque && (def.shape === 'liquid' || def.shape === 'cube') ? 1 : 0;
  if (def.pipe) PIPE_FAMILY[id] = PIPE_JOINS[id] = def.pipe.family === 'item' ? PIPE_ITEM : PIPE_FLUID;
  else {
    PIPE_JOINS[id] = (isItemEndpoint(def) ? PIPE_ITEM : 0) | (isFluidEndpoint(def) ? PIPE_FLUID : 0);
    PIPE_ENDPOINT[id] = PIPE_JOINS[id] !== 0 ? 1 : 0;
  }
  GLOWS[id] = def.shape === 'cross' && def.light > 0 ? 1 : 0;
  if ((def.shape === 'cube' || def.shape === 'slab') && isStationShape(def.key)) {
    // Not a full cell: it hides no neighbour's face, casts no shadow and does not merge with its own kind.
    STATION[id] = stationIndex(def.key);
    OPAQUE[id] = 0;
    MERGES[id] = 0;
    LIGHT_CLASS[id] = LIGHT_CLEAR;
  }
  if (def.shape === 'cup') CUP_STAGE[id] = 1 + CUP_STAGES.indexOf(cupStageOfBlock(def.key) ?? 'cup');
  if (def.shape === 'bucket') BUCKET_KIND[id] = def.key === KETTLE_BLOCK ? BUCKET_KETTLE : def.key.endsWith('_boiling') ? BUCKET_BOILING : BUCKET_COLD;
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
for (const [key, hue] of Object.entries(COOL_EMITTERS)) {
  const def = blockOrNull(key);
  if (def) LIGHT_HUE[def.id] = hue;
}
