/**
 * Recipes of Essentia & Research (docs/OVERHAUL_PLAN.md B, docs/api/magic.md).
 *
 * MAGIC_RECIPES are ordinary registry recipes (hand, workbench, forge). ARCANE_RECIPES are made at the Rune Desk and
 * INFUSIONS on the Infusion Altar: both also pay an essentia `cost` and live outside the registry's RECIPES (their own
 * screen and machine), so the progression solver reads them from here (src/content/progression.ts). Every arcane and
 * infusion recipe is gated by research (src/magic/entries.ts); the tech spine needs none of them.
 */
import type { ItemAmount, RecipeSpec } from '../core/types';
import type { Aspects } from '../magic/aspects';
import { amount, amounts } from './amounts';

/** `minTier` 2 (the Bronze Furnace) for the Bronze-age pieces, 1 for what the Clay Furnace still makes. */
const forge = (id: string, output: string, inputs: string, minTempC: number, minTier = 1): RecipeSpec => ({
  id, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier, age: minTier - 1,
});

export const MAGIC_RECIPES: RecipeSpec[] = [
  { id: 'field_notebook', station: 'hand', inputs: amounts('1 plank, 3 fiber, 1 charcoal'), output: amount('field_notebook'), age: 0 },
  { id: 'scribing_tools', station: 'hand', inputs: amounts('1 stick, 1 charcoal, 1 fiber'), output: amount('scribing_tools'), age: 0 },
  { id: 'research_table', station: 'workbench', inputs: amounts('4 plank, 2 stick'), output: amount('research_table'), age: 0 },
  { id: 'crucible', station: 'workbench', inputs: amounts('4 stone_brick, 1 pail'), output: amount('crucible'), age: 0 },
  { id: 'vis_rod', station: 'workbench', inputs: amounts('2 stick, 1 glass_vial, 1 copper_ingot'), output: amount('vis_rod'), age: 0 },
  { id: 'essentia_jar', station: 'workbench', inputs: amounts('3 glass, 1 plank'), output: amount('essentia_jar'), age: 0 },
  forge('glass_vial', '2 glass_vial', '1 glass', 650),
  forge('rune_desk', 'rune_desk', '4 plank, 2 copper_ingot, 1 glass', 500, 2),
  forge('essentia_tube', '4 essentia_tube', '2 glass, 1 copper_ingot', 650, 2),
  forge('arcane_pedestal', 'arcane_pedestal', '3 stone_brick, 1 copper_ingot', 500, 2),
];

/** A recipe at the Rune Desk: ingredients from the pack, plus essentia. */
export interface ArcaneRecipe { id: string; output: ItemAmount; inputs: ItemAmount[]; cost: Aspects }
/** An infusion: the heart item on the altar, one item on each of up to four pedestals, essentia drawn over `seconds`. */
export interface InfusionRecipe { id: string; output: ItemAmount; center: string; around: string[]; cost: Aspects; seconds: number }

const arcane = (id: string, output: string, inputs: string, cost: Aspects): ArcaneRecipe => ({ id, output: amount(output), inputs: amounts(inputs), cost });
const infuse = (id: string, output: string, center: string, around: string[], cost: Aspects, seconds: number): InfusionRecipe =>
  ({ id, output: amount(output), center, around, cost, seconds });

export const ARCANE_RECIPES: ArcaneRecipe[] = [
  arcane('bronze_rod', 'bronze_rod', '1 vis_rod, 2 bronze_ingot', { gale: 4, loam: 4, rune: 2 }),
  arcane('iron_rod', 'iron_rod', '1 bronze_rod, 2 iron_ingot, 1 glass_vial', { mind: 6, vein: 6, rune: 4 }),
  arcane('infusion_altar', 'infusion_altar', '4 stone_brick, 2 copper_ingot, 1 glass_vial', { rune: 6, clarity: 4 }),
  arcane('focus_kindle', 'focus_kindle', '1 glass, 1 coal', { cinder: 6, gale: 2 }),
  arcane('focus_light', 'focus_light', '1 glass, 1 torch', { cinder: 4, gale: 4 }),
  arcane('focus_ward', 'focus_ward', '1 glass, 2 leather, 1 iron_ingot', { loam: 6, rift: 4, rune: 4 }),
  arcane('focus_blink', 'focus_blink', '1 glass, 1 cord, 1 iron_ingot', { gale: 8, mind: 4, rift: 4 }),
];

export const INFUSIONS: InfusionRecipe[] = [
  infuse('vein_lens', 'vein_lens', 'glass', ['copper_ingot', 'copper_ingot'], { vein: 6, mind: 4, clarity: 4 }, 10),
  infuse('clay_servant', 'clay_servant', 'clay', ['clay', 'clay', 'iron_ingot', 'glass_vial'], { spring: 8, mind: 8, loam: 8 }, 20),
  infuse('void_jar', 'void_jar', 'essentia_jar', ['iron_ingot', 'iron_ingot', 'glass', 'glass'], { ward: 8, rift: 8, brook: 8 }, 20),
  infuse('steel_infusion', 'steel_ingot', 'iron_ingot', ['coal', 'coal'], { cinder: 6, vein: 4, rune: 2 }, 15),
  // The artificer's attunement: a plain tool on the altar, two vials of the aspect around it (research 'attunement').
  ...(['bronze', 'iron'] as const).flatMap((metal) => (['pickaxe', 'axe', 'shovel'] as const).flatMap((kind) => [
    infuse(`rune_${metal}_${kind}`, `rune_${metal}_${kind}`, `${metal}_${kind}`, ['vial_rune', 'vial_rune'], metal === 'bronze' ? { rune: 6, loam: 4 } : { rune: 8, vein: 6 }, metal === 'bronze' ? 15 : 20),
    infuse(`gale_${metal}_${kind}`, `gale_${metal}_${kind}`, `${metal}_${kind}`, ['vial_gale', 'vial_gale'], metal === 'bronze' ? { gale: 6, mind: 2 } : { gale: 8, mind: 4 }, metal === 'bronze' ? 15 : 20),
  ])),
];

/** Crucible alchemy: drop `catalyst` in while the pot holds `cost` essentia; it comes out as `output`. */
export interface AlchemyRecipe { id: string; output: ItemAmount; catalyst: string; cost: Aspects }
const alchemy = (id: string, output: string, catalyst: string, cost: Aspects): AlchemyRecipe => ({ id, output: amount(output), catalyst, cost });

export const ALCHEMY: AlchemyRecipe[] = [
  alchemy('alch_copper', '2 copper_ingot', 'copper_ore', { vein: 3, cinder: 2 }),
  alchemy('alch_tin', '2 tin_ingot', 'tin_ore', { vein: 3, cinder: 2 }),
  alchemy('alch_glass', '2 glass', 'sand', { clarity: 2, cinder: 2 }),
  alchemy('alch_coal', '1 coal', 'charcoal', { cinder: 4, loam: 2 }),
  alchemy('alch_clay', '2 clay', 'dirt', { brook: 3, loam: 2 }),
];
export const alchemyFor = (catalyst: string): AlchemyRecipe[] => ALCHEMY.filter((r) => r.catalyst === catalyst);

export const arcaneRecipe = (id: string): ArcaneRecipe | null => ARCANE_RECIPES.find((r) => r.id === id) ?? null;
export const infusionRecipe = (id: string): InfusionRecipe | null => INFUSIONS.find((r) => r.id === id) ?? null;
