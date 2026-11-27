/**
 * What the crates of the Old Works ruins hold (spec 14). src/world rolls a table with `rollLoot` from the registry
 * when it places a ruin's crate, seeded from the world seed and the crate's position.
 *
 * 'near' ruins (on the surface, within RUIN_DEEP_DISTANCE of spawn) give modest Ember Age help: the stuff of a first
 * furnace, a first fire and a first field, now and then a bucket or a flint tool. 'deep' ruins (far away, or buried
 * below the sea) are richer: metal, cable and the occasional thermopile - never anything past the Forge Age, so a
 * lucky find speeds the climb without skipping it (content tests hold both tables to that).
 */
import type { ItemStack, LootRarity, LootTableSpec } from '../core/types';
import { LEGENDARIES, LEGENDARY_TABLES, legendaryTableId } from './legendary';

export const LOOT_TABLES: LootTableSpec[] = [
  {
    id: 'ruin_near',
    tier: 'near',
    rolls: [3, 5],
    entries: [
      { item: 'rubble', count: [4, 8], weight: 14 },
      { item: 'clay', count: [2, 4], weight: 12 },
      { item: 'coal', count: [2, 5], weight: 10 },
      { item: 'copper_ore', count: [2, 4], weight: 10 },
      { item: 'tin_ore', count: [1, 3], weight: 8 },
      { item: 'wheat_seeds', count: [2, 4], weight: 8 },
      { item: 'flint', count: [1, 3], weight: 6 },
      { item: 'charcoal', count: [2, 4], weight: 6 },
      { item: 'torch', count: [2, 4], weight: 6 },
      { item: 'potato', count: [1, 3], weight: 5 },
      { item: 'pail', count: 1, weight: 3 },
      { item: 'flint_pickaxe', count: 1, weight: 2 },
      { item: 'flint_axe', count: 1, weight: 2 },
      { item: 'flint_shovel', count: 1, weight: 2 },
      { item: 'treasure_map', count: 1, weight: 2 },
    ],
  },
  {
    id: 'ruin_deep',
    tier: 'deep',
    rolls: [3, 6],
    entries: [
      { item: 'coal', count: [4, 8], weight: 10 },
      { item: 'iron_ore', count: [2, 5], weight: 10 },
      { item: 'copper_ingot', count: [2, 4], weight: 8 },
      { item: 'iron_ingot', count: [1, 3], weight: 6 },
      { item: 'treasure_map', count: 1, weight: 3 },
      { item: 'tin_ingot', count: [1, 3], weight: 6 },
      { item: 'copper_wire', count: [3, 6], weight: 6 },
      { item: 'copper_cable', count: [3, 6], weight: 6 },
      { item: 'firebrick', count: [2, 6], weight: 6 },
      { item: 'bronze_ingot', count: [1, 3], weight: 5 },
      { item: 'wheat_seeds', count: [3, 6], weight: 4 },
      { item: 'lamp', count: 1, weight: 3 },
      { item: 'thermopile', count: 1, weight: 2 },
      { item: 'bronze_bucket', count: 1, weight: 2 },
      { item: 'bronze_pickaxe', count: 1, weight: 2 },
      // Lucky finds: a tool that already carries an enchant (the altar is the other way to get one).
      { item: 'bronze_pickaxe', count: 1, weight: 1, rarity: 'rare', enchants: { magnet: 1 } },
      { item: 'bronze_axe', count: 1, weight: 1, rarity: 'rare', quality: 1, enchants: { bounty: 1 } },
      // Hidden research (src/magic/scrolls.ts): rare, and optional like all magic.
      { item: 'scroll_ledger', count: 1, weight: 1 },
      { item: 'scroll_verses', count: 1, weight: 1 },
      { item: 'scroll_margin', count: 1, weight: 1 },
    ],
  },
];

/**
 * Rarity of items that carry one (docs/plans/loot-and-containers.md). Data about the item, never a field of a stack: names and
 * tooltips colour by it (white common, green fine, blue rare, gold legendary), and the ground-item beam honours it. Items not listed are common.
 */
export const ITEM_RARITY: Readonly<Record<string, LootRarity>> = {
  orrins_spare_pick: 'legendary',
  emberfang: 'legendary',
  gale_reed: 'legendary',
  lanternblade: 'legendary',
  quiet_hammer: 'legendary',
  tidebrand: 'legendary',
  rootsong: 'legendary',
  starcleaver: 'legendary',
  scroll_ledger: 'rare',
  scroll_verses: 'rare',
  scroll_margin: 'rare',
  plan_kiln_house: 'rare',
  plan_cistern: 'rare',
  plan_foundry_hall: 'rare',
  plan_lookout: 'rare',
};

