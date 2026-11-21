/** Tea bushes and coffee shrubs in the world (BREWING_PLAN 3): where they grow, and that chunk order never matters. */
import { describe, expect, it } from 'vitest';
import { seedFromString } from '../core/math';
import { blockId } from '../core/registry';
import { CHUNK_SIZE, WORLD_HEIGHT, voxelId, voxelIndex } from '../core/types';
import { Column, MARSH, WOODLAND, sampleColumn, terrainFor } from './terrain';
import { generateChunk } from './worldgen';

const SEED = seedFromString('hearth');
const TEA = blockId('tea_bush');
const COFFEE = blockId('coffee_shrub');
const GRASS = blockId('grass');
const REGION = 14;

interface Found { biome: number; below: number }
/** Every tea bush and coffee shrub in the square of chunks -REGION..REGION, with the biome of its column and the block under it. */
function scan(seed: number, order: 'forward' | 'reverse'): { tea: Map<string, Found>; coffee: Map<string, Found> } {
  const t = terrainFor(seed);
  const col = new Column();
  const tea = new Map<string, Found>();
  const coffee = new Map<string, Found>();
  const cells: Array<[number, number]> = [];
  for (let cz = -REGION; cz <= REGION; cz++) for (let cx = -REGION; cx <= REGION; cx++) cells.push([cx, cz]);
  if (order === 'reverse') cells.reverse();
  for (const [cx, cz] of cells) {
    const voxels = generateChunk(seed, cx, cz);
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 1; y < WORLD_HEIGHT; y++) {
          const id = voxelId(voxels[voxelIndex(lx, y, lz)]);
          if (id !== TEA && id !== COFFEE) continue;
          const x = cx * CHUNK_SIZE + lx;
          const z = cz * CHUNK_SIZE + lz;
          sampleColumn(t, x, z, col);
          (id === TEA ? tea : coffee).set(`${x},${y},${z}`, { biome: col.biome, below: voxelId(voxels[voxelIndex(lx, y - 1, lz)]) });
        }
      }
    }
  }
  return { tea, coffee };
}

describe('tea bushes and coffee shrubs', () => {
  const forward = scan(SEED, 'forward');

  it('grow in the world, on grass only', () => {
    expect(forward.tea.size).toBeGreaterThan(20);
    expect(forward.coffee.size).toBeGreaterThan(5);
    for (const f of [...forward.tea.values(), ...forward.coffee.values()]) expect(f.below).toBe(GRASS);
  });

  it('put tea in woodland and marsh, and coffee in woodland only', () => {
    for (const f of forward.tea.values()) expect([WOODLAND, MARSH]).toContain(f.biome);
    for (const f of forward.coffee.values()) expect(f.biome).toBe(WOODLAND);
    expect(new Set([...forward.tea.values()].map((f) => f.biome)).size).toBe(2);
  });

  it('are the same whatever order the chunks are generated in', () => {
    const backward = scan(SEED, 'reverse');
    expect([...backward.tea.keys()].sort()).toEqual([...forward.tea.keys()].sort());
    expect([...backward.coffee.keys()].sort()).toEqual([...forward.coffee.keys()].sort());
  });

  it('differ between worlds', () => {
    const other = scan(seedFromString('another world'), 'forward');
    expect([...other.tea.keys()].sort()).not.toEqual([...forward.tea.keys()].sort());
  });
});
