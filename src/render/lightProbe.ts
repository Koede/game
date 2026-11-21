/**
 * Light at an arbitrary point, estimated from the voxels around it (the baked light lives only inside chunk
 * meshes). Used for things that are not part of a chunk mesh: the held item and particle colours. The ramps
 * mirror LIGHT_GLSL in shaders/chunk.ts exactly, so a probed colour matches the terrain next to it.
 */
import { voxelLight } from '../core/registry';
import { VOXEL_ID_MASK, type IWorld } from '../core/types';
import { HUE_VIOLET, LIGHT_HUE } from '../world/blockTables';
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

  /** Brightest block light reaching the cell; also keeps the best warm and cool levels apart for `cool`. */
  private blockAt(x: number, y: number, z: number): number {
    const w = this.world;
    let warm = 0;
    let cool = 0;
    let violet = false;
    for (let dy = -BLOCK_RADIUS; dy <= BLOCK_RADIUS; dy++) {
      const ady = Math.abs(dy);
      for (let dz = -BLOCK_RADIUS; dz <= BLOCK_RADIUS; dz++) {
        const adz = Math.abs(dz);
        for (let dx = -BLOCK_RADIUS; dx <= BLOCK_RADIUS; dx++) {
          const d = ady + adz + Math.abs(dx);
          const v = w.getVoxel(x + dx, y + dy, z + dz);
          if (v === 0) continue;
          const l = voxelLight(v) - d;
          if (l <= 0) continue;
          const hue = LIGHT_HUE[v & VOXEL_ID_MASK];
          if (hue === 0) {
            if (l > warm) warm = l;
          } else if (l > cool) {
            cool = l;
            violet = hue === HUE_VIOLET;
          }
        }
      }
    }
    this.warmBest = warm;
    this.coolBest = cool;
    this.violet = violet;
    return Math.max(warm, cool);
  }
}
