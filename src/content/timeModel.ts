/**
 * Time model (docs/advice/balance-economy.md sections 1, 2 and 5): how many expert seconds of attended play an item,
 * a list of items or a whole age costs, worked out from the resolved content alone. Like the progression solver it is
 * a design and balance tool: timeModel.test.ts holds the ages to their bands so a content change that blows the curve
 * fails a test. The running game never imports it.
 *
 * "Expert" means never lost, never dead, the best tool of the age in hand and one trip per vein: a lower bound. A
 * first-time phone player lands at about `TIME_PARAMS.playerFactor` times as long (a guess until a real playthrough
 * log calibrates it).
 *
 * How a cost is built (every tunable number is in TIME_PARAMS):
 * - A raw item gathered from the world costs `(mine time + walking overhead) / expected drops`. Mine time is
 *   `hardness / tool speed` with the age's tool set; ore pays `veinTravelS / (veinSize x veinYield)` a block for the
 *   walk to its vein, logs `treeOverheadS / logsPerTree`. Hunted, tapped, scooped and harvested items have flat costs.
 * - A recipe costs its inputs plus the attended seconds of the operation: `craftS` at hand, workbench and furnace
 *   forge; `strokes / strokesPerS` at a stroke station (twice the rate with the station's tool); and for anything that
 *   cooks or runs by itself (smelting, machines, timed stations) only `parallelAttended` of its wall time, because the
 *   player gathers while it runs. Smelting wall time is `timeS / (crucibles x speed)` of the age's furnace.
 * - The cheapest route wins: a fixed point over every recipe usable in the age. Reusable containers cost nothing.
 */
import { BUCKET_FILLS, NATURAL_BLOCKS, RUIN_SALVAGE_BLOCKS, hearthMaterials } from './progression';
import {
  BLOCKS, CAST_METALS, CREATURES, FURNACE_TIERS, ITEMS, MACHINES, MOULDS, ORE_VEINS, RECIPES, block, blockOrNull, castMetalOfIngot, itemOrNull,
} from '../core/registry';
import type { BlockDef, Drop, ItemAmount, RecipeDef } from '../core/types';
import { amounts } from './amounts';

/** Every assumption of the model, in one place. */
export const TIME_PARAMS = {
  /** Expert minutes -> player minutes (phone controls, exploring, nights, learning). Unverified: calibrate from a real playthrough. */
  playerFactor: 2.0,
  /** Seconds of taps for one hand, workbench or forge craft, and to load or unload a station. */
  craftS: 2,
  /** Share of an unattended job's wall time (smelting, machines, timed stations) charged as attended time. */
  parallelAttended: 0.25,
  /** A stroke station's tool (axe on the chopping block, hammer on the anvil) doubles every stroke. */
  toolStrokeMult: 2,
  /** Seconds to walk to and open up an ore vein, spread over the blocks it yields. */
  veinTravelS: 30,
  /** Share of a vein's blocks actually dug out. */
  veinYield: 0.8,
  /** Seconds to walk to a tree and clear its leaves, spread over its logs. */
  treeOverheadS: 6,
  logsPerTree: 4,
  /** Seconds of walking and picking up per surface block (dirt, sand, clay, rubble, grass). */
  blockOverheadS: 0.5,
  /** Seconds to find and kill one animal (its whole drop table). */
  huntS: 20,
  /** Seconds to harvest one ripe crop and replant it (the growing wait is not attended time). */
  cropS: 2,
  /** Seconds to fill a container from a liquid of the world. */
  fillS: 2,
  /** Seconds of attended time per pine sap tapped (the wait runs while the player works elsewhere). */
  tapS: 10,
  /** The tool set the expert carries in each age (index = age). */
  toolByAge: ['flint', 'bronze', 'iron', 'steel', 'steel', 'steel'] as readonly string[],
  /**
   * Natural blocks the world places only here and there (ruins, cave crystals): finite finds, so no route may lean
   * on them, like the progression solver's ruin salvage.
   */
  scarceBlocks: ['ruined_machine', 'crystal_cluster', 'cracked_stone_brick', 'mossy_stone_brick', ...RUIN_SALVAGE_BLOCKS] as readonly string[],
  /** Containers handed back by the recipes that use them: they cost nothing. */
  reusable: ['pail', 'glass_beaker', 'glass_vial', 'empty_canister', 'bronze_bucket'] as readonly string[],
};

