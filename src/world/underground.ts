/**
 * The underground beyond plain caves (spec 14): crystal geodes, underground lakes, static lava falls and
 * glowcaps on cave floors. Geodes can cross chunk borders and are replayed from the 3x3 neighbourhood like ore
 * veins; lakes and lava falls stay inside their own chunk, so nothing here depends on generation order.
 */
import { hash32, mulberry32 } from '../core/math';
import { AIR, CHUNK_SIZE, voxelIndex } from '../core/types';
import type { ChunkColumns } from './columns';
import { ID } from './ids';
import type { Terrain } from './terrain';

const Y = CHUNK_SIZE * CHUNK_SIZE;
const GEODE_CHANCE = 0.075;
/** Geode centres stay at or below this y: under the lowest possible lake bed, so a geode never opens under water. */
const GEODE_TOP = 19;
const LAKE_CHANCE = 0.3;
const LAKE_RADIUS = 4.5;
const LAVA_FALL_CHANCE = 0.3;
/** Lakes and falls live in this y band ("deep caves"). */
const DEEP_MIN = 11;
const DEEP_MAX = 30;

const isRock = (v: number): boolean => v === ID.stone || v === ID.basalt;
const CAVE_FLOOR = new Set<number>([ID.stone, ID.gravel, ID.clay, ID.basalt, ID.rubble, ID.dirt]);

/** Hollow spheres: a dark basalt rind, a quartz shell and crystal clusters growing from the inside walls. */
export function placeGeodes(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
    for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const h = hash32(t.seed, ncx, ncz, 0x6e0d);
      if ((h & 0xffff) / 65536 >= GEODE_CHANCE) continue;
      const big = (h >>> 16) & 1;
      const R = big ? 4.1 : 3.3;
      const gx = ncx * CHUNK_SIZE + 3 + ((h >>> 17) % 10);
      const gz = ncz * CHUNK_SIZE + 3 + ((h >>> 21) % 10);
      const gy = 11 + ((h >>> 25) % (GEODE_TOP - 10));
      const reach = Math.ceil(R + 1);
      if (gx + reach < x0 || gx - reach >= x0 + CHUNK_SIZE || gz + reach < z0 || gz - reach >= z0 + CHUNK_SIZE) continue;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dz = -reach; dz <= reach; dz++) {
          const lz = gz + dz - z0;
          if (lz < 0 || lz >= CHUNK_SIZE) continue;
          for (let dx = -reach; dx <= reach; dx++) {
            const lx = gx + dx - x0;
            if (lx < 0 || lx >= CHUNK_SIZE) continue;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > R + 0.3) continue;
            const i = voxelIndex(lx, gy + dy, lz);
            const v = voxels[i];
            if (v === ID.corestone || v === ID.lava || v === ID.water) continue;
            if (d <= R - 1.5) {
              // Crystals line the inside of the shell; the middle stays open.
              const shell = d > R - 2.5 && (hash32(h, gx + dx, gy + dy, gz + dz) & 0xff) < 120;
              voxels[i] = shell ? ID.crystalCluster : AIR;
            } else if (d <= R - 0.5) {
              if (v !== AIR) voxels[i] = ID.quartzOre;
            } else if (isRock(v)) {
              voxels[i] = ID.basalt;
            }
          }
        }
      }
    }
  }
}

/**
 * Floods the lowest part of a cave inside a round region of this chunk, then drains every water block that
 * would touch air at its sides or below until what is left is a contained pool.
 */
