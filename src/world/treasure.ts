/**
 * Treasure maps (docs/api/treasure.md): a loot item that points at a landmark and a chest hidden a few blocks from
 * it. Everything is a pure function of `(world seed, map serial, age)`, so a map needs only a serial and an age on the
 * item stack; the chest's place and contents are recomputed whenever they are needed and never saved.
 *
 * The caller supplies the landmarks (ruins, caves, ...) the world knows about; nothing here reads voxels. Chest
 * contents scale with the age the map was found in (0 = Ember ... 5 = Star), so a map looted late pays late.
 */
import { hashFloat } from '../core/math';

export interface Landmark { id: string; name: string; x: number; z: number }
export interface TreasurePick { item: string; count: number }
export interface TreasureMap {
  serial: number;
  age: number;
  landmark: Landmark;
  /** Where the chest is buried, `offset` blocks from the landmark; y is found by the world (`surfaceY`). */
  x: number;
  z: number;
  compass: string;
  distance: number;
  loot: TreasurePick[];
}

/** Chest distance from its landmark: close enough to find by the clue, far enough to need a dig. */
export const TREASURE_OFFSET_MIN = 6;
export const TREASURE_OFFSET_MAX = 22;
export const MAX_AGE = 5;

/** Item pools per age. Every key is a real item (treasure.test.ts checks). Each pool is worth more than the last. */
export const TREASURE_POOLS: ReadonlyArray<ReadonlyArray<{ item: string; min: number; max: number }>> = [
  [{ item: 'copper_ingot', min: 3, max: 6 }, { item: 'tin_ingot', min: 2, max: 4 }, { item: 'charcoal', min: 4, max: 8 }, { item: 'flint', min: 3, max: 6 }],
  [{ item: 'bronze_ingot', min: 3, max: 6 }, { item: 'bronze_plate', min: 2, max: 4 }, { item: 'leather', min: 2, max: 4 }, { item: 'glass', min: 2, max: 5 }],
  [{ item: 'iron_ingot', min: 4, max: 8 }, { item: 'iron_plate', min: 2, max: 5 }, { item: 'coal', min: 6, max: 12 }, { item: 'leather', min: 3, max: 6 }],
  [{ item: 'steel_ingot', min: 3, max: 6 }, { item: 'copper_coil', min: 2, max: 4 }, { item: 'steel_plate', min: 2, max: 4 }, { item: 'iron_plate', min: 4, max: 8 }],
  [{ item: 'steel_plate', min: 4, max: 8 }, { item: 'circuit', min: 2, max: 4 }, { item: 'aluminum_ingot', min: 4, max: 8 }, { item: 'fused_quartz', min: 2, max: 4 }],
  [{ item: 'circuit', min: 4, max: 8 }, { item: 'aluminum_ingot', min: 8, max: 14 }, { item: 'fused_quartz', min: 4, max: 8 }, { item: 'steel_plate', min: 8, max: 14 }],
];

const SALT_LANDMARK = 11;
const SALT_ANGLE = 12;
const SALT_DIST = 13;
const SALT_LOOT = 14;

const COMPASS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** 8-way compass word for the direction from (fx,fz) to (tx,tz); +x east, +z south. */
export function compassWord(fx: number, fz: number, tx: number, tz: number): string {
  const a = Math.atan2(tz - fz, tx - fx);
  return COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8];
}

/** Build map number `serial` of this world, found in `age`. Needs at least one landmark. */
export function makeTreasureMap(seed: number, serial: number, age: number, landmarks: readonly Landmark[]): TreasureMap | null {
  if (landmarks.length === 0) return null;
  const a = Math.min(MAX_AGE, Math.max(0, Math.floor(age)));
  const landmark = landmarks[Math.floor(hashFloat(seed, serial, SALT_LANDMARK) * landmarks.length)];
  const angle = hashFloat(seed, serial, SALT_ANGLE) * Math.PI * 2;
  const offset = TREASURE_OFFSET_MIN + hashFloat(seed, serial, SALT_DIST) * (TREASURE_OFFSET_MAX - TREASURE_OFFSET_MIN);
  const x = Math.round(landmark.x + Math.cos(angle) * offset);
  const z = Math.round(landmark.z + Math.sin(angle) * offset);
  const pool = TREASURE_POOLS[a];
  const loot: TreasurePick[] = pool.map((p, i) => ({
    item: p.item, count: p.min + Math.floor(hashFloat(seed, serial, SALT_LOOT, i) * (p.max - p.min + 1)),
  }));
  // Always at least two kinds, sometimes all four: drop up to two entries by hash, never the first.
  for (let i = pool.length - 1; i >= 2; i--) if (hashFloat(seed, serial, SALT_LOOT + 100, i) < 0.4) loot.splice(i, 1);
  return {
    serial, age: a, landmark, x, z, loot,
    compass: compassWord(landmark.x, landmark.z, x, z),
    distance: Math.round(Math.hypot(x - landmark.x, z - landmark.z)),
  };
}

/** The clue printed on the map: names the landmark, the way and the pace count, never the coordinates. */
export function treasureClue(map: TreasureMap): string {
  return `Dig ${map.distance} paces ${map.compass} of ${map.landmark.name}.`;
}

/** True once the player stands within `radius` (horizontal) of the buried chest: the chest may be opened then. */
export function nearTreasure(map: TreasureMap, px: number, pz: number, radius = 3): boolean {
  return Math.hypot(px - map.x, pz - map.z) <= radius;
}

/** Hint line while searching: how far and which way from where the player is. */
export function treasureHint(map: TreasureMap, px: number, pz: number): string {
  const d = Math.hypot(map.x - px, map.z - pz);
  if (d <= 3) return 'The ground here feels disturbed. Dig!';
  const word = d < 12 ? 'warm' : d < 40 ? 'cool' : 'cold';
  return `${compassWord(px, pz, map.x, map.z)}, ${word}`;
}
