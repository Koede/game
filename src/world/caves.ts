/**
 * Caves: winding tunnels where two 3D noise fields are both near zero, plus a few chambers where a third
 * is high. The fields are sampled on a world-aligned lattice (4 blocks apart) and interpolated, so a
 * chunk costs a few thousand noise calls instead of one per voxel.
 */
import { AIR, CHUNK_SIZE, WORLD_HEIGHT } from '../core/types';
import { ID } from './ids';
import { CAVE_LAVA_TOP, type Terrain } from './terrain';

const STEP = 4;
const LXZ = CHUNK_SIZE / STEP + 1;
const LY = WORLD_HEIGHT / STEP + 1;
const fieldA = new Float32Array(LXZ * LXZ * LY);
const fieldB = new Float32Array(LXZ * LXZ * LY);
const fieldC = new Float32Array(LXZ * LXZ * LY);
/** Squared radius of a tunnel in noise units, and the chamber threshold. */
const TUNNEL = 0.0105;
const CHAMBER = 0.5;
/** Below this y the network widens and chambers grow (the depth bands of caveRooms.ts: richer, roomier caves lower down). */
const WIDEN_TOP = 36;
const WIDEN_SPAN = 26;
/** Deepest tunnels are this much roomier (squared radius), and the deepest chamber threshold this much lower. */
const WIDEN_TUNNEL = 0.9;
const WIDEN_CHAMBER = 0.1;
const Y_STRIDE = CHUNK_SIZE * CHUNK_SIZE;

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

/**
 * Carves caves into `voxels`. `limit[lz * 16 + lx]` is the highest y that may be carved in a column
 * (it keeps caves away from water and decides where they may open to the surface).
 */
export function carveCaves(t: Terrain, voxels: Uint16Array, x0: number, z0: number, limit: Int16Array): void {
  let top = 0;
  for (let i = 0; i < limit.length; i++) if (limit[i] > top) top = limit[i];
  const levels = Math.min(LY, Math.floor(top / STEP) + 2);
  for (let ly = 0; ly < levels; ly++) {
    const y = ly * STEP;
    for (let lz = 0; lz < LXZ; lz++) {
      const z = z0 + lz * STEP;
      for (let lx = 0; lx < LXZ; lx++) {
        const x = x0 + lx * STEP;
        const i = (ly * LXZ + lz) * LXZ + lx;
        fieldA[i] = t.caveA.noise3(x / 27, y / 15, z / 27);
        fieldB[i] = t.caveB.noise3(x / 27 + 50, y / 15 + 50, z / 27 + 50);
        // Chambers fade out towards the surface and the very bottom.
        const band = y < 12 ? y / 12 : y > 40 ? Math.max(0, 1 - (y - 40) / 16) : 1;
        fieldC[i] = t.caveC.noise3(x / 30, y / 16, z / 30) * band;
      }
    }
  }
  const sx = 1;
  const sz = LXZ;
  const sy = LXZ * LXZ;
  for (let ly = 0; ly < levels - 1; ly++) {
    for (let lz = 0; lz < LXZ - 1; lz++) {
      for (let lx = 0; lx < LXZ - 1; lx++) {
        const c = (ly * LXZ + lz) * LXZ + lx;
        for (let dy = 0; dy < STEP; dy++) {
          const y = ly * STEP + dy;
          if (y < 1 || y > top) continue;
          const fy = dy / STEP;
          const a00 = lerp(fieldA[c], fieldA[c + sy], fy);
          const a10 = lerp(fieldA[c + sx], fieldA[c + sx + sy], fy);
          const a01 = lerp(fieldA[c + sz], fieldA[c + sz + sy], fy);
          const a11 = lerp(fieldA[c + sz + sx], fieldA[c + sz + sx + sy], fy);
          const b00 = lerp(fieldB[c], fieldB[c + sy], fy);
          const b10 = lerp(fieldB[c + sx], fieldB[c + sx + sy], fy);
          const b01 = lerp(fieldB[c + sz], fieldB[c + sz + sy], fy);
          const b11 = lerp(fieldB[c + sz + sx], fieldB[c + sz + sx + sy], fy);
          const c00 = lerp(fieldC[c], fieldC[c + sy], fy);
          const c10 = lerp(fieldC[c + sx], fieldC[c + sx + sy], fy);
          const c01 = lerp(fieldC[c + sz], fieldC[c + sz + sy], fy);
          const c11 = lerp(fieldC[c + sz + sx], fieldC[c + sz + sx + sy], fy);
          const fill = y <= CAVE_LAVA_TOP ? ID.lava : AIR;
          const deep = y >= WIDEN_TOP ? 0 : Math.min(1, (WIDEN_TOP - y) / WIDEN_SPAN);
          const tunnel = TUNNEL * (1 + WIDEN_TUNNEL * deep);
          const chamber = CHAMBER - WIDEN_CHAMBER * deep;
          for (let dz = 0; dz < STEP; dz++) {
            const fz = dz / STEP;
            const a0 = lerp(a00, a01, fz);
            const a1 = lerp(a10, a11, fz);
            const b0 = lerp(b00, b01, fz);
            const b1 = lerp(b10, b11, fz);
            const c0 = lerp(c00, c01, fz);
            const c1 = lerp(c10, c11, fz);
            const row = (lz * STEP + dz) * CHUNK_SIZE + lx * STEP;
            for (let dx = 0; dx < STEP; dx++) {
              if (y > limit[row + dx]) continue;
              const fx = dx / STEP;
              const a = lerp(a0, a1, fx);
              const b = lerp(b0, b1, fx);
              if (a * a + b * b < tunnel || lerp(c0, c1, fx) > chamber) {
                const i = y * Y_STRIDE + row + dx;
                const v = voxels[i];
                if (v !== AIR && v !== ID.corestone) voxels[i] = fill;
              }
            }
          }
        }
      }
    }
  }
}
