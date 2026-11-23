/**
 * The Old Works loot crates. Generated terrain leaves a ruin's crate cell empty; the World places the crate
 * through its normal entity API when the chunk first loads (an ordinary `setEntity` + `setVoxel` with source
 * 'load'), so the simulation picks it up like any crate it finds in a save. The placement is remembered as an
 * edit, so a crate that was emptied or broken never comes back.
 */
import { AMBIENT_TEMP_C, CRATE_SIZE, RUIN_DEEP_BELOW_SEA, RUIN_DEEP_DISTANCE } from '../core/constants';
import { hash32, mulberry32 } from '../core/math';
import { STRUCTURE_LOOT, blockId, lootTable, rollLoot } from '../core/registry';
import { SEA_LEVEL, makeVoxel, type BlockEntity, type LootTier, type Slot, type Voxel } from '../core/types';

export const CRATE_VOXEL: Voxel = makeVoxel(blockId('crate'));

/** 'deep' far from spawn or well below sea level, else 'near' (spec 14). */
export function ruinLootTier(x: number, y: number, z: number, spawn: { x: number; z: number }): LootTier {
  return Math.hypot(x - spawn.x, z - spawn.z) > RUIN_DEEP_DISTANCE || y <= SEA_LEVEL - RUIN_DEEP_BELOW_SEA ? 'deep' : 'near';
}

/** The ruin crate's 27 slots, rolled from the seed and its position. */
export function ruinCrateSlots(seed: number, x: number, y: number, z: number, tier: LootTier): Slot[] {
  const slots: Slot[] = rollLoot(lootTable(tier), mulberry32(hash32(seed, x, y, z)));
  while (slots.length < CRATE_SIZE) slots.push(null);
  return slots.slice(0, CRATE_SIZE);
}

/**
 * A crate entity with every field the simulation's own crates carry (src/sim createMachine), so views and
 * saves treat it exactly like a crate the player built.
 */
export function ruinCrateEntity(seed: number, x: number, y: number, z: number, spawn: { x: number; z: number }): BlockEntity {
  return {
    kind: 'crate', x, y, z, on: true, slots: ruinCrateSlots(seed, x, y, z, ruinLootTier(x, y, z, spawn)),
    progress: 0, recipe: null, fuelJ: 0, storedJ: 0, coreC: AMBIENT_TEMP_C, hotS: 0, warned: false, alarmS: 0,
    depthY: y, halted: '', availW: 0, outW: 0, demandW: 0, f: 0,
  };
}

/** A generated structure's crate: the same entity, rolled from the structure's own table (docs/SYNERGY_PLAN.md). */
export function structureCrateEntity(seed: number, x: number, y: number, z: number, key: string): BlockEntity {
  const slots: Slot[] = rollLoot(STRUCTURE_LOOT[key], mulberry32(hash32(seed, x, y, z)));
  while (slots.length < CRATE_SIZE) slots.push(null);
  return {
    kind: 'crate', x, y, z, on: true, slots: slots.slice(0, CRATE_SIZE),
    progress: 0, recipe: null, fuelJ: 0, storedJ: 0, coreC: AMBIENT_TEMP_C, hotS: 0, warned: false, alarmS: 0,
    depthY: y, halted: '', availW: 0, outW: 0, demandW: 0, f: 0,
  };
}