/**
 * Hand-written finds: placed once per world in a particular container (never rolled twice), with a fixed story.
 * `enchants` is the hook for the enchantment system (ItemStack.enchants, src/core/enchant.ts): when set it is attached to the stack
 * `rollLoot` creates. Orrin's Spare Pick is to carry a fixed Veinseeker enchant - add it here (`enchants: { veinseeker: 1 }`), nowhere else.
 */
export interface NamedFind {
  item: string;
  /** Where it is placed (a loot table id). */
  table: string;
  /** Fixed enchantments (key to level) the stack comes with. */
  enchants?: Record<string, number>;
}
export const NAMED_FINDS: readonly NamedFind[] = LEGENDARIES.map((l) => ({
  item: l.item,
  table: l.source === 'tavern_vault' ? 'tavern_vault' : legendaryTableId(l.item),
  ...(l.enchants ? { enchants: l.enchants } : {}),
}));

/** A named find's fixed extras by item key (enchants), if any. */
export function namedFindOf(item: string): NamedFind | undefined {
  return NAMED_FINDS.find((f) => f.item === item);
}

/**
 * Tables with ids that are not ruin tiers or structures (looked up by `lootTableById`, nestable by id). The tavern's two secret
 * rooms (src/npcs/tavern.ts): the sealed closet upstairs and the vault under the yard. Everything stays within one age of Ember.
 */