export type TimeParams = Readonly<typeof TIME_PARAMS>;

/**
 * Kit of each age: what the age exists to teach, beyond the gate to the next furnace tier. Age index = position.
 * The Star Age has no gate: ignition is its finale and lives in section 3.4, not here.
 */
export const AGE_KITS: readonly ItemAmount[][] = [
  // Ember: the first tools and stations, the clay furnace and its fuel, then the first metal and the bronze kit.
  amounts(
    'workbench, flint_pickaxe, flint_axe, flint_shovel, furnace_clay, 10 charcoal, chopping_block, stone_anvil, mortar, clay_table, ' +
    'casting_bench, alloy_pot, ingot_mould, pickaxe_mould, axe_mould, shovel_mould, bronze_pickaxe, bronze_axe, bronze_shovel, bronze_hammer, ' +
    'thermopile, lamp',
  ),
  // Bronze: the workshop (shafts, gears and the first mechanical stations). The steam kit of docs/STEAM_PLAN.md is not in code yet.
  amounts(
    'hand_crank, 8 drive_shaft, 4 bronze_cog, mech_saw, mech_millstone, mech_mortar, mech_press, mech_hammer, flywheel, clockwork_motor, ' +
    'treadwheel, 12 conveyor_belt, hand_vacuum',
  ),
  // Forge: iron and steel tools, armour, and the first powered machines.
  amounts('iron_pickaxe, iron_axe, steel_pickaxe, steel_axe, plated_coat, steel_cuirass, crusher, boiler, steam_engine, 2 tank, pump'),
  // Current: electricity proper.
  amounts('steam_turbine, still, 2 wind_turbine, chainsaw, bore_rig, 2 battery, 6 heavy_cable, 4 circuit'),
  // Atomic: the fission kit and the drill.
  amounts('fission_pile, centrifuge, electrolyzer, power_drill, shield_suit, lithium_bank, 6 super_cable'),
];

/** The age names, for messages (index = age). */
export const AGE_KEYS = ['ember', 'bronze', 'forge', 'current', 'atomic', 'star'] as const;

/** What leaving an age takes: the next furnace tier's upgrade cost plus its smallest legal hearth. Empty for the last age. */
export function ageGate(age: number): ItemAmount[] {
  const next = FURNACE_TIERS[age + 1];
  if (!next) return [];
  return [...next.upgradeCost, ...hearthMaterials(next.tier)];
}

/** Kit and gate of an age, merged by item. */
export function ageBundle(age: number): ItemAmount[] {
  return mergeAmounts([...(AGE_KITS[age] ?? []), ...ageGate(age)]);
}

function mergeAmounts(list: readonly ItemAmount[]): ItemAmount[] {
  const out = new Map<string, number>();
  for (const a of list) out.set(a.item, (out.get(a.item) ?? 0) + a.count);
  return [...out].map(([item, count]) => ({ item, count }));
}

/** How one item is cheapest obtained in an age. */
export type Route =
  | { kind: 'raw'; source: string }
  | { kind: 'recipe'; recipe: RecipeDef; outCount: number; opS: number }
  | { kind: 'cast'; mould: string; ingot: string; units: number; opS: number }
  | { kind: 'free' };

export interface CostModel {
  age: number;
  /** Expert seconds per unit; Infinity when the age cannot obtain it. */
  cost(item: string): number;
  route(item: string): Route | null;
}

const isIngot = (key: string): boolean => castMetalOfIngot(key) !== null;
const ingotOf = (metal: string): string => CAST_METALS.find((m) => m.key === metal)?.ingot ?? `${metal}_ingot`;

/** Expected count of one drop entry. */
const expected = (d: Drop): number => (typeof d.count === 'number' ? d.count : (d.count[0] + d.count[1]) / 2) * (d.chance ?? 1);

/** The expert's tool for a block in an age: speed and tier (bare hands: speed 1, tier 0). */
function toolFor(def: BlockDef, age: number, p: TimeParams): { speed: number; tier: number } {
  if (def.tool === null) return { speed: 1, tier: 0 };
  const material = p.toolByAge[Math.min(age, p.toolByAge.length - 1)];
  const tool = itemOrNull(`${material}_${def.tool}`)?.tool;
  return tool ? { speed: tool.speed, tier: tool.tier } : { speed: 1, tier: 0 };
}

