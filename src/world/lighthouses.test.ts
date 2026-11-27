import { describe, expect, it } from 'vitest';
import { blockId, blockOf } from '../core/registry';
import { CHUNK_SIZE, CHUNK_VOLUME, voxelIndex } from '../core/types';
import { GALLERY_Y, LIGHTHOUSE, LIGHTHOUSE_KEY, PLINTH_Y, lighthouseFloor } from './lighthouses';
import { STRUCTURE_DEFS } from './structureDefs';
import { drawStructure, squareStructure, type StructureSite } from './structures';
import { WATER_TOP } from './terrain';

/** The lighthouse drawn at chunk (0, 0) on flat stone, floor at y 40. */
function drawn(): { at: (x: number, y: number, z: number) => string } {
  const voxels = new Uint16Array(CHUNK_VOLUME);
  const stone = blockId('stone');
  for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) for (let y = 1; y <= 40; y++) voxels[voxelIndex(x, y, z)] = stone;
  const site: StructureSite = { def: LIGHTHOUSE, x0: 2, z0: 2, floor: 40, biome: 0, bits: 0x1234, crateX: 2 + LIGHTHOUSE.crate[0], crateZ: 2 + LIGHTHOUSE.crate[1] };
  drawStructure(voxels, 0, 0, site);
  // Local (x, y, z) of the structure, y = 0 the first block above the floor.
  return { at: (x, y, z) => blockOf(voxels[voxelIndex(2 + x, 41 + y, 2 + z)]).key };
}

describe('keepers lighthouses', () => {
  it('is not a biome structure type, so no older world changes its structures', () => {
    expect(STRUCTURE_DEFS.some((d) => d.key === LIGHTHOUSE_KEY)).toBe(false);
  });

  it('stands on some shores of every seed tried, only in squares without another structure', () => {
    let found = 0;
    for (const seed of [1, 2, 3, 42]) {
      for (let sz = -8; sz < 8; sz++) {
        for (let sx = -8; sx < 8; sx++) {
          const s = squareStructure(seed, sx, sz);
          if (s?.def.key !== LIGHTHOUSE_KEY) continue;
          found++;
          expect(s.floor).toBeGreaterThan(WATER_TOP);
          // The lamp's plinth top stands well above the water.
          expect(s.floor + 1 + PLINTH_Y + 1).toBeGreaterThanOrEqual(WATER_TOP + 6);
        }
      }
    }
    expect(found).toBeGreaterThanOrEqual(8);
  });

  it('climbs a spiral stair with head room from the door to the gallery, and leaves the plinth top free for a lamp', () => {
    const { at } = drawn();
    expect(at(3, 0, 0)).toBe('air');
    expect(at(3, 1, 0)).toBe('air');
    const ring = [[3, 2], [4, 2], [4, 3], [4, 4], [3, 4], [2, 4], [2, 3], [2, 2]];
    for (let i = 0; i < GALLERY_Y; i++) {
      const [x, z] = ring[i % 8];
      expect(at(x, i, z), `step ${i}`).toBe('plank');
      // Standing on step i, the feet and head cells are open.
      expect(at(x, i + 1, z), `feet ${i}`).toBe('air');
      expect(at(x, i + 2, z), `head ${i}`).toBe('air');
    }
    // Off the last step onto the gallery floor, inside the lantern room.
    expect(blockOf(blockId(at(4, GALLERY_Y, 4))).solid).toBe(true);
    expect(at(4, GALLERY_Y + 1, 4)).toBe('air');
    expect(at(3, PLINTH_Y, 3)).toBe('stone_brick');
    expect(at(3, PLINTH_Y + 1, 3)).toBe('air');
    expect(at(3, PLINTH_Y + 3, 3)).toBe('brick');
    expect(at(1, PLINTH_Y, 3)).toBe('glass');
    // The doorway from the lantern room onto the gallery.
    expect(at(3, PLINTH_Y, 1)).toBe('air');
  });

  it('wants dry, level, low ground with open water close by', () => {
    const dry = { height: WATER_TOP + 2, wet: false, dry: true };
    const water = { height: WATER_TOP - 3, wet: true, dry: false };
    // Water to the south of z = 6.
    const shore = (_x: number, z: number) => (z > 6 ? water : dry);
    expect(lighthouseFloor(0, 0, shore)).toBe(WATER_TOP + 2);
    expect(lighthouseFloor(0, 0, () => dry)).toBe(-1);
    expect(lighthouseFloor(0, 0, () => ({ ...dry, height: WATER_TOP + 12 }))).toBe(-1);
    expect(lighthouseFloor(0, 4, shore)).toBe(-1);
  });
});
