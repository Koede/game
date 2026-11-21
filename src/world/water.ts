/**
 * Water states (spec 18.1) and the pure lookups the flow engine, the mesher and the physics share. A water voxel's
 * variant bits hold its LEVEL (0 = source, 1..7 flowing, 1 strongest) and its active bit means FALLING (a column of
 * water dropping down; stored with level 1, it lands as the strongest flow). Pure data, safe in workers and node.
 */
import { blockId, BLOCKS } from '../core/registry';
import { VOXEL_ID_MASK, makeVoxel, type Voxel } from '../core/types';

export const WATER_ID = blockId('water');
/** Weakest flowing level: a level-7 cell does not spread sideways any further. */
export const MAX_FLOW_LEVEL = 7;
/** Every generated lake, river and pool (and every bucketful) is a source. */
export const WATER_SOURCE: Voxel = makeVoxel(WATER_ID);
/** Water dropping down a column. */
export const WATER_FALLING: Voxel = makeVoxel(WATER_ID, 0, true, 1);

/** Flowing water of `level` 1..7. */
export const flowingWater = (level: number): Voxel => makeVoxel(WATER_ID, 0, false, level);

export const isWater = (v: Voxel): boolean => (v & VOXEL_ID_MASK) === WATER_ID;
/** A water source: level 0 and not falling. */
export const isWaterSource = (v: Voxel): boolean => v === WATER_SOURCE;
/** Water that is not a source (flowing or falling). */
export const isFlowingWater = (v: Voxel): boolean => isWater(v) && v !== WATER_SOURCE;
export const isFallingWater = (v: Voxel): boolean => isWater(v) && ((v >> 12) & 1) === 1;
/** Level of a water voxel: 0 source, 1..7 flowing (falling water reads 1). */
export const waterLevel = (v: Voxel): number => (v >> 13) & 7;

/**
 * Any liquid that is a source of itself: lava and crude oil never flow, so every block of them is one (a bucket or a
 * pump may take it); water only at level 0 and not falling.
 */
export const isLiquidSource = (v: Voxel): boolean => {
  const def = BLOCKS[v & VOXEL_ID_MASK];
  return def !== undefined && def.liquid !== null && (def.liquid !== 'water' || v === WATER_SOURCE);
};

/** Plants that flowing water washes away (spec 18.2): it flows into their cell and destroys them, no drop. */
export const WASHABLE_KEYS: readonly string[] = ['tall_grass', 'fern', 'ember_poppy', 'skybell', 'frost_lily', 'dry_shrub', 'reeds'];
/** 1 for washable block ids (indexed by masked id). */
export const WASHABLE = new Uint8Array(VOXEL_ID_MASK + 1);
for (const key of WASHABLE_KEYS) WASHABLE[blockId(key)] = 1;

/** Air or a washable plant: water may move into the cell (and destroy what is there). */
export const isOpenForWater = (v: Voxel): boolean => v === 0 || WASHABLE[v & VOXEL_ID_MASK] === 1;

/**
 * Surface height of a water cell inside its block (spec 18.4) when nothing of it lies above: sources and falling
 * water stand at 14/16, flowing level L at (8 - L) / 9.
 */
export function waterHeight(v: Voxel): number {
  if (v === WATER_SOURCE || ((v >> 12) & 1) === 1) return 14 / 16;
  return (8 - waterLevel(v)) / 9;
}

/** Strength 0..1 of the current in a water cell (spec 18.4): 1 for sources, falling water and level 1; 1/7 at level 7. */
export const currentStrength = (v: Voxel): number => (((v >> 12) & 1) === 1 ? 1 : (8 - Math.max(1, waterLevel(v))) / 7);

/** Anything voxels can be read from (an IWorld fits); out-of-world rules are the reader's. */
export interface VoxelReader {
  getVoxel(x: number, y: number, z: number): Voxel;
}

/** Speed of the current in level-1 water, m/s (spec 18.4); weaker levels push less (`currentStrength`). */
export const CURRENT_SPEED = 1.4;

/** Scratch direction for currentAt. */
const dir = { x: 0, z: 0 };
const HDX = [1, -1, 0, 0];
const HDZ = [0, 0, 1, -1];

/** A cell's "pressure" for the flow direction: lower levels push towards higher ones; 8 for open air. */
function levelFor(v: Voxel): number {
  if (!isWater(v)) return 8;
  return isFallingWater(v) ? 0 : waterLevel(v);
}

/**
 * Horizontal flow direction of the water cell at x, y, z (spec 18.4: texture scroll and currents), written to
 * `out` as a unit vector (0, 0 when still). Water runs from lower levels towards higher ones; flowing cells also run
 * towards open neighbouring cells (the end of a stream). Sources only feel flowing neighbours, so a lake whose shore
 * meets air stays still, exactly as a freshly generated world is.
 */
export function flowDirection(read: VoxelReader, x: number, y: number, z: number, out: { x: number; z: number }): { x: number; z: number } {
  out.x = 0;
  out.z = 0;
  const v = read.getVoxel(x, y, z);
  if (!isWater(v)) return out;
  const own = levelFor(v);
  const source = v === WATER_SOURCE;
  let fx = 0;
  let fz = 0;
  for (let d = 0; d < 4; d++) {
    const n = read.getVoxel(x + HDX[d], y, z + HDZ[d]);
    let diff: number;
    if (isWater(n)) diff = levelFor(n) - own;
    else if (!source && isOpenForWater(n)) diff = 8 - own;
    else continue;
    fx += HDX[d] * diff;
    fz += HDZ[d] * diff;
  }
  const len = Math.hypot(fx, fz);
  if (len > 1e-6) {
    out.x = fx / len;
    out.z = fz / len;
  }
  return out;
}

/**
 * The current in the cell at x, y, z (spec 18.4), m/s, written to `out`: along the flow, CURRENT_SPEED at level 1 and
 * weaker at higher levels; falling water pushes down instead (out.y = -1, a direction - the caller picks the force).
 * Returns false (out zeroed) in still water and anywhere that is not water.
 */
export function currentAt(read: VoxelReader, x: number, y: number, z: number, out: { x: number; y: number; z: number }): boolean {
  out.x = 0;
  out.y = 0;
  out.z = 0;
  const v = read.getVoxel(x, y, z);
  if (!isWater(v)) return false;
  if (isFallingWater(v)) {
    out.y = -1;
    return true;
  }
  flowDirection(read, x, y, z, dir);
  if (dir.x === 0 && dir.z === 0) return false;
  const speed = CURRENT_SPEED * currentStrength(v);
  out.x = dir.x * speed;
  out.z = dir.z * speed;
  return true;
}

/**
 * The new-source rule (spec 18.2): a cell with at least 2 horizontally adjacent water sources, standing on a source
 * or on something water cannot enter, is (or becomes again) a source. A source that meets it is endless: take it
 * and it fills again (spec 18.3, buckets and pumps).
 */
export function refillsAsSource(read: VoxelReader, x: number, y: number, z: number): boolean {
  let sources = 0;
  for (let d = 0; d < 4; d++) if (read.getVoxel(x + HDX[d], y, z + HDZ[d]) === WATER_SOURCE) sources++;
  if (sources < 2) return false;
  const below = read.getVoxel(x, y - 1, z);
  return below === WATER_SOURCE || (!isWater(below) && !isOpenForWater(below));
}
