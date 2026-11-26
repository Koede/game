/**
 * Balance time model (docs/advice/balance-economy.md sections 1, 2 and 5): what each age costs an expert player in
 * seconds of attended work, read live from the registry so a content change moves the numbers without a snapshot.
 *
 * - Every raw item (one no recipe makes) has a gather cost in expert seconds (`TIME_PARAMS.rawS`, from the dossier's
 *   table 1.2 with the tools of the age the raw first matters in; anything unlisted costs `defaultRawS`).
 * - A recipe adds attended work: `attendedS` of taps for hand, workbench and furnace forging; strokes / strokes-per-second
 *   at a stroke station (the expert holds the station's tool); and `passiveShare` of the seconds of a smelt, timed
 *   station or machine run (they run beside gathering).
 * - The cost of an item is the cheapest route over every recipe (a fixed point); reusable containers cost nothing.
 * - An age's bundle is what its goals ask you to make, have or place, its kit (`AGE_KITS`), plus the furnace upgrade and
 *   smallest hearth that end it. Expert minutes x `playerFactor` = player minutes (unmeasured: calibrate from the first real playthrough).
 *
 * Pure: no DOM, no simulation. Tests: timeModel.test.ts (T1) and balance.test.ts (T2, T3, T8).
 */
import { STROKE_TOOL_MULT } from '../core/constants';
import { BLOCKS, ITEMS, OBJECTIVES, RECIPES } from '../core/registry';
import type { ItemAmount, ObjectiveCondition, RecipeDef } from '../core/types';
import { amounts } from './amounts';
import { hearthMaterials, itemPlacing } from './progression';
import { FURNACE_TIERS } from './tech';

export const TIME_PARAMS = {
  /** Seconds of taps for a hand, workbench or furnace-forge recipe. */
  attendedS: 2,
  /** Share of a smelt's, timed station's or machine's seconds counted as attended (it runs while you gather). */
  passiveShare: 0.25,
  /** Expert minutes -> player minutes on a phone (an assumption until a playthrough log measures it). */
  playerFactor: 2,
  /** Gather cost of a raw item not in `rawS`. */
  defaultRawS: 5,
  /** Gather cost per raw item in expert seconds, vein overhead included (dossier table 1.2). */
  rawS: {
    oak_log: 2.5, pine_log: 2.5, birch_log: 2.5, clay: 2, rubble: 2.5, cobblestone: 2.5, stone: 2.5, sand: 2, gravel: 2, dirt: 1.5,
    flint: 8, fiber: 2, stick: 1, copper_ore: 6.9, tin_ore: 7.7, coal: 3.9, iron_ore: 7.8, limestone: 4, sulfur: 6,
    silica: 5, quartz: 8.8, bauxite: 7.6, wolframite: 9.5, spodumene: 9.3, pine_sap: 30, water: 0, water_pail: 0, wheat: 7,
  } as Record<string, number>,
  /** Reusable containers and tools of the trade that come back after use: cost 0. Moulds (`*_mould`) count too. */
  containers: ['pail', 'water_pail', 'glass_beaker', 'empty_canister', 'bronze_bucket', 'vial', 'cup', 'clay_cup'] as readonly string[],
};

/**
 * Each age's kit beyond its goals (dossier 1.3): the tools and machines the age exists to teach. The Bronze Age's
 * boiler and steam kit (BRONZE_PLAN) is not built yet, so its kit is only the bronze tool set for now. The Atomic kit
 * leaves out `shield_suit` and `lithium_bank`: optional goals (dossier 2).
 */
export const AGE_KITS: readonly (readonly ItemAmount[])[] = [
  amounts('1 workbench, 1 flint_pickaxe, 1 flint_axe, 1 flint_shovel, 1 furnace_clay, 10 charcoal, 15 bronze_ingot, 8 stone_brick'),
  amounts('1 bronze_pickaxe, 1 bronze_axe, 1 bronze_shovel, 1 bronze_hammer'),
  amounts('1 iron_pickaxe, 1 iron_axe, 1 steel_pickaxe, 1 steel_axe, 1 plated_coat, 1 steel_cuirass, 1 crusher, 1 boiler, 1 steam_engine, 2 tank, 1 pump'),
  amounts('1 steam_turbine, 1 still, 2 wind_turbine, 1 chainsaw, 1 bore_rig, 2 battery, 6 heavy_cable, 4 circuit'),
  amounts('1 fission_pile, 1 centrifuge, 1 electrolyzer, 1 power_drill, 6 super_cable'),
];

const isContainer = (key: string): boolean => TIME_PARAMS.containers.includes(key) || key.endsWith('_mould');

