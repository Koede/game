/** What world generation knows about the columns of the chunk being generated (scratch, one set per thread). */
import { CHUNK_SIZE } from '../core/types';

/** Width of the margin arrays: the chunk plus one column on every side. */
export const MARGIN = CHUNK_SIZE + 2;

export interface ChunkColumns {
  /** Ground height per column, margin layout (see marginIndex). */
  readonly heights: Int16Array;
  /** LIQUID_* per column, margin layout. */
  readonly liquids: Uint8Array;
  /** Index into BIOME_KEYS per chunk column (lz * 16 + lx). */
  readonly biomes: Uint8Array;
  /** Biome weights per chunk column, for blended edges. */
  readonly wScar: Float32Array;
  readonly wFrost: Float32Array;
  /** Highest y caves may carve per chunk column; below it a column is "underground". */
  readonly caveLimit: Int16Array;
}

export const marginIndex = (lx: number, lz: number): number => (lz + 1) * MARGIN + lx + 1;

export function createColumns(): ChunkColumns {
  const n = CHUNK_SIZE * CHUNK_SIZE;
  return {
    heights: new Int16Array(MARGIN * MARGIN),
    liquids: new Uint8Array(MARGIN * MARGIN),
    biomes: new Uint8Array(n),
    wScar: new Float32Array(n),
    wFrost: new Float32Array(n),
    caveLimit: new Int16Array(n),
  };
}

/**
 * Feature cells: the world is cut into square cells of `size` blocks, each holding at most one feature whose
 * place is a pure function of (seed, cell). Calls `fn` for every cell whose feature could reach the box
 * [xa..xb] x [za..zb] when features stay within their cell.
 */
export function forEachCell(size: number, xa: number, za: number, xb: number, zb: number, fn: (gx: number, gz: number) => void): void {
  const gx0 = Math.floor(xa / size);
  const gx1 = Math.floor(xb / size);
  const gz0 = Math.floor(za / size);
  const gz1 = Math.floor(zb / size);
  for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) fn(gx, gz);
}
