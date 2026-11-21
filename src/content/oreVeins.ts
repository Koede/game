/**
 * Ore veins for world generation (spec 2.6). Nothing is exclusive to a biome: every ore exists everywhere,
 * the multipliers only make some biomes richer. Shallow, common ores first; the deep ones last.
 */
import type { BiomeKey, OreVeinSpec } from '../core/types';

function vein(block: string, minY: number, maxY: number, veinsPerChunk: number, veinSize: number, biomes?: Partial<Record<BiomeKey, number>>): OreVeinSpec {
  return biomes ? { block, minY, maxY, veinsPerChunk, veinSize, biomes } : { block, minY, maxY, veinsPerChunk, veinSize };
}

export const ORE_VEINS: OreVeinSpec[] = [
  vein('coal_ore', 20, 70, 5, 8, { marsh: 1.5 }),
  vein('copper_ore', 16, 60, 4, 6, { dunes: 2 }),
  vein('tin_ore', 30, 66, 2.5, 5),
  vein('limestone', 22, 52, 1.5, 14),
  // The marsh is rich in bog iron and in coal laid down from old peat.
  vein('iron_ore', 6, 46, 4, 6, { marsh: 1.5 }),
  vein('sulfur_ore', 4, 34, 1, 5, { scar: 3 }),
  vein('oil_shale', 10, 40, 1, 8, { dunes: 2, scar: 2 }),
  vein('quartz_ore', 6, 38, 1.5, 5),
  vein('bauxite', 18, 46, 1.5, 6, { dunes: 2 }),
  vein('wolframite', 3, 20, 0.7, 5, { frostfell: 2 }),
  vein('spodumene', 3, 22, 0.6, 5, { dunes: 2 }),
  vein('pitchblende', 2, 14, 0.5, 4, { scar: 3 }),
];