/** Raw gather costs of an age: item -> [expert seconds per unit, source]. */
function rawCosts(age: number, p: TimeParams): Map<string, [number, string]> {
  const out = new Map<string, [number, string]>();
  const offer = (item: string, s: number, source: string): void => {
    if (s > 0 && Number.isFinite(s) && s < (out.get(item)?.[0] ?? Infinity)) out.set(item, [s, source]);
  };
  const veins = new Map(ORE_VEINS.map((v) => [v.block, v]));
  const world = new Set<string>([...NATURAL_BLOCKS, ...veins.keys()]);
  for (const key of world) {
    if (p.scarceBlocks.includes(key)) continue;
    const def = blockOrNull(key);
    if (!def || def.hardness < 0 || def.liquid !== null) continue;
    const tool = toolFor(def, age, p);
    if (tool.tier < def.minTier) continue;
    const vein = veins.get(key);
    const isLog = def.key.endsWith('_log');
    const overhead = vein ? p.veinTravelS / (vein.veinSize * p.veinYield) : isLog ? p.treeOverheadS / p.logsPerTree : p.blockOverheadS;
    const perBlock = def.hardness / tool.speed + overhead;
    for (const d of def.drops) {
      const n = expected(d);
      if (n > 0) offer(d.item, perBlock / n, `mine:${key}`);
    }
  }
  for (const [container, liquid, full] of BUCKET_FILLS) {
    if (BLOCKS.some((b) => b.liquid === liquid)) offer(full, p.fillS, `fill:${container}`);
  }
  for (const c of CREATURES) {
    const total = c.drops.reduce((sum, d) => sum + expected(d), 0);
    // An animal's whole drop table comes from one hunt: charge each drop its share.
    for (const d of c.drops) if (expected(d) > 0) offer(d.item, p.huntS / total, `hunt:${c.key}`);
  }
  for (const m of MACHINES.values()) {
    if (m.role !== 'crop') continue;
    const ripe = block(m.blocks[m.blocks.length - 1]);
    for (const d of ripe.drops) if (expected(d) > 0) offer(d.item, p.cropS / expected(d), `crop:${ripe.key}`);
  }
  offer('pine_sap', p.tapS, 'tap:pine_log');
  return out;
}

/** Attended seconds of one run of a recipe in an age, and how many units it yields. Null when the age cannot run it. */
export function recipeOperation(r: RecipeDef, age: number, p: TimeParams = TIME_PARAMS): { opS: number; outCount: number } | null {
  if (r.age > age) return null;
  const tier = FURNACE_TIERS[Math.min(age, FURNACE_TIERS.length - 1)];
  if (r.station === 'furnace' && r.minTier > tier.tier) return null;
  const hand = blockOrNull(r.station)?.handStation;
  let opS: number;
  let outCount = r.output.count;
  if (r.station === 'furnace' && r.kind === 'smelt') {
    opS = p.craftS + (r.timeS / (tier.crucibles * tier.speed)) * p.parallelAttended;
  } else if (hand && r.strokes !== undefined) {
    const withTool = hand.tool !== undefined;
    opS = r.strokes / (hand.strokesPerS * (withTool ? p.toolStrokeMult : 1));
    if (withTool && r.toolOutput) outCount = r.toolOutput.count;
  } else if (r.timeS > 0) {
    opS = p.craftS + r.timeS * p.parallelAttended;
  } else {
    opS = p.craftS;
  }
  if (r.bonus) outCount += r.bonus.count * r.bonus.chance;
  return { opS, outCount };
}

