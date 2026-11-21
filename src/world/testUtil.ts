/** Helpers for the world module's own tests: a hand-built 3x3 neighbourhood of voxel arrays. */
import { CHUNK_SIZE, CHUNK_VOLUME, voxelIndex, type Voxel } from '../core/types';

/** Nine empty chunks. Coordinates below are relative to the centre chunk: x, z from -16 to 31. */
export const emptyNeighborhood = (): Uint16Array[] => Array.from({ length: 9 }, () => new Uint16Array(CHUNK_VOLUME));

export function put(chunks: Uint16Array[], x: number, y: number, z: number, voxel: Voxel): void {
  const n = (Math.floor(z / CHUNK_SIZE) + 1) * 3 + Math.floor(x / CHUNK_SIZE) + 1;
  chunks[n][voxelIndex(x & 15, y, z & 15)] = voxel;
}

/** Fills the box [x0..x1] x [y0..y1] x [z0..z1] (inclusive). */
export function fill(chunks: Uint16Array[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, voxel: Voxel): void {
  for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) put(chunks, x, y, z, voxel);
}