export function fillUndergroundLake(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const rng = mulberry32(hash32(t.seed, cx, cz, 0x1a4e));
  if (rng() >= LAKE_CHANCE) return;
  const ccx = 5 + Math.floor(rng() * 6);
  const ccz = 5 + Math.floor(rng() * 6);
  let floor = DEEP_MAX;
  for (let lz = ccz - 4; lz <= ccz + 4; lz++) {
    for (let lx = ccx - 4; lx <= ccx + 4; lx++) {
      if ((lx - ccx) ** 2 + (lz - ccz) ** 2 > LAKE_RADIUS * LAKE_RADIUS) continue;
      for (let y = DEEP_MIN; y < floor; y++) {
        const i = voxelIndex(lx, y, lz);
        if (voxels[i] === AIR && voxels[i - Y] !== AIR && voxels[i - Y] !== ID.lava) {
          floor = y;
          break;
        }
      }
    }
  }
  if (floor >= DEEP_MAX - 2) return;
  const level = floor + 1 + Math.floor(rng() * 3);
  const inside = (lx: number, lz: number): boolean => (lx - ccx) ** 2 + (lz - ccz) ** 2 <= LAKE_RADIUS * LAKE_RADIUS;
  for (let y = floor; y <= level; y++) {
    for (let lz = ccz - 4; lz <= ccz + 4; lz++) {
      for (let lx = ccx - 4; lx <= ccx + 4; lx++) {
        const i = voxelIndex(lx, y, lz);
        if (inside(lx, lz) && voxels[i] === AIR) voxels[i] = ID.water;
      }
    }
  }
  // Drain until stable. The region never touches the chunk's edge, so every neighbour is in this chunk.
  for (let changed = true; changed;) {
    changed = false;
    for (let y = floor; y <= level; y++) {
      for (let lz = ccz - 4; lz <= ccz + 4; lz++) {
        for (let lx = ccx - 4; lx <= ccx + 4; lx++) {
          const i = voxelIndex(lx, y, lz);
          if (voxels[i] !== ID.water || !inside(lx, lz)) continue;
          if (voxels[i - Y] === AIR || voxels[i - 1] === AIR || voxels[i + 1] === AIR || voxels[i - CHUNK_SIZE] === AIR || voxels[i + CHUNK_SIZE] === AIR) {
            voxels[i] = AIR;
            changed = true;
          }
        }
      }
    }
  }
  // A bed of gravel and clay under the water.
  for (let y = floor; y <= level; y++) {
    for (let lz = ccz - 4; lz <= ccz + 4; lz++) {
      for (let lx = ccx - 4; lx <= ccx + 4; lx++) {
        const i = voxelIndex(lx, y, lz);
        if (voxels[i] === ID.water && isRock(voxels[i - Y])) voxels[i - Y] = rng() < 0.5 ? ID.gravel : ID.clay;
      }
    }
  }
}

/** A curtain of lava pouring from a cave ceiling to the floor, with a small pool where it lands. */
export function placeLavaFall(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const rng = mulberry32(hash32(t.seed, cx, cz, 0x1a7a));
  if (rng() >= LAVA_FALL_CHANCE) return;
  for (let attempt = 0; attempt < 48; attempt++) {
    const lx = 1 + Math.floor(rng() * (CHUNK_SIZE - 2));
    const lz = 1 + Math.floor(rng() * (CHUNK_SIZE - 2));
    for (let y = DEEP_MAX; y >= DEEP_MIN + 4; y--) {
      const i = voxelIndex(lx, y, lz);
      if (voxels[i] !== AIR || !isRock(voxels[i + Y])) continue;
      let bottom = y;
      while (bottom > 1 && voxels[voxelIndex(lx, bottom - 1, lz)] === AIR) bottom--;
      if (y - bottom < 4 || !lavaSafe(voxels, lx, lz, bottom, y)) break;
      for (let yy = bottom; yy <= y; yy++) voxels[voxelIndex(lx, yy, lz)] = ID.lava;
      const base = voxelIndex(lx, bottom, lz);
      for (const step of [1, -1, CHUNK_SIZE, -CHUNK_SIZE]) {
        if (voxels[base + step] === AIR && voxels[base + step - Y] !== AIR && voxels[base + step - Y] !== ID.water) voxels[base + step] = ID.lava;
      }
      return;
    }
  }
}

/** No water at the sides of a fall (water and lava never meet in a cave). */
function lavaSafe(voxels: Uint16Array, lx: number, lz: number, bottom: number, top: number): boolean {
  for (let y = bottom - 1; y <= top; y++) {
    const i = voxelIndex(lx, y, lz);
    if (voxels[i] === ID.water || voxels[i - 1] === ID.water || voxels[i + 1] === ID.water) return false;
    if (voxels[i - CHUNK_SIZE] === ID.water || voxels[i + CHUNK_SIZE] === ID.water) return false;
  }
  return true;
}

/** Glowcaps in clusters on cave floors well below the surface (the caves' own soft light). */
export function placeCaveGlowcaps(t: Terrain, voxels: Uint16Array, x0: number, z0: number, cols: ChunkColumns): void {
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const top = Math.min(cols.caveLimit[lz * CHUNK_SIZE + lx], 60);
      for (let y = DEEP_MIN - 1; y < top; y++) {
        const i = voxelIndex(lx, y, lz);
        if (voxels[i] !== AIR || !CAVE_FLOOR.has(voxels[i - Y])) continue;
        const x = x0 + lx;
        const z = z0 + lz;
        if ((hash32(t.seed, x >> 3, y >> 2, z >> 3) & 3) !== 0) continue;
        if ((hash32(t.seed, x, y, z) & 0xff) < 26) voxels[i] = ID.glowcap;
      }
    }
  }
}