/** The cheapest-route cost of every item in an age (a fixed point over every usable recipe and mould). */
export function costModel(age: number, p: TimeParams = TIME_PARAMS): CostModel {
  const costs = new Map<string, number>();
  const routes = new Map<string, Route>();
  for (const key of p.reusable) {
    costs.set(key, 0);
    routes.set(key, { kind: 'free' });
  }
  for (const [item, [s, source]] of rawCosts(age, p)) {
    if (costs.has(item)) continue;
    costs.set(item, s);
    routes.set(item, { kind: 'raw', source });
  }
  const ops = RECIPES.flatMap((r) => {
    const op = recipeOperation(r, age, p);
    return op ? [{ r, ...op }] : [];
  });
  // Moulds that cast something other than an ingot (ingots are priced by their smelt and alloy recipes).
  const casts = MOULDS.flatMap((m) =>
    Object.entries(m.casts).filter(([, out]) => !isIngot(out)).map(([metal, out]) => ({ mould: m.item, out, units: m.units, ingot: ingotOf(metal) })),
  );
  const get = (key: string): number => costs.get(key) ?? Infinity;
  const offer = (item: string, c: number, route: Route): boolean => {
    // Strictly cheaper by more than rounding noise, so the fixed point ends.
    if (!(c < get(item) - 1e-9)) return false;
    costs.set(item, c);
    routes.set(item, route);
    return true;
  };
  for (let changed = true, rounds = 0; changed && rounds < 1000; rounds++) {
    changed = false;
    for (const { r, opS, outCount } of ops) {
      let sum = opS;
      for (const i of r.inputs) sum += i.count * get(i.item);
      if (Number.isFinite(sum) && offer(r.output.item, sum / outCount, { kind: 'recipe', recipe: r, outCount, opS })) changed = true;
    }
    for (const c of casts) {
      // A cast head: the mould's metal poured in one go. The mould must be obtainable, but it is reusable, so it costs nothing per pour.
      const sum = c.units * get(c.ingot) + p.craftS;
      if (get(c.mould) < Infinity && offer(c.out, sum, { kind: 'cast', mould: c.mould, ingot: c.ingot, units: c.units, opS: p.craftS })) changed = true;
    }
  }
  return { age, cost: get, route: (item) => routes.get(item) ?? null };
}

/** What a list of items costs in an age. */
export interface Bill {
  /** Attended expert seconds. */
  expertS: number;
  /** Raw items taken from the world, by item (fractional: batch recipes are costed pro rata). */
  raw: Map<string, number>;
  /** Crucible-seconds of smelting (before dividing by crucibles and speed). */
  crucibleS: number;
  /** Electrical energy of machine recipes, joules. */
  energyJ: number;
  /** Items the age cannot obtain at all (a bundle with any is broken). */
  missing: string[];
}

/** Expands a list of items along their cheapest routes. */
export function bill(model: CostModel, wanted: readonly ItemAmount[]): Bill {
  const out: Bill = { expertS: 0, raw: new Map(), crucibleS: 0, energyJ: 0, missing: [] };
  const add = (item: string, count: number, depth: number): void => {
    const route = model.route(item);
    if (!route || depth > 64) {
      if (!out.missing.includes(item)) out.missing.push(item);
      return;
    }
    switch (route.kind) {
      case 'free':
        return;
      case 'raw':
        out.expertS += count * model.cost(item);
        out.raw.set(item, (out.raw.get(item) ?? 0) + count);
        return;
      case 'cast':
        out.expertS += count * route.opS;
        add(route.ingot, count * route.units, depth + 1);
        return;
      case 'recipe': {
        const runs = count / route.outCount;
        out.expertS += runs * route.opS;
        if (route.recipe.station === 'furnace' && route.recipe.kind === 'smelt') out.crucibleS += runs * route.recipe.timeS;
        out.energyJ += runs * route.recipe.energyJ;
        for (const i of route.recipe.inputs) add(i.item, runs * i.count, depth + 1);
      }
    }
  };
  for (const w of wanted) add(w.item, w.count, 0);
  return out;
}

/** Expert minutes of a list of items in an age. */
export const expertMinutes = (age: number, wanted: readonly ItemAmount[], p: TimeParams = TIME_PARAMS): number =>
  bill(costModel(age, p), wanted).expertS / 60;

/** One row of the time-to-next-age curve. */
export interface AgeTime {
  age: number;
  key: string;
  kitMin: number;
  gateMin: number;
  /** Kit plus gate, expert minutes. */
  expertMin: number;
  playerMin: number;
  bill: Bill;
}

/** The time-to-next-age curve for the five ages that end in a furnace upgrade. */
export function ageCurve(p: TimeParams = TIME_PARAMS): AgeTime[] {
  return AGE_KITS.map((kit, age) => {
    const model = costModel(age, p);
    const kitMin = bill(model, kit).expertS / 60;
    const gateMin = bill(model, ageGate(age)).expertS / 60;
    return { age, key: AGE_KEYS[age], kitMin, gateMin, expertMin: kitMin + gateMin, playerMin: (kitMin + gateMin) * p.playerFactor, bill: bill(model, ageBundle(age)) };
  });
}

/** Every item key the kits name, for content checks. */
export const kitItems = (): string[] => [...new Set(AGE_KITS.flat().map((a) => a.item))];

/** True when the key is an item of the game. */
export const isItem = (key: string): boolean => ITEMS.some((it) => it.key === key);
