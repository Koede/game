/**
 * Picks the place a new world starts at: dry Woodland with wood, water, clay and gravel within a short
 * walk. Everything is judged from the pure terrain functions, never by editing the world.
 */
import {
  Column, LIQUID_NONE, LIQUID_WATER, SURFACE_CLAY, SURFACE_GRASS, SURFACE_GRAVEL, WATER_TOP, WOODLAND,
  caveMouth, sampleColumn, surfaceKind, terrainFor, type Terrain,
} from './terrain';
import { TREE_CELL, treeInCell, type TreeSite } from './flora';

/** Resources must lie within this many blocks of the spawn point. */
export const SPAWN_RESOURCE_RADIUS = 48;
const SURVEY = 44;
const col = new Column();
const tree: TreeSite = { x: 0, z: 0, base: 0, pine: false, trunk: 0, bits: 0 };

function goodSpot(t: Terrain, x: number, z: number): boolean {
  sampleColumn(t, x, z, col);
  if (col.biome !== WOODLAND || col.wWood < 0.95 || col.liquid !== LIQUID_NONE) return false;
  if (col.height < WATER_TOP + 2 || col.height > 52) return false;
  if (surfaceKind(t, col, x, z) !== SURFACE_GRASS || caveMouth(t, x, z)) return false;

  let logs = 0;
  const g0x = Math.floor((x - SURVEY) / TREE_CELL);
  const g1x = Math.floor((x + SURVEY) / TREE_CELL);
  const g0z = Math.floor((z - SURVEY) / TREE_CELL);
  const g1z = Math.floor((z + SURVEY) / TREE_CELL);
  for (let gz = g0z; gz <= g1z; gz++) {
    for (let gx = g0x; gx <= g1x; gx++) {
      if (!treeInCell(t, gx, gz, tree)) continue;
      const d = Math.hypot(tree.x - x, tree.z - z);
      // Not inside a trunk and not under a crown that could close over the player's head.
      if (d < 4) return false;
      if (d <= SURVEY) logs += tree.trunk;
    }
  }
  if (logs < 24) return false;

  let water = 0;
  let clay = 0;
  let gravel = 0;
  for (let dz = -SURVEY; dz <= SURVEY; dz += 2) {
    for (let dx = -SURVEY; dx <= SURVEY; dx += 2) {
      if (dx * dx + dz * dz > SURVEY * SURVEY) continue;
      sampleColumn(t, x + dx, z + dz, col);
      const liquid: number = col.liquid;
      if (liquid === LIQUID_WATER) water++;
      const kind = surfaceKind(t, col, x + dx, z + dz);
      // Only count what can be dug without diving deep.
      if (col.height < WATER_TOP - 2) continue;
      if (kind === SURFACE_CLAY) clay++;
      else if (kind === SURFACE_GRAVEL) gravel++;
    }
  }
  return water >= 10 && clay >= 6 && gravel >= 6;
}

const cache = new Map<number, { x: number; y: number; z: number }>();

/** Block the player's feet start in: x, z are block coordinates (stand at +0.5), y is the first free block. */
export function findSpawn(seed: number): { x: number; y: number; z: number } {
  const known = cache.get(seed);
  if (known) return { ...known };
  const t = terrainFor(seed);
  let found: { x: number; y: number; z: number } | null = null;
  // Square rings around the origin, 12 blocks apart, always walked in the same order.
  for (let ring = 0; ring <= 60 && !found; ring++) {
    for (let j = -ring; j <= ring && !found; j++) {
      for (let i = -ring; i <= ring && !found; i++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== ring) continue;
        const x = i * 12 + 6;
        const z = j * 12 + 6;
        if (goodSpot(t, x, z)) found = { x, y: sampleColumn(t, x, z, col).height + 1, z };
      }
    }
  }
  if (!found) {
    sampleColumn(t, 6, 6, col);
    found = { x: 6, y: Math.max(col.height, WATER_TOP) + 1, z: 6 };
  }
  if (cache.size >= 8) cache.delete(cache.keys().next().value as number);
  cache.set(seed, found);
  return { ...found };
}
