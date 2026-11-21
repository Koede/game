/** Chunk storage and the coordinate helpers shared by the whole world module. */
import { AIR, CHUNK_SIZE, CHUNK_VOLUME, WORLD_HEIGHT, voxelIndex, type Voxel } from '../core/types';

/** Chunk coordinate of a world block coordinate. */
export const chunkCoord = (v: number): number => Math.floor(v / CHUNK_SIZE);
/** Position inside its chunk (0..15) of an integer world block coordinate. */
export const localCoord = (v: number): number => v & (CHUNK_SIZE - 1);

const KEY_BIAS = 0x8000;
const KEY_SPAN = 0x10000;
/** One number per chunk column, valid for |cx|, |cz| < 32768 (more than half a million blocks each way). */
export const chunkKey = (cx: number, cz: number): number => (cx + KEY_BIAS) * KEY_SPAN + (cz + KEY_BIAS);
export const keyChunkX = (key: number): number => Math.floor(key / KEY_SPAN) - KEY_BIAS;
export const keyChunkZ = (key: number): number => (key % KEY_SPAN) - KEY_BIAS;

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
  /** Voxels or lighting changed since the last mesh was started. */
  dirty = true;
  /** Re-mesh ahead of ordinary streaming work. */
  urgent = false;
  /** Re-mesh on the main thread during the next update (player edits). */
  sync = false;
  /** An asynchronous mesh job is in flight. */
  meshing = false;
  /** Bumped whenever a mesh is started; a result from an older epoch is stale and dropped. */
  epoch = 0;
  /** How many more neighbour hops a lighting change may travel from this chunk's next mesh. */
  ripple = 0;
  /** Light hashes of the four borders from the last mesh (see lighting.borderHashes). */
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
