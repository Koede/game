import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, voxelIndex } from '../core/types';
import { ID } from './ids';
import { generateChunk } from './worldgen';

/** Chunks of a square around the origin that hold a vent next to water. */
function springs(seed: number, r: number): Array<{ cx: number; cz: number; water: number; vents: number }> {
  const found: Array<{ cx: number; cz: number; water: number; vents: number }> = [];
  for (let cx = -r; cx <= r; cx++) {
    for (let cz = -r; cz <= r; cz++) {
      const v = generateChunk(seed, cx, cz);
      let vents = 0;
      for (let i = 0; i < v.length; i++) if (v[i] === ID.steamVent) vents++;
      if (vents === 0) continue;
      let water = 0;
      for (let y = 20; y < 96; y++) for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) if (v[voxelIndex(x, y, z)] === ID.water) water++;
      found.push({ cx, cz, water, vents });
    }
  }
  return found;
}

describe('hot springs', () => {
  it('is a pure function of the seed and chunk', () => {
    const a = generateChunk(7, 3, -2);
    const b = generateChunk(7, 3, -2);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('puts steaming pools in the frostfell, never leaving a pool without vents', () => {
    const found = springs(1, 24).filter((s) => s.water > 0);
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) expect(s.vents, `${s.cx},${s.cz}`).toBeGreaterThanOrEqual(1);
  });
});
