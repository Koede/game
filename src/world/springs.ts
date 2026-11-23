/**
 * Hot springs (docs/api/hotsprings.md): in the frostfell a few flat spots hold a small pool of still water, two blocks
 * deep, ringed by basalt and breathed on by two steam vents. The vents are ordinary warm blocks, so the temperature
 * system (survival warmth, heat radius) already makes the pool a place to thaw out. Pure function of (seed, cx, cz):
 * the pool lies wholly inside its chunk and nothing from other stages is cut (a spot with anything above it is skipped).
 */
import { hash32, mulberry32 } from '../core/math';
import { CHUNK_SIZE, voxelIndex } from '../core/types';
import { marginIndex, type ChunkColumns } from './columns';
import { ID } from './ids';
import { FROSTFELL, LIQUID_NONE, type Terrain } from './terrain';

/** Chance per chunk that a frostfell chunk holds a spring. */
export const SPRING_CHANCE = 0.2;
export const SPRING_RADIUS = 2.4;

export function placeHotSprings(t: Terrain, voxels: Uint16Array, cx: number, cz: number, cols: ChunkColumns): void {
  const rng = mulberry32(hash32(t.seed, cx, cz, 0x5b1a));
  if (rng() >= SPRING_CHANCE) return;
  const r = SPRING_RADIUS;
  const R = Math.ceil(r) + 1;
  for (let attempt = 0; attempt < 10; attempt++) {
    const lx = R + Math.floor(rng() * (CHUNK_SIZE - 2 * R));
    const lz = R + Math.floor(rng() * (CHUNK_SIZE - 2 * R));
    if (cols.biomes[lz * CHUNK_SIZE + lx] !== FROSTFELL) continue;
    const h = cols.heights[marginIndex(lx, lz)];
    let ok = true;
    for (let dz = -R; dz <= R && ok; dz++) {
      for (let dx = -R; dx <= R && ok; dx++) {
        if (dx * dx + dz * dz > (r + 1) * (r + 1)) continue;
        const m = marginIndex(lx + dx, lz + dz);
        if (Math.abs(cols.heights[m] - h) > 1 || cols.liquids[m] !== LIQUID_NONE) ok = false;
        // Nothing may stand above the disc (spires, trees): we would leave pieces floating.
        for (let y = h + 1; y <= h + 10 && ok; y++) if (voxels[voxelIndex(lx + dx, y, lz + dz)] !== 0) ok = false;
        if (voxels[voxelIndex(lx + dx, h - 2, lz + dz)] === 0) ok = false;
      }
    }
    if (!ok) continue;
    // The pool: two blocks of still water inside the disc, flush with the ground around it.
    for (let dz = -R; dz <= R; dz++) {
      for (let dx = -R; dx <= R; dx++) {
        const d2 = dx * dx + dz * dz;
        if (d2 <= r * r) {
          for (const y of [h, h - 1]) voxels[voxelIndex(lx + dx, y, lz + dz)] = ID.water;
          voxels[voxelIndex(lx + dx, h - 2, lz + dz)] = ID.basalt;
        } else if (d2 <= (r + 1) * (r + 1)) {
          voxels[voxelIndex(lx + dx, h, lz + dz)] = ID.basalt;
        }
      }
    }
    // Two vents on opposite rim blocks.
    const a = rng() * Math.PI;
    for (const s of [1, -1]) {
      const vx = lx + Math.round(Math.cos(a) * (r + 0.6) * s);
      const vz = lz + Math.round(Math.sin(a) * (r + 0.6) * s);
      const i = voxelIndex(vx, h, vz);
      if (voxels[i] === ID.basalt) voxels[i] = ID.steamVent;
    }
    return;
  }
}
