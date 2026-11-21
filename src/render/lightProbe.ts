/**
 * Light at an arbitrary point, estimated from the voxels around it (the baked light lives only inside chunk
 * meshes). Used for things that are not part of a chunk mesh: the held item and particle colours. The ramps
 * mirror LIGHT_GLSL in shaders/chunk.ts exactly, so a probed colour matches the terrain next to it.
 */
import { CHUNK_SIZE, VOXEL_ID_MASK, WORLD_HEIGHT, voxelActive, type IWorld } from '../core/types';
import { EMIT, EMIT_ACTIVE, HUE_VIOLET, LIGHT_HUE } from '../world/blockTables';
import { COOL_CYAN, COOL_VIOLET } from './shaders/chunk';

export const skyRamp = (l: number): number => Math.exp(-3.4 * (1 - l));
export const blockRamp = (l: number): number => Math.pow(l, 1.25) * 1.45;

/** CPU twin of the shader's lightColor(): sky and block light 0..1 to an RGB multiplier. */
export function lightColor(
  sky: number,
  block: number,
  skyTint: ArrayLike<number>,
  blockTint: ArrayLike<number>,
  ambient: number,
  out: Float32Array,
): Float32Array {
  const s = skyRamp(sky);
  const b = blockRamp(block);
  for (let i = 0; i < 3; i++) {
    const sc = s * skyTint[i];
    const bc = b * blockTint[i];
    out[i] = Math.max(Math.max(sc, bc) + 0.22 * Math.min(sc, bc), ambient);
  }
  return out;
}

/** Block light reaches this far (spec: light travels at most 15 blocks; nearer emitters dominate anyway). */
const BLOCK_RADIUS = 7;
const SKY_RING = 4;
/** No block emits more than this (spec: light levels 0..15). */
const MAX_LIGHT = 15;

/** World's direct chunk access (optional on IWorld: test worlds may lack it). */
interface ChunkSource {
  chunkVoxels?(cx: number, cz: number): Uint16Array | null;
}

export class LightProbe {
  /** Last probed sky and block light, 0..1. */
  sky = 1;
  block = 0;
  /**
   * Share 0..1 of the last probed block light that comes from cool emitters (glowcaps, crystal clusters), and
   * whether that cool light is violet (crystals) rather than cyan (glowcaps) - like the chunk vertices' flags.
   */
  cool = 0;
  violet = false;
  private warmBest = 0;
  private coolBest = 0;
  /** The chunk columns of the current probe, [cx offset * 2 + cz offset] (the 15-wide cube spans at most 2 x 2). */
  private readonly cols: (Uint16Array | null)[] = [null, null, null, null];

  constructor(private readonly world: IWorld) {}

  /** Estimates sky and block light (0..1 each) at a world point. Stores them in `sky` / `block` / `cool`. */
  probe(x: number, y: number, z: number): void {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    this.sky = this.skyAt(fx, fy, fz) / 15;
    this.block = this.blockAt(fx, fy, fz) / 15;
    const w = this.warmBest;
    const c = this.coolBest;
    // Squared levels: the stronger colour dominates, and a torch drowns out a glowcap the way it does on the terrain.
    this.cool = c > 0 ? (c * c) / (c * c + w * w) : 0;
  }

  /** The block-light colour of the last probe: firelight `warm`, blended towards the cool glow by `cool`. */
  tint(warm: ArrayLike<number>, out: Float32Array): Float32Array {
    const c = this.violet ? COOL_VIOLET : COOL_CYAN;
    for (let i = 0; i < 3; i++) out[i] = warm[i] + (c[i] - warm[i]) * this.cool;
    return out;
  }

  /** 15 under open sky; otherwise light leaking in sideways from the nearest open column, 1 less per block. */
  private skyAt(x: number, y: number, z: number): number {
    const w = this.world;
    if (!w.isLoaded(x, z)) return 15;
    if (y > w.surfaceY(x, z)) return 15;
    let best = 0;
    for (let r = 1; r <= SKY_RING; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          if (y > w.surfaceY(x + dx, z + dz)) best = Math.max(best, 15 - r - 1);
        }
      }
      if (best > 0) break;
    }
    return best;
  }

  /**
   * Brightest block light reaching the cell; also keeps the best warm and cool levels apart for `cool`.
   * Reads the 1-4 chunk columns the cube spans straight from their voxel arrays (no per-voxel world lookup, no
   * garbage); a world without `chunkVoxels` falls back to getVoxel. Visits cells in the same y, z, x order as a
   * plain triple loop, so ties between a cyan and a violet emitter resolve the same way.
   */
  private blockAt(x: number, y: number, z: number): number {
    const w = this.world;
    const source = (w as IWorld & ChunkSource).chunkVoxels;
    const direct = typeof source === 'function';
    const x0 = x - BLOCK_RADIUS;
    const x1 = x + BLOCK_RADIUS;
    const z0 = z - BLOCK_RADIUS;
    const cx0 = x0 >> 4;
    const cxN = (x1 >> 4) - cx0 + 1;
    const cz0 = z0 >> 4;
    const cols = this.cols;
    if (direct) {
      const czN = ((z + BLOCK_RADIUS) >> 4) - cz0 + 1;
      for (let i = 0; i < cxN; i++) {
        for (let j = 0; j < czN; j++) cols[i * 2 + j] = source.call(w, cx0 + i, cz0 + j);
      }
    }
    this.warmBest = 0;
    this.coolBest = 0;
    this.violet = false;
    const y0 = Math.max(0, y - BLOCK_RADIUS);
    const y1 = Math.min(WORLD_HEIGHT - 1, y + BLOCK_RADIUS);
    for (let yy = y0; yy <= y1; yy++) {
      const ady = Math.abs(yy - y);
      for (let dz = -BLOCK_RADIUS; dz <= BLOCK_RADIUS; dz++) {
        const dyz = ady + Math.abs(dz);
        // Nothing in this row can beat both bests (warm and cool are tracked apart, so both must be beaten).
        if (MAX_LIGHT - dyz <= Math.min(this.warmBest, this.coolBest)) continue;
        const zz = z + dz;
        const j = (zz >> 4) - cz0;
        const rowBase = (yy * CHUNK_SIZE + (zz & 15)) * CHUNK_SIZE;
        for (let i = 0; i < cxN; i++) {
          const left = (cx0 + i) * CHUNK_SIZE;
          const xa = Math.max(x0, left);
          const xb = Math.min(x1, left + CHUNK_SIZE - 1);
          if (!direct) {
            for (let xx = xa; xx <= xb; xx++) this.consider(w.getVoxel(xx, yy, zz), dyz + Math.abs(xx - x));
            continue;
          }
          const vox = cols[i * 2 + j];
          if (vox === null) continue;
          const base = rowBase - left;
          for (let xx = xa; xx <= xb; xx++) {
            const v = vox[base + xx];
            if (v !== 0) this.consider(v, dyz + Math.abs(xx - x));
          }
        }
      }
    }
    if (direct) cols.fill(null);
    return Math.max(this.warmBest, this.coolBest);
  }

  /** Counts the light of voxel `v`, `d` blocks away, towards the warm or the cool best. */
  private consider(v: number, d: number): void {
    const id = v & VOXEL_ID_MASK;
    const l = (voxelActive(v) ? EMIT_ACTIVE[id] : EMIT[id]) - d;
    if (l <= 0) return;
    const hue = LIGHT_HUE[id];
    if (hue === 0) {
      if (l > this.warmBest) this.warmBest = l;
    } else if (l > this.coolBest) {
      this.coolBest = l;
      this.violet = hue === HUE_VIOLET;
    }
  }
}
