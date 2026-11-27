import { describe, expect, it } from 'vitest';
import { CHUNK_SIZE, voxelId, voxelIndex, type IWorld } from '../core/types';
import { caveBandAt, caveRoomPlan, findCaveCamp } from './caveRooms';
import { caveLairSite, chunkHoldsCamp, lairKey } from './caveLair';
import { generateChunk } from './worldgen';

const SEEDS = [11, 2026, 77123];

/** Just enough world for the lair: one generated chunk's voxels. */
const chunkWorld = (seed: number, cx: number, cz: number): IWorld => {
  const v = generateChunk(seed, cx, cz);
  return {
    isLoaded: () => true,
    getVoxel: (x: number, y: number, z: number) => v[voxelIndex(x - cx * CHUNK_SIZE, y, z - cz * CHUNK_SIZE)],
    getBlock: () => ({ solid: true, liquid: null }),
  } as unknown as IWorld;
};

describe('the boss holds real deep cave camps', () => {
  it('sits beside a deep camp crate chosen by the seed, and nowhere else', () => {
    let held = 0;
    let free = 0;
    for (const seed of SEEDS) {
      for (let cz = -10; cz < 10; cz++) {
        for (let cx = -10; cx < 10; cx++) {
          if (caveRoomPlan(seed, cx, cz)?.kind !== 'camp') continue;
          const w = chunkWorld(seed, cx, cz);
          const camp = findCaveCamp(seed, cx, cz, (x, y, z) => voxelId(w.getVoxel(x, y, z)));
          const site = caveLairSite(w, seed, cx, cz);
          if (!camp) continue;
          if (caveBandAt(camp.y) === 'deep' && chunkHoldsCamp(seed, cx, cz)) {
            held++;
            expect(site?.key).toBe(lairKey(cx, cz));
            expect(Math.floor(site!.x)).toBe(camp.x);
            expect(site!.floor).toBe(camp.y - 1);
            expect(caveLairSite(chunkWorld(seed, cx, cz), seed, cx, cz)).toEqual(site);
          } else free++;
        }
      }
    }
    expect(held).toBeGreaterThan(0);
    expect(free).toBeGreaterThan(0);
  });
});