const BLOCK_BY_KEY = new Map(BLOCKS.map((b) => [b.key, b]));

/** Attended seconds one run of a recipe costs (not counting its inputs). */
export function craftSeconds(r: RecipeDef): number {
  const hand = BLOCK_BY_KEY.get(r.station)?.handStation ?? null;
  if (hand && r.strokes !== undefined) {
    const rate = hand.strokesPerS * (hand.tool ? STROKE_TOOL_MULT : 1);
    return r.strokes / rate;
  }
  if (r.station === 'hand' || r.station === 'workbench') return TIME_PARAMS.attendedS;
  if (r.station === 'furnace' && r.kind === 'forge') return TIME_PARAMS.attendedS;
  return TIME_PARAMS.attendedS + (r.timeS ?? 0) * TIME_PARAMS.passiveShare;
}

/** Items a recipe yields per run for an expert (the station's tool output, plus the expected bonus). */
function yieldOf(r: RecipeDef): number {
  const out = r.toolOutput && r.toolOutput.item === r.output.item ? r.toolOutput.count : r.output.count;
  const bonus = r.bonus && r.bonus.item === r.output.item ? r.bonus.count * r.bonus.chance : 0;
  return out + bonus;
}

let cache: Map<string, number> | null = null;

/** Expert seconds per unit of every item: the cheapest route over all recipes. Infinity = no finite route. */
export function itemCosts(): ReadonlyMap<string, number> {
  if (cache) return cache;
  const made = new Set(RECIPES.map((r) => r.output.item));
  const cost = new Map<string, number>();
  for (const it of ITEMS) {
    if (isContainer(it.key)) cost.set(it.key, 0);
    else if (it.key in TIME_PARAMS.rawS) cost.set(it.key, TIME_PARAMS.rawS[it.key]);
    else cost.set(it.key, made.has(it.key) ? Infinity : TIME_PARAMS.defaultRawS);
  }
  for (let pass = 0; pass < 200; pass++) {
    let changed = false;
    for (const r of RECIPES) {
      if (isContainer(r.output.item)) continue;
      let sum = craftSeconds(r);
      for (const i of r.inputs) sum += i.count * (cost.get(i.item) ?? TIME_PARAMS.defaultRawS);
      if (!Number.isFinite(sum)) continue;
      const each = sum / Math.max(1e-9, yieldOf(r));
      if (each < (cost.get(r.output.item) ?? Infinity) - 1e-9) {
        cost.set(r.output.item, each);
        changed = true;
      }
    }
    if (!changed) break;
  }
  cache = cost;
  return cost;
}

/** Expert seconds for a list of items. */
export const billSeconds = (bill: readonly ItemAmount[]): number =>
  bill.reduce((s, a) => s + a.count * (itemCosts().get(a.item) ?? TIME_PARAMS.defaultRawS), 0);

/** The items one objective condition asks for (the cheapest branch of an `any`). */
function conditionBill(c: ObjectiveCondition): ItemAmount[] {
  switch (c.type) {
    case 'make':
    case 'have':
      return [{ item: c.item, count: c.count ?? 1 }];
    case 'place': {
      const it = itemPlacing(c.block);
      return it ? [{ item: it, count: c.count ?? 1 }] : [];
    }
    case 'any': {
      const options = c.of.map(conditionBill);
      return options.reduce((best, o) => (billSeconds(o) < billSeconds(best) ? o : best), options[0] ?? []);
    }
    default:
      return [];
  }
}

/** Merge item lists, keeping the larger count of each item (a goal asking for what the gate needs is one batch). */
function mergeMax(...lists: ItemAmount[][]): ItemAmount[] {
  const m = new Map<string, number>();
  for (const l of lists) for (const a of l) m.set(a.item, Math.max(m.get(a.item) ?? 0, a.count));
  return [...m].map(([item, count]) => ({ item, count }));
}

/** What leaving an age takes: its goals' items, its kit, the next furnace's upgrade cost and that tier's smallest hearth. */
export function ageBundle(age: number): ItemAmount[] {
  const goals = OBJECTIVES.filter((o) => o.age === age).flatMap((o) => conditionBill(o.condition));
  const next = FURNACE_TIERS.find((t) => t.age === age + 1);
  const gate = next ? [...next.upgradeCost, ...hearthMaterials(next.tier)] : [];
  return mergeMax(goals, [...(AGE_KITS[age] ?? [])], gate);
}

/** Expert minutes to leave an age. */
export const expertMinutes = (age: number): number => billSeconds(ageBundle(age)) / 60;

/** Player minutes to leave an age (expert x `playerFactor`). */
export const playerMinutes = (age: number): number => expertMinutes(age) * TIME_PARAMS.playerFactor;
