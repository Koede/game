/**
 * The authored content of Hearthwatt. Nothing outside src/core/registry.ts should import from here: the registry
 * resolves these specs into the lookup tables (BLOCKS, ITEMS, RECIPES, MACHINES, ...) everybody else reads.
 */
export { BLOCK_SPECS } from './blocks';
export { ITEM_SPECS } from './items';
export { RECIPE_SPECS } from './recipes';
export { AGES, FURNACE_TIERS, MACHINE_SPECS } from './tech';
export { OBJECTIVES } from './objectives';
export { ORE_VEINS } from './oreVeins';
export { CREATURE_SPECS } from './creatures';
export { AUTOMATON_SPECS } from './automatons';
export { LOOT_TABLES } from './loot';
export { STRUCTURE_LOOT } from './lootStructures';
export { FLUID_SPECS } from './fluids';
export { MOULD_SPECS, CAST_METAL_SPECS } from './mouldsHand';
