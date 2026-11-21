/**
 * Light at an arbitrary point, estimated from the voxels around it (the baked light lives only inside chunk
 * meshes). Used for things that are not part of a chunk mesh: the held item and particle colours. The ramps
 * mirror LIGHT_GLSL in shaders/chunk.ts exactly, so a probed colour matches the terrain next to it.
 */
import { voxelLight } from '../core/registry';
import type { IWorld } from '../core/types';

export const skyRamp = (l: number): number => Math.exp(-3.4 * (1 - l));
export const blockRamp = (l: number): number => Math.pow(l, 1.55) * 1.2;

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

  constructor(private readonly world: IWorld) {}

  /** Estimates sky and block light (0..1 each) at a world point. Stores them in `sky` / `block`. */
  probe(x: number, y: number, z: number): void {
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const fz = Math.floor(z);
    this.sky = this.skyAt(fx, fy, fz) / 15;
    this.block = this.blockAt(fx, fy, fz) / 15;
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

  private blockAt(x: number, y: number, z: number): number {
    const w = this.world;
    let best = 0;
    for (let dy = -BLOCK_RADIUS; dy <= BLOCK_RADIUS; dy++) {
      const ady = Math.abs(dy);
      for (let dz = -BLOCK_RADIUS; dz <= BLOCK_RADIUS; dz++) {
        const adz = Math.abs(dz);
        for (let dx = -BLOCK_RADIUS; dx <= BLOCK_RADIUS; dx++) {
          const d = ady + adz + Math.abs(dx);
          const v = w.getVoxel(x + dx, y + dy, z + dz);
          if (v === 0) continue;
          const l = voxelLight(v) - d;
          if (l > best) best = l;
        }
      }
    }
    return best;
  }
}
