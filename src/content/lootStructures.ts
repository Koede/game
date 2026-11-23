/**
 * What the crates of the generated structures hold (docs/SYNERGY_PLAN.md section 4), one table per structure type. Each
 * is tied to the age of its structure: it may hold things up to one age ahead (a teaser, never a skip), and content tests
 * hold every entry to that. Their `tier` is only the nearest of the two Old Works tiers; the structure key selects them.
 */
import type { LootEntry, LootTableSpec } from '../core/types';

const table = (tier: 'near' | 'deep', rolls: [number, number], entries: LootEntry[]): LootTableSpec => ({ tier, rolls, entries });
const e = (item: string, count: number | [number, number], weight: number): LootEntry => ({ item, count, weight });

export const STRUCTURE_LOOT: Record<string, LootTableSpec> = {
  charcoal_camp: table('near', [3, 4], [
    e('charcoal', [4, 8], 14), e('fiber', [3, 6], 10), e('hide', [1, 2], 8), e('flint', [2, 4], 8), e('flint_axe', 1, 3),
    e('wooden_pickaxe', 1, 3), e('torch', [3, 6], 6), e('wildberries', [2, 4], 5),
  ]),
  hollow_oak_shrine: table('near', [3, 4], [
    e('glass_vial', [1, 3], 12), e('vial_loam', 1, 8), e('vial_cinder', 1, 6), e('field_notebook', 1, 4), e('wildberries', [2, 5], 8),
    e('cord', [2, 4], 6), e('torch', [2, 4], 5),
  ]),
  lumber_mill: table('near', [3, 5], [
    e('plank', [8, 16], 14), e('cord', [3, 6], 10), e('bronze_ingot', [1, 3], 8), e('stick', [6, 12], 8), e('bronze_axe', 1, 3),
    e('leather', [1, 2], 5), e('drive_shaft', 1, 3),
  ]),
  glassblower_kiln: table('near', [3, 5], [
    e('glass_beaker', [1, 3], 12), e('silica', [2, 5], 10), e('glass_vial', [2, 4], 10), e('sand', [6, 12], 8), e('brick', [4, 8], 8),
    e('vial_clarity', 1, 4), e('glass', [2, 5], 6),
  ]),
  caravan_well: table('near', [3, 5], [
    e('water_pail', 1, 8), e('wheat_seeds', [3, 6], 10), e('potato', [2, 4], 8), e('bread', [1, 3], 8), e('cord', [2, 5], 6),
    e('bronze_pickaxe', 1, 2), e('clay', [3, 6], 8),
  ]),
  oil_derrick: table('deep', [3, 5], [
    e('crude_canister', 1, 8), e('iron_ingot', [2, 4], 10), e('steel_plate', 1, 4), e('scrap_metal', [2, 5], 10), e('fluid_pipe', [2, 4], 6),
    e('asphalt', [3, 6], 6), e('lubricant_canister', 1, 3),
  ]),
  hunters_lodge: table('near', [3, 5], [
    e('hide', [2, 4], 12), e('raw_mutton', [2, 4], 10), e('cooked_mutton', [1, 3], 8), e('padded_coat', 1, 3), e('torch', [3, 6], 8),
    e('coal', [3, 6], 8), e('flint_pickaxe', 1, 3),
  ]),
  frost_cairn: table('near', [3, 4], [
    e('vial_frost', 1, 8), e('glass_vial', [2, 3], 10), e('bronze_rod', 1, 3), e('ice', [4, 8], 8), e('hide', [1, 2], 6), e('vial_ward', 1, 3),
  ]),
  frozen_foundry: table('deep', [3, 5], [
    e('iron_ingot', [2, 4], 10), e('coke', [3, 6], 10), e('firebrick', [3, 6], 10), e('iron_plate', [1, 2], 5), e('scrap_metal', [2, 4], 8),
    e('iron_pickaxe', 1, 2),
  ]),
  basalt_forge_pit: table('deep', [3, 5], [
    e('iron_ore', [3, 6], 10), e('coke', [3, 6], 10), e('steel_plate', 1, 4), e('firebrick', [2, 5], 8), e('sulfur', [2, 4], 6), e('ember_core', 1, 4),
  ]),
  ember_altar: table('near', [3, 4], [
    e('vial_cinder', [1, 2], 12), e('ember_core', 1, 6), e('focus_kindle', 1, 3), e('glass_vial', [2, 3], 8), e('charcoal', [3, 6], 6), e('vial_ash', 1, 4),
  ]),
  slag_depot: table('deep', [3, 6], [
    e('steel_plate', [1, 2], 6), e('copper_coil', [1, 2], 6), e('scrap_metal', [3, 6], 12), e('iron_ingot', [2, 4], 8), e('coal', [4, 8], 8),
    e('copper_wire', [3, 6], 6),
  ]),
  peat_stilt_hut: table('near', [3, 4], [
    e('peat', [4, 8], 12), e('tea_cutting', 1, 4), e('coffee_cutting', 1, 3), e('wildberries', [2, 5], 8), e('fiber', [3, 6], 8),
    e('clay', [3, 6], 8), e('dried_tea', [1, 3], 5),
  ]),
  sunken_alchemist_tower: table('near', [3, 4], [
    e('vial_brook', 1, 8), e('vial_clarity', 1, 4), e('glass_vial', [2, 4], 10), e('field_notebook', 1, 4), e('vis_rod', 1, 3), e('vial_loam', 1, 6),
  ]),
  pump_house: table('near', [3, 5], [
    e('bronze_ingot', [1, 3], 8), e('item_pipe', [2, 4], 8), e('copper_wire', [2, 4], 4), e('cord', [2, 4], 8), e('brick', [4, 8], 8),
    e('peat', [3, 6], 6),
  ]),
  waystone: table('near', [2, 3], [
    e('glass_vial', [1, 2], 8), e('vial_cinder', 1, 4), e('vial_loam', 1, 4), e('vial_brook', 1, 4), e('vial_gale', 1, 4), e('torch', [2, 4], 6),
    e('field_notebook', 1, 3),
  ]),
  old_home: table('near', [3, 5], [
    e('bread', [1, 3], 8), e('wheat_seeds', [3, 6], 8), e('torch', [3, 6], 8), e('cord', [2, 4], 6), e('plank', [6, 12], 8),
    e('flint_axe', 1, 3), e('hide', [1, 2], 6), e('field_notebook', 1, 3), e('coal', [3, 5], 6),
  ]),
  old_factory: table('deep', [4, 6], [
    e('scrap_metal', [3, 6], 14), e('iron_ingot', [2, 4], 8), e('steel_plate', [1, 2], 5), e('copper_coil', 1, 4), e('firebrick', [3, 6], 8),
    e('coke', [3, 6], 6), e('item_pipe', [2, 4], 6), e('iron_plate', [1, 3], 6), e('bellows', 1, 3),
  ]),
  chem_lab: table('near', [4, 6], [
    e('glass_beaker', [2, 4], 12), e('glass_vial', [2, 4], 10), e('spirit_beaker', 1, 5), e('wash_beaker', 1, 6), e('empty_canister', [1, 2], 5),
    e('vial_clarity', 1, 5), e('field_notebook', 1, 6), e('glass', [2, 5], 6), e('sulfur', [1, 3], 4),
  ]),
};