export const NAMED_TABLES: LootTableSpec[] = [
  {
    id: 'tavern_closet', tier: 'near', rolls: [2, 3],
    guaranteed: [
      { item: 'scroll_margin', count: 1, weight: 1, rarity: 'rare' },
      { item: 'bronze_axe', count: 1, weight: 1, rarity: 'fine' },
    ],
    entries: [
      { item: 'torch', count: [2, 4], weight: 8 },
      { item: 'bread', count: [1, 3], weight: 8 },
      { item: 'glass_vial', count: [1, 2], weight: 6 },
      { item: 'flint', count: [2, 4], weight: 6 },
      { item: 'wheat_seeds', count: [2, 4], weight: 5 },
    ],
  },
  {
    id: 'tavern_vault', tier: 'near', rolls: [3, 4],
    guaranteed: [
      { item: 'orrins_spare_pick', count: 1, weight: 1, rarity: 'legendary' },
      { item: 'scroll_ledger', count: 1, weight: 1, rarity: 'rare' },
      { item: 'essentia_jar', count: 1, weight: 1, rarity: 'fine' },
      { item: 'vial_cinder', count: 2, weight: 1, rarity: 'fine' },
    ],
    entries: [
      { item: 'bronze_ingot', count: [2, 4], weight: 8 },
      { item: 'coal', count: [4, 8], weight: 8 },
      { item: 'torch', count: [3, 6], weight: 6 },
      { item: 'glass_vial', count: [2, 4], weight: 6 },
      { item: 'bread', count: [2, 4], weight: 6 },
    ],
  },
  // Cave camps (src/world/caveRooms.ts): an abandoned miner's cache, richer the deeper it lies. One table per depth band, named
  // `cave_camp_<band>`; the boss that ends the caves reads these ids too, so keep the naming.
  {
    id: 'cave_camp_shallow', tier: 'near', rolls: [2, 3],
    entries: [
      { item: 'torch', count: [3, 6], weight: 10 },
      { item: 'coal', count: [3, 6], weight: 8 },
      { item: 'bread', count: [1, 3], weight: 8 },
      { item: 'flint', count: [2, 4], weight: 6 },
      { item: 'cord', count: [2, 4], weight: 6 },
      { item: 'wooden_pickaxe', count: 1, weight: 3 },
      { item: 'copper_ingot', count: [1, 3], weight: 4 },
    ],
  },
  {
    id: 'cave_camp_middle', tier: 'near', rolls: [3, 4],
    entries: [
      { item: 'torch', count: [4, 8], weight: 8 },
      { item: 'coal', count: [4, 8], weight: 8 },
      { item: 'bread', count: [2, 4], weight: 6 },
      { item: 'cord', count: [2, 5], weight: 6 },
      { item: 'tin_ingot', count: [1, 3], weight: 6 },
      { item: 'copper_ingot', count: [2, 4], weight: 6 },
      { item: 'bronze_ingot', count: [1, 2], weight: 5 },
      { item: 'bronze_pickaxe', count: 1, weight: 2, rarity: 'fine' },
      { item: 'glass_vial', count: [1, 3], weight: 4 },
    ],
  },
  {
    id: 'cave_camp_deep', tier: 'near', rolls: [3, 5],
    guaranteed: [{ item: 'torch', count: [4, 8], weight: 1 }],
    entries: [
      { item: 'bronze_ingot', count: [2, 4], weight: 8 },
      { item: 'iron_ingot', count: [1, 3], weight: 6 },
      { item: 'coal', count: [5, 10], weight: 8 },
      { item: 'glass_vial', count: [2, 4], weight: 5 },
      { item: 'essentia_jar', count: 1, weight: 2, rarity: 'rare' },
      { item: 'vial_cinder', count: 1, weight: 3, rarity: 'fine' },
      { item: 'treasure_map', count: 1, weight: 3, rarity: 'rare' },
      { item: 'bronze_axe', count: 1, weight: 2, rarity: 'fine' },
    ],
  },
  // The cave boss's chest (src/world/caveLair.ts): the one place loot, enchantments and quality meet. Fixed enchants, a masterwork pick.
  {
    id: 'cave_boss', tier: 'deep', rolls: [3, 4],
    guaranteed: [
      { item: 'iron_pickaxe', count: 1, weight: 1, rarity: 'rare', quality: 2, enchants: { veinseeker: 2, magnet: 1 } },
      { item: 'bronze_axe', count: 1, weight: 1, rarity: 'rare', quality: 1, enchants: { bounty: 1 } },
      { item: 'scroll_margin', count: 1, weight: 1, rarity: 'rare' },
      { item: 'ember_core', count: 2, weight: 1, rarity: 'fine' },
    ],
    entries: [
      { item: 'iron_ingot', count: [3, 6], weight: 8 },
      { item: 'coal', count: [6, 12], weight: 8 },
      { item: 'bronze_ingot', count: [2, 4], weight: 6 },
      { item: 'essentia_jar', count: 1, weight: 4, rarity: 'fine' },
      { item: 'scrap_metal', count: [3, 6], weight: 6 },
    ],
  },
  // The wandering trader's stock (src/npcs/trader.ts): the everyday goods of a visit, then one rare line. Both stay one age ahead of Ember.
  {
    id: 'trader_common', tier: 'near', rolls: [4, 6],
    entries: [
      { item: 'bread', count: [2, 4], weight: 8 },
      { item: 'wheat_seeds', count: [3, 6], weight: 6 },
      { item: 'potato', count: [2, 4], weight: 6 },
      { item: 'cord', count: [2, 5], weight: 6 },
      { item: 'flint', count: [2, 4], weight: 6 },
      { item: 'torch', count: [3, 6], weight: 6 },
      { item: 'glass_vial', count: [1, 3], weight: 5 },
      { item: 'charcoal', count: [3, 6], weight: 5 },
      { item: 'hide', count: [1, 3], weight: 5 },
      { item: 'tin_ingot', count: [1, 3], weight: 4 },
      { item: 'copper_ingot', count: [2, 4], weight: 4 },
      { item: 'bronze_ingot', count: [1, 2], weight: 3 },
    ],
  },
  {
    id: 'trader_rare', tier: 'near', rolls: [1, 1],
    entries: [
      { item: 'treasure_map', count: 1, weight: 5, rarity: 'rare' },
      { item: 'field_notebook', count: 1, weight: 3, rarity: 'rare' },
      { item: 'bronze_pickaxe', count: 1, weight: 3, rarity: 'fine' },
      { item: 'bronze_axe', count: 1, weight: 3, rarity: 'fine' },
      { item: 'essentia_jar', count: 1, weight: 2, rarity: 'rare' },
      { item: 'glass_beaker', count: [1, 2], weight: 3, rarity: 'fine' },
    ],
  },
  // One table per legendary that is not in the tavern (src/content/legendary.ts): the ruin and boss systems roll these.
  ...LEGENDARY_TABLES,
];

/** A stack's fixed extras from its named find, applied by `rollLoot`. */
export function applyNamedFind(stack: ItemStack): ItemStack {
  const f = namedFindOf(stack.item);
  if (f?.enchants) stack.enchants = { ...f.enchants };
  return stack;
}
