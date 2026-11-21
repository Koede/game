/** Chunk storage and the coordinate helpers shared by the whole world module. */
import { AIR, CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT, voxelIndex, type Voxel } from '../core/types';

/** Chunk coordinate of a world block coordinate. */
export const chunkCoord = (v: number): number => Math.floor(v / CHUNK_SIZE);
/** Position inside its chunk (0..15) of an integer world block coordinate. */
export const localCoord = (v: number): number => v & (CHUNK_SIZE - 1);

const KEY_BIAS = 0x2000;
const KEY_SPAN = 0x4000;
/** Keys of columns beyond the near range start here (above every near key, which is < 2^28). */
const FAR_BASE = 0x10000000;
const FAR_BIAS = 0x8000;
const FAR_SPAN = 0x10000;
/**
 * One number per chunk column. Within |cx|, |cz| < 8192 (131072 blocks each way) the key stays below 2^28, a
 * V8 small integer, so Map lookups on it (every getVoxel / isLoaded) never box a heap number. Farther columns,
 * up to |cx|, |cz| < 32768, get distinct larger keys: still correct, only slower.
 */
export const chunkKey = (cx: number, cz: number): number =>
  cx >= -KEY_BIAS && cx < KEY_BIAS && cz >= -KEY_BIAS && cz < KEY_BIAS
    ? (cx + KEY_BIAS) * KEY_SPAN + (cz + KEY_BIAS)
    : FAR_BASE + (cx + FAR_BIAS) * FAR_SPAN + (cz + FAR_BIAS);
export const keyChunkX = (key: number): number =>
  key < FAR_BASE ? Math.floor(key / KEY_SPAN) - KEY_BIAS : Math.floor((key - FAR_BASE) / FAR_SPAN) - FAR_BIAS;
export const keyChunkZ = (key: number): number =>
  key < FAR_BASE ? (key % KEY_SPAN) - KEY_BIAS : ((key - FAR_BASE) % FAR_SPAN) - FAR_BIAS;

/**
 * Voxel arrays of a chunk and its 8 neighbours, indexed `(dz + 1) * 3 + (dx + 1)`; the centre is entry 4.
 * `null` stands for a chunk that is not loaded.
 */
export type ChunkNeighborhood = ReadonlyArray<Uint16Array | null>;
export const neighborIndex = (dx: number, dz: number): number => (dz + 1) * 3 + (dx + 1);

/** The four side neighbours in the order used for light border hashes: +X, -X, +Z, -Z. */
export const SIDE_DX: readonly number[] = [1, -1, 0, 0];
export const SIDE_DZ: readonly number[] = [0, 0, 1, -1];
export const SIDE_OPPOSITE: readonly number[] = [1, 0, 3, 2];

export class Chunk {
  readonly key: number;

  // ---- mesh bookkeeping, owned by the World's streaming code ----
  /** A mesh for this chunk has been handed to the renderer. */
  meshed = false;
  /** Voxels or lighting changed since the last mesh was started (or the mesh was hidden). */
  dirty = true;
  /** An asynchronous mesh job is in flight. */
  meshing = false;
  /** Bumped whenever a mesh is started; a result from an older epoch is stale and dropped. */
  epoch = 0;
  /** Light hashes of the four sides from the last mesh (see lighting.borderHashes). */
  borders: Uint32Array | null = null;

  constructor(
    readonly cx: number,
    readonly cz: number,
    readonly voxels: Uint16Array = new Uint16Array(CHUNK_VOLUME),
  ) {
    if (voxels.length !== CHUNK_VOLUME) throw new Error(`chunk ${cx},${cz}: voxel array has the wrong size`);
    this.key = chunkKey(cx, cz);
  }

  get(lx: number, y: number, lz: number): Voxel {
    return this.voxels[voxelIndex(lx, y, lz)];
  }

  set(lx: number, y: number, lz: number, voxel: Voxel): void {
    this.voxels[voxelIndex(lx, y, lz)] = voxel;
  }

  /** Highest non-air y of a column, or -1 when the column is empty. */
  surfaceY(lx: number, lz: number): number {
    const voxels = this.voxels;
    for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
      if (voxels[voxelIndex(lx, y, lz)] !== AIR) return y;
    }
    return -1;
  }
}
