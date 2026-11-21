/**
 * Ore veins, gravel pockets and ore outcrops on cliffs. Every vein belongs to the chunk its centre lies in and is a pure function
 * of (seed, that chunk, vein number); a chunk replays the veins of its 3x3 neighbourhood and keeps the
 * blocks that fall inside it, so the result never depends on the order chunks are generated in.
 */
import { hash32, mulberry32 } from '../core/math';
import { ORE_VEINS, blockId } from '../core/registry';
import { CHUNK_SIZE, voxelIndex, type BiomeKey, type OreVeinSpec } from '../core/types';
import { MARGIN, marginIndex, type ChunkColumns } from './columns';
import { ID } from './ids';
import { BIOME_KEYS, Column, sampleColumn, type Terrain } from './terrain';

const GRAVEL_POCKETS: OreVeinSpec = { block: 'gravel', minY: 10, maxY: 58, veinsPerChunk: 0.8, veinSize: 12 };
const VEINS: ReadonlyArray<OreVeinSpec & { id: number }> = [...ORE_VEINS, GRAVEL_POCKETS].map((v) => ({ ...v, id: blockId(v.block) }));
/** A vein never strays further than this from its centre, so it always fits in the 3x3 neighbourhood. */
const REACH = 7;
const DX = [1, -1, 0, 0, 0, 0];
const DY = [0, 0, 1, -1, 0, 0];
const DZ = [0, 0, 0, 0, 1, -1];
const col = new Column();
const visited = new Int32Array(64);

function walkVein(voxels: Uint16Array, x0: number, z0: number, vein: OreVeinSpec & { id: number }, vx: number, vy: number, vz: number, seed: number): void {
  const rng = mulberry32(seed);
  let dx = 0;
  let dy = 0;
  let dz = 0;
  let placed = 0;
  const size = Math.min(vein.veinSize, visited.length);
  for (let step = 0; step < size * 3 && placed < size; step++) {
    const code = ((dy + 128) * 16 + dz + 8) * 16 + dx + 8;
    let seen = false;
    for (let i = 0; i < placed; i++) if (visited[i] === code) { seen = true; break; }
    if (!seen) {
      visited[placed++] = code;
      const lx = vx + dx - x0;
      const lz = vz + dz - z0;
      if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
        const i = voxelIndex(lx, vy + dy, lz);
        const v = voxels[i];
        if (v === ID.stone || v === ID.basalt) voxels[i] = vein.id;
      }
    }
    const dir = Math.floor(rng() * 6);
    const nx = dx + DX[dir];
    const ny = dy + DY[dir];
    const nz = dz + DZ[dir];
    if (Math.abs(nx) > REACH || Math.abs(nz) > REACH || vy + ny < vein.minY || vy + ny > vein.maxY) continue;
    dx = nx;
    dy = ny;
    dz = nz;
  }
}

export function placeVeins(t: Terrain, voxels: Uint16Array, cx: number, cz: number): void {
  const x0 = cx * CHUNK_SIZE;
  const z0 = cz * CHUNK_SIZE;
  for (let ncz = cz - 1; ncz <= cz + 1; ncz++) {
    for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const biome = BIOME_KEYS[sampleColumn(t, ncx * CHUNK_SIZE + 8, ncz * CHUNK_SIZE + 8, col).biome];
      for (let n = 0; n < VEINS.length; n++) {
        const vein = VEINS[n];
        const rng = mulberry32(hash32(t.seed, ncx, ncz, 0x0e5000 + n));
        const average = vein.veinsPerChunk * (vein.biomes?.[biome] ?? 1);
        const count = Math.floor(average) + (rng() < average - Math.floor(average) ? 1 : 0);
        for (let k = 0; k < count; k++) {
          const vx = ncx * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
          const vz = ncz * CHUNK_SIZE + Math.floor(rng() * CHUNK_SIZE);
          const ry = rng();
          const walkSeed = Math.floor(rng() * 4294967296);
          if (vx + REACH < x0 || vx - REACH >= x0 + CHUNK_SIZE || vz + REACH < z0 || vz - REACH >= z0 + CHUNK_SIZE) continue;
          // Centres stay inside the rock of their column, so high bands are not wasted on open air.
          const top = Math.min(vein.maxY, sampleColumn(t, vx, vz, col).height - 2);
          if (top < vein.minY) continue;
          walkVein(voxels, x0, z0, vein, vx, vein.minY + Math.floor(ry * (top - vein.minY + 1)), vz, walkSeed);
        }
      }
    }
  }
}

const OUTCROP_ORES = ORE_VEINS.map((v) => ({ ...v, id: blockId(v.block), weight: v.veinsPerChunk * v.veinSize }));

/** An ore for a cliff cluster at height y, weighted like the veins and their biome multipliers; -1 for none. */
function outcropOre(biome: BiomeKey, y: number, roll: number): number {
  let total = 0;
  for (const v of OUTCROP_ORES) if (y >= v.minY && y <= v.maxY) total += v.weight * (v.biomes?.[biome] ?? 1);
  let pick = roll * total;
  for (const v of OUTCROP_ORES) {
    if (y < v.minY || y > v.maxY) continue;
    pick -= v.weight * (v.biomes?.[biome] ?? 1);
    if (pick < 0) return v.id;
  }
  return -1;
}

/**
 * Ore outcrops: small clusters of ore showing in bare rock at the surface - the faces of cliffs, terraces and
 * gorges (the cells of a column above its lowest neighbour) and rock that lies open on top - so a sharp-eyed
 * explorer can spot ore from outside. Uses only this chunk's columns and their immediate neighbours' heights.
 */
export function placeOutcrops(t: Terrain, voxels: Uint16Array, x0: number, z0: number, cols: ChunkColumns): void {
  const { heights } = cols;
  for (let lz = 0; lz < CHUNK_SIZE; lz++) {
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      const m = marginIndex(lx, lz);
      const h = heights[m];
      const low = Math.min(h - 1, heights[m - 1], heights[m + 1], heights[m - MARGIN], heights[m + MARGIN]);
      const x = x0 + lx;
      const z = z0 + lz;
      for (let y = low + 1; y <= h; y++) {
        const i = voxelIndex(lx, y, lz);
        const v = voxels[i];
        if (v !== ID.stone && v !== ID.basalt) continue;
        const cluster = hash32(t.seed, x >> 2, y >> 2, z >> 2);
        if ((cluster & 7) !== 0 || (hash32(t.seed, x, y, z) & 1) === 0) continue;
        const ore = outcropOre(BIOME_KEYS[cols.biomes[lz * CHUNK_SIZE + lx]], y, (cluster >>> 8) / 16777216);
        if (ore >= 0) voxels[i] = ore;
      }
    }
  }
}
