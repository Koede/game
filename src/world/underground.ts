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
const LAKE_CHANCE = 0.14;
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
      // Radius 3.3, 4.1 or 4.9: the biggest have room to stand in among the crystals.
      const R = 3.3 + 0.8 * ((h >>> 15) % 3);
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
 * An underground lake: a domed cavern hollowed out of the rock with water filling its lower half. Every water
 * block that would touch air at its sides or below (where another cave cuts through) drains away until what is
 * left is a contained pool. The cavern stays inside this chunk and under the column's cave limit, so it never
 * breaks the surface or opens under water.
 */
export function fillUndergroundLake(t: Terrain, voxels: Uint16Array, cx: number, cz: number, cols: ChunkColumns): void {
  const rng = mulberry32(hash32(t.seed, cx, cz, 0x1a4e));
  if (rng() >= LAKE_CHANCE) return;
  const ccx = 7.5 + rng();
  const ccz = 7.5 + rng();
  const r = 4.5 + rng();
  const ry = 3 + rng();
  const cy = DEEP_MIN + 4 + Math.floor(rng() * (DEEP_MAX - DEEP_MIN - 9));
  const level = cy - 1;
  const x0 = Math.floor(ccx - r);
  const x1 = Math.ceil(ccx + r);
  const z0 = Math.floor(ccz - r);
  const z1 = Math.ceil(ccz + r);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let lz = z0; lz <= z1; lz++) {
      for (let lx = x0; lx <= x1; lx++) {
        const dx = (lx + 0.5 - ccx) / r;
        const dz = (lz + 0.5 - ccz) / r;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dz * dz + dy * dy > 1 || y > cols.caveLimit[lz * CHUNK_SIZE + lx]) continue;
        const i = voxelIndex(lx, y, lz);
        if (voxels[i] === ID.corestone || voxels[i] === ID.lava) continue;
        voxels[i] = y <= level ? ID.water : AIR;
      }
    }
  }
  // Drain until stable. The cavern never reaches the chunk's edge, so every neighbour is in this chunk.
  for (let changed = true; changed;) {
    changed = false;
    for (let y = y0; y <= level; y++) {
      for (let lz = z0; lz <= z1; lz++) {
        for (let lx = x0; lx <= x1; lx++) {
          const i = voxelIndex(lx, y, lz);
          if (voxels[i] !== ID.water) continue;
          if (voxels[i - Y] === AIR || voxels[i - 1] === AIR || voxels[i + 1] === AIR || voxels[i - CHUNK_SIZE] === AIR || voxels[i + CHUNK_SIZE] === AIR) {
            voxels[i] = AIR;
            changed = true;
          }
        }
      }
    }
  }
  // A bed of gravel and clay under the water.
  for (let y = y0; y <= level; y++) {
    for (let lz = z0; lz <= z1; lz++) {
      for (let lx = x0; lx <= x1; lx++) {
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
