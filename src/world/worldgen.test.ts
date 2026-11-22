import { describe, expect, it } from 'vitest';
import { perfIt } from '../testing/perf';
import { seedFromString } from '../core/math';
import { BLOCKS, ORE_VEINS, blockId } from '../core/registry';
import { AIR, CHUNK_SIZE, SEA_LEVEL, WORLD_HEIGHT, voxelId, voxelIndex } from '../core/types';
import { RUIN_SPAWN_RADIUS } from '../core/constants';
import { chunkKey } from './chunk';
import { ruinCrateCells, spawnRuin } from './ruins';
import { biomeAt, findSpawn, generateChunk } from './worldgen';

const SEED = seedFromString('worldgen-test');
const WATER = blockId('water');
const LOGS = new Set([blockId('oak_log'), blockId('pine_log')]);
const LEAVES = new Set([blockId('oak_leaves'), blockId('pine_leaves')]);

/** Generated chunks of one seed with world-coordinate access (AIR outside what was generated). */
class Sample {
  readonly chunks = new Map<number, Uint16Array>();
  constructor(readonly seed: number, cx0: number, cz0: number, cx1: number, cz1: number) {
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) this.chunks.set(chunkKey(cx, cz), generateChunk(seed, cx, cz));
  }
  has(x: number, z: number): boolean {
    return this.chunks.has(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
  }
  get(x: number, y: number, z: number): number {
    const c = this.chunks.get(chunkKey(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE)));
    if (!c || y < 0 || y >= WORLD_HEIGHT) return AIR;
    return voxelId(c[voxelIndex(x & 15, y, z & 15)]);
  }
}

const big = new Sample(SEED, -6, -6, 5, 5);

describe('generateChunk', () => {
  it('is deterministic and independent of generation order', () => {
    const first = generateChunk(SEED, 2, -3);
    for (const [cx, cz] of [[3, -3], [1, -4], [2, -2], [40, 40]]) generateChunk(SEED, cx, cz);
    generateChunk(SEED + 1, 2, -3);
    expect(generateChunk(SEED, 2, -3)).toEqual(first);
    expect(generateChunk(SEED + 1, 2, -3)).not.toEqual(first);
    expect(big.chunks.get(chunkKey(2, -3))).toEqual(first);
  });

  it('has a corestone floor and nothing but known blocks', () => {
    const corestone = blockId('corestone');
    for (const voxels of big.chunks.values()) {
      let bad = 0;
      for (let i = 0; i < CHUNK_SIZE * CHUNK_SIZE; i++) if (voxels[i] !== corestone) bad++;
      for (let i = 0; i < voxels.length; i++) if (voxelId(voxels[i]) >= BLOCKS.length) bad++;
      expect(bad).toBe(0);
    }
  });

  it('continues trees across chunk borders', () => {
    let checked = 0;
    for (let cx = -6; cx <= 4; cx++) {
      const x = cx * CHUNK_SIZE + 15;
      for (let z = -96; z < 96; z++) {
        for (let y = SEA_LEVEL; y < WORLD_HEIGHT - 2; y++) {
          // The top of a trunk under its crown (boughs and leafless snags have no crown to continue).
          if (!LOGS.has(big.get(x, y, z)) || !LOGS.has(big.get(x, y - 1, z)) || !LEAVES.has(big.get(x, y + 1, z))) continue;
          // The crown around the top of a trunk on the border reaches into the next chunk.
          expect(big.get(x + 1, y, z), `crown of the tree at ${x},${y},${z}`).not.toBe(AIR);
          expect(big.get(x - 1, y, z)).not.toBe(AIR);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(3);
  });

  it('never leaves water hanging over or beside air', () => {
    let water = 0;
    for (let x = -95; x < 79; x++) {
      for (let z = -95; z < 79; z++) {
        for (let y = 1; y <= SEA_LEVEL; y++) {
          if (big.get(x, y, z) !== WATER) continue;
          water++;
          const open = big.get(x, y - 1, z) === AIR || big.get(x + 1, y, z) === AIR || big.get(x - 1, y, z) === AIR
            || big.get(x, y, z + 1) === AIR || big.get(x, y, z - 1) === AIR;
          if (open) throw new Error(`water at ${x},${y},${z} touches air`);
        }
      }
    }
    expect(water).toBeGreaterThan(500);
  });

  it('places every ore inside its band at roughly the configured density', () => {
    const counts = new Map<number, number>();
    const expected = new Map<number, number>();
    for (const vein of ORE_VEINS) {
      counts.set(blockId(vein.block), 0);
      let sum = 0;
      for (let cz = -6; cz <= 5; cz++) for (let cx = -6; cx <= 5; cx++) sum += vein.veinsPerChunk * vein.veinSize * (vein.biomes?.[biomeAt(SEED, cx * 16 + 8, cz * 16 + 8)] ?? 1);
      expected.set(blockId(vein.block), sum);
    }
    const bands = new Map(ORE_VEINS.map((v) => [blockId(v.block), v]));
    for (const voxels of big.chunks.values()) {
      for (let y = 0; y < WORLD_HEIGHT; y++) {
        for (let i = y * 256; i < (y + 1) * 256; i++) {
          const vein = bands.get(voxels[i]);
          if (!vein) continue;
          if (y < vein.minY || y > vein.maxY) throw new Error(`${vein.block} at y ${y} is outside ${vein.minY}-${vein.maxY}`);
          counts.set(voxels[i], (counts.get(voxels[i]) ?? 0) + 1);
        }
      }
    }
    for (const vein of ORE_VEINS) {
      const id = blockId(vein.block);
      const ratio = (counts.get(id) ?? 0) / (expected.get(id) ?? 1);
      expect(ratio, `${vein.block}: ${counts.get(id)} blocks, ${expected.get(id)} configured`).toBeGreaterThan(1 / 3);
      expect(ratio, vein.block).toBeLessThan(3);
    }
  });

  perfIt('generates a chunk in well under 4 ms', () => {
    // Warm up first: the seed's noise tables, spawn point and spawn ruin are built once per seed and thread.
    for (let i = 0; i < 4; i++) generateChunk(SEED + 7, -20 - i, 3);
    // Best of eight batches, so other work on the machine (parallel test files, other processes) does not count.
    let best = Infinity;
    let total = 0;
    for (let batch = 0; batch < 8; batch++) {
      const t0 = performance.now();
      for (let i = 0; i < 8; i++) generateChunk(SEED + 7, 20 + (i % 4) + batch * 4, 20 + (i >> 2));
      const ms = (performance.now() - t0) / 8;
      best = Math.min(best, ms);
      total += ms;
    }
    console.log(`generateChunk: ${(total / 8).toFixed(2)} ms average over 64 chunks, best batch ${best.toFixed(2)} ms`);
    expect(best).toBeLessThan(4);
  });
});

describe('findSpawn', () => {
  const seeds = ['hearth', 'ember', 'forge', 'anvil', 'kiln', 'bellows', 'slag', 'crucible', 'tinder', 'flux', 'ingot', 'cinder', 'quench', 'tongs'];

  it('is deterministic', () => {
    expect(findSpawn(SEED)).toEqual(findSpawn(SEED));
  });

  it.each(seeds)('seed "%s" starts in dry woodland with wood, stone, clay, gravel, water and wild wheat nearby, and a ruin', (name) => {
    const seed = seedFromString(name);
    const spawn = findSpawn(seed);
    expect(biomeAt(seed, spawn.x, spawn.z)).toBe('woodland');
    const cx = Math.floor(spawn.x / 16);
    const cz = Math.floor(spawn.z / 16);
    const area = new Sample(seed, cx - 4, cz - 4, cx + 4, cz + 4);
    expect(spawn.y).toBeGreaterThan(SEA_LEVEL);
    expect(BLOCKS[area.get(spawn.x, spawn.y - 1, spawn.z)].solid).toBe(true);
    expect(BLOCKS[area.get(spawn.x, spawn.y, spawn.z)].solid).toBe(false);
    expect(area.get(spawn.x, spawn.y + 1, spawn.z)).toBe(AIR);

    const count = { logs: 0, clay: 0, gravel: 0, water: 0, stone: 0, wheat: 0 };
    const wheat = blockId('wild_wheat');
    const ids = { clay: blockId('clay'), gravel: blockId('gravel'), stone: blockId('stone') };
    for (let dz = -48; dz <= 48; dz++) {
      for (let dx = -48; dx <= 48; dx++) {
        if (dx * dx + dz * dz > 48 * 48) continue;
        const x = spawn.x + dx;
        const z = spawn.z + dz;
        expect(area.has(x, z)).toBe(true);
        let depth = -1;
        for (let y = WORLD_HEIGHT - 1; y > 20 && depth < 5; y--) {
          const id = area.get(x, y, z);
          if (id === AIR) continue;
          if (LOGS.has(id)) count.logs++;
          else if (id === WATER) count.water++;
          else if (id === wheat) count.wheat++;
          else if (BLOCKS[id].opaque && !BLOCKS[id].key.endsWith('leaves')) {
            // Only what lies within 5 blocks of the surface counts as easy to reach.
            depth++;
            if (id === ids.clay) count.clay++;
            else if (id === ids.gravel) count.gravel++;
            else if (id === ids.stone) count.stone++;
          }
        }
      }
    }
    expect(count.logs).toBeGreaterThanOrEqual(8);
    expect(count.clay).toBeGreaterThanOrEqual(8);
    expect(count.gravel).toBeGreaterThanOrEqual(12);
    expect(count.water).toBeGreaterThanOrEqual(8);
    expect(count.stone).toBeGreaterThanOrEqual(20);
    expect(count.wheat).toBeGreaterThanOrEqual(3);

    // The Old Works: a ruin's crate cell within RUIN_SPAWN_RADIUS, empty and standing on the ruin's floor.
    const ruin = spawnRuin(seed);
    expect(ruin).not.toBeNull();
    if (!ruin) return;
    const crate = { x: ruin.crateX, y: ruin.floor + 1, z: ruin.crateZ };
    expect(Math.hypot(crate.x - spawn.x, crate.z - spawn.z)).toBeLessThanOrEqual(RUIN_SPAWN_RADIUS);
    const voxels = generateChunk(seed, Math.floor(crate.x / 16), Math.floor(crate.z / 16));
    expect(voxels[voxelIndex(crate.x & 15, crate.y, crate.z & 15)]).toBe(AIR);
    expect(BLOCKS[voxelId(voxels[voxelIndex(crate.x & 15, crate.y - 1, crate.z & 15)])].solid).toBe(true);
    expect(ruinCrateCells(seed, Math.floor(crate.x / 16), Math.floor(crate.z / 16))).toContainEqual(crate);
  });
});
