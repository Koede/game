/**
 * The time model (docs/advice/balance-economy.md sections 1 and 5): what a bundle of items costs a flawless player in
 * "expert seconds". Pure: it only reads the registry (RECIPES, BLOCKS, ITEMS, ORE_VEINS, FURNACE_TIERS, MACHINES), so
 * balance tests can bound it with bands and never depend on a snapshot.
 *
 * Every number that is a guess (flagged `A` in the advice doc) lives in TIME_PARAMS. Nothing here has been
 * measured: after the first real playthrough replace `EXPERT_TO_PLAYER` with the measured ratio.
 *
 * Cost of an item = cheapest route over every recipe (a fixed point), in expert seconds per unit. A raw item costs
 * the time to mine it with the best tool of the age; a recipe costs its inputs plus the attended time at its station.
 */
import { BLOCKS, FURNACE_TIERS, ITEMS, ORE_VEINS, RECIPES } from '../core/registry';
import type { BlockDef, ItemAmount, RecipeDef, ToolKind } from '../core/types';
import { MOULD_SPECS, CAST_METAL_SPECS } from './mouldsHand';
import { hearthMaterials as hearthMats } from './progression';

/** Parameters of the model, all in one place. */
export const TIME_PARAMS = {
  /** Seconds of taps for a hand or workbench craft. `A` */
  HAND_CRAFT_S: 2,
  /** Strokes per second of a hand station that does not state its own (it normally does). */
  DEFAULT_STROKES_PER_S: 2,
  /** Fastest a block can be broken, however soft or well-tooled: one tap. `A` */
  MIN_BREAK_S: 0.5,
  /** Seconds to walk to, find and open up one ore vein, spread over `veinSize x VEIN_YIELD` blocks. `A` */
  VEIN_OVERHEAD_S: 30,
  VEIN_YIELD: 0.8,
  /** Seconds to fell and trim one tree, and the logs it gives. `A` */
  TREE_OVERHEAD_S: 6,
  TREE_LOGS: 4,
  /** Share of a smelt or machine run the player must stand over; the rest overlaps other work. `A` */
  ATTENDED_FRACTION: 0.25,
  /** Furnace utilisation while a job runs (fuel is burnt for fire-seconds / this). `A` */
  FURNACE_UTILISATION: 0.7,
  /** Fuel the furnace is fed in the cost model: its gather cost and burn time price every fire-second. */
  FUEL_ITEM: 'oak_log',
  /** Seconds to pour one cast. */
  POUR_S: 3,
  /** Expert minutes -> player minutes (phone controls, exploring, building the shell, nights, learning). `A` */
  EXPERT_TO_PLAYER: 2.0,
  /** Seconds to get a raw item that no block drops (hides, wool): a hunt or a shear. `A` */
  LEAF_S: { hide: 20, wool: 15 } as Readonly<Record<string, number>>,
  /** Inputs that are containers handed back for reuse: they cost nothing when a recipe consumes them. */
  REUSABLE: /(_pail|_beaker|_vial|_mould)$/,
  /** Placeable blocks that really are found in the world and give themselves back (sand, gravel). */
  NATURAL_SELF_DROPS: new Set(['sand', 'gravel']) as ReadonlySet<string>,
  /** Ruins and loot blocks: lucky finds that the progression solver also leaves out, never a gathering route. */
  NOT_GATHERED: /^(collapsed_|rusted_|ruined_|repaired_|crystal_cluster)/,
  /** Best tool tier the player owns while working on each age (index = age). */
  TOOL_TIER_BY_AGE: [1, 2, 3, 4, 4, 5] as readonly number[],
};

// ---------------------------------------------------------------------------------------------
// Gathering
// ---------------------------------------------------------------------------------------------

interface ToolOption {
  kind: ToolKind;
  tier: number;
  speed: number;
  universal: boolean;
}

const TOOLS: readonly ToolOption[] = ITEMS.filter((it) => it.tool && it.tool.kind !== 'maul' && it.tool.kind !== 'hoe' && it.tool.kind !== 'hammer').map((it) => ({
  kind: it.tool!.kind,
  tier: it.tool!.tier,
  speed: it.tool!.speed,
  universal: it.tool!.universal === true,
}));

/** Seconds to break one block with the best tool of at most `toolTier`, or Infinity when no such tool can drop it. */
export function mineSeconds(def: BlockDef, toolTier: number): number {
  let best = Infinity;
  const bare = def.minTier === 0 ? def.hardness : Infinity;
  best = bare;
  for (const t of TOOLS) {
    if (t.tier > toolTier || t.tier < def.minTier) continue;
    if (t.kind !== def.tool && !t.universal) continue;
    best = Math.min(best, def.hardness / t.speed);
  }
  return Math.max(best, TIME_PARAMS.MIN_BREAK_S);
}

const veinSizeOf = new Map(ORE_VEINS.map((v) => [v.block, v.veinSize]));

/** Seconds of walking and clearing charged to every block of a vein or tree, on top of breaking it. */
function overheadSeconds(def: BlockDef): number {
  const size = veinSizeOf.get(def.key);
  if (size !== undefined) return TIME_PARAMS.VEIN_OVERHEAD_S / (size * TIME_PARAMS.VEIN_YIELD);
  if (def.key.endsWith('_log')) return TIME_PARAMS.TREE_OVERHEAD_S / TIME_PARAMS.TREE_LOGS;
  return 0;
}

const meanCount = (count: number | [number, number]): number => (typeof count === 'number' ? count : (count[0] + count[1]) / 2);

/** Every block that drops an item, with the expected count of that item per block broken. */
const craftable = new Set(RECIPES.map((r) => r.output.item));
const itemByKey = new Map(ITEMS.map((it) => [it.key, it]));
const droppers = new Map<string, Array<{ def: BlockDef; perBlock: number }>>();
for (const def of BLOCKS) {
  for (const d of def.drops) {
    // Breaking a machine or crafted block you placed gives it back, which is not gathering.
    if (craftable.has(d.item) && itemByKey.get(d.item)?.block === def.key && !TIME_PARAMS.NATURAL_SELF_DROPS.has(def.key)) continue;
    if (TIME_PARAMS.NOT_GATHERED.test(def.key) || def.machine || def.station || def.handStation) continue;
    const list = droppers.get(d.item) ?? [];
    list.push({ def, perBlock: meanCount(d.count) * (d.chance ?? 1) });
    droppers.set(d.item, list);
  }
}

/** Expert seconds to gather one unit of an item from the world with tools up to `toolTier`; Infinity if it cannot be. */
export function gatherSeconds(itemKey: string, toolTier: number): number {
  let best = TIME_PARAMS.LEAF_S[itemKey] ?? Infinity;
  for (const { def, perBlock } of droppers.get(itemKey) ?? []) {
    if (perBlock <= 0) continue;
    const mine = mineSeconds(def, toolTier);
    if (mine === Infinity) continue;
    best = Math.min(best, (mine + overheadSeconds(def)) / perBlock);
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------------------------

const strokesPerS = (station: string): number =>
  BLOCKS.find((b) => b.key === station)?.handStation?.strokesPerS ?? TIME_PARAMS.DEFAULT_STROKES_PER_S;

/** Fire-second price: seconds of gathering the fuel item per second it burns. */
function fuelSecondsPerFireSecond(toolTier: number): number {
  const fuel = ITEMS.find((it) => it.key === TIME_PARAMS.FUEL_ITEM)?.fuel;
  if (!fuel) throw new Error(`timeModel: FUEL_ITEM "${TIME_PARAMS.FUEL_ITEM}" is not a fuel`);
  return gatherSeconds(TIME_PARAMS.FUEL_ITEM, toolTier) / fuel.burnS;
}

/**
 * Attended expert seconds of running one recipe, excluding its ingredients. Timed waits that overlap other work
 * count only ATTENDED_FRACTION; furnace jobs also pay for the fuel that burns while they run.
 */
export function stationSeconds(r: RecipeDef, toolTier: number): number {
  const p = TIME_PARAMS;
  if (r.station === 'hand' || r.station === 'workbench') return p.HAND_CRAFT_S;
  if (r.station === 'furnace') {
    if (r.kind === 'forge' || r.timeS <= 0) return p.HAND_CRAFT_S;
    const tier = FURNACE_TIERS[r.minTier - 1] ?? FURNACE_TIERS[0];
    const wallS = r.timeS / (tier.crucibles * tier.speed);
    return p.HAND_CRAFT_S + wallS * p.ATTENDED_FRACTION + (wallS / p.FURNACE_UTILISATION) * fuelSecondsPerFireSecond(toolTier);
  }
  if (r.station === ('cast' as RecipeDef['station'])) return p.POUR_S;
  if (r.strokes) return r.strokes / strokesPerS(r.station);
  if (r.timeS > 0) return p.HAND_CRAFT_S + r.timeS * p.ATTENDED_FRACTION;
  return p.HAND_CRAFT_S;
}

/**
 * Pours: a head is `units` ingots of a metal poured into its mould. They are not recipes, so they join the fixed point
 * as synthetic recipes at the pseudo-station 'cast' (the moulds themselves are kit items, reusable once made).
 */
const CAST_RECIPES: RecipeDef[] = MOULD_SPECS.flatMap((m) =>
  Object.entries(m.casts)
    .filter(([, out]) => !out.endsWith('_ingot'))
    .map(([metal, out]): RecipeDef => ({
      id: `cast_${out}`, station: 'cast' as RecipeDef['station'], kind: 'forge', inputs: [{ item: CAST_METAL_SPECS.find((c) => c.key === metal)!.ingot, count: m.units }],
      output: { item: out, count: 1 }, byproducts: [], timeS: 0, minTempC: 0, minTier: 1, energyJ: 0, age: 0,
    } as RecipeDef)));
const ALL_RECIPES: readonly RecipeDef[] = [...RECIPES, ...CAST_RECIPES];

export interface CostTable {
  /** Expert seconds per unit of every item that can be obtained. */
  readonly cost: ReadonlyMap<string, number>;
  /** The recipe that makes an item cheapest, or null when the item is gathered (or poured). */
  readonly via: ReadonlyMap<string, RecipeDef | null>;
}

const tables = new Map<number, CostTable>();

/** Cheapest-route fixed point over every recipe, for a player holding tools up to `toolTier`. Memoised. */
export function costTable(toolTier: number): CostTable {
  const memo = tables.get(toolTier);
  if (memo) return memo;
  const cost = new Map<string, number>();
  const via = new Map<string, RecipeDef | null>();
  const keys = new Set<string>([...droppers.keys(), ...Object.keys(TIME_PARAMS.LEAF_S)]);
  for (const k of keys) {
    const g = gatherSeconds(k, toolTier);
    if (g < Infinity) {
      cost.set(k, g);
      via.set(k, null);
    }
  }
  const inputCost = (item: string): number => (TIME_PARAMS.REUSABLE.test(item) ? 0 : cost.get(item) ?? Infinity);
  const station = new Map(ALL_RECIPES.map((r) => [r.id, stationSeconds(r, toolTier)]));
  for (let pass = 0; pass < 100; pass++) {
    let changed = false;
    for (const r of ALL_RECIPES) {
      let sum = station.get(r.id)!;
      for (const i of r.inputs) sum += inputCost(i.item) * i.count;
      if (!Number.isFinite(sum)) continue;
      const per = sum / r.output.count;
      if (per < (cost.get(r.output.item) ?? Infinity) - 1e-9) {
        cost.set(r.output.item, per);
        via.set(r.output.item, r);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const table: CostTable = { cost, via };
  tables.set(toolTier, table);
  return table;
}

/** Expert seconds of a bundle of items. Throws on an item no route can make (the bundle is not buildable). */
export function expertSeconds(bundle: readonly ItemAmount[], toolTier: number): number {
  const { cost } = costTable(toolTier);
  let total = 0;
  for (const a of bundle) {
    const c = cost.get(a.item);
    if (c === undefined) throw new Error(`timeModel: no route to "${a.item}" with tier ${toolTier} tools`);
    total += c * a.count;
  }
  return total;
}

export const expertMinutes = (bundle: readonly ItemAmount[], toolTier: number): number => expertSeconds(bundle, toolTier) / 60;
export const playerMinutes = (expertMin: number): number => expertMin * TIME_PARAMS.EXPERT_TO_PLAYER;

/** The raw items (gathered from the world) a bundle comes down to along the cheapest routes, rounded up per item. */
export function rawBill(bundle: readonly ItemAmount[], toolTier: number): Map<string, number> {
  const { via } = costTable(toolTier);
  const raw = new Map<string, number>();
  const walk = (item: string, count: number, depth: number): void => {
    if (depth > 60) throw new Error(`timeModel: recipe cycle at "${item}"`);
    const r = via.get(item);
    if (r === undefined) throw new Error(`timeModel: no route to "${item}"`);
    if (r === null) {
      raw.set(item, (raw.get(item) ?? 0) + count);
      return;
    }
    const runs = count / r.output.count;
    for (const i of r.inputs) if (!TIME_PARAMS.REUSABLE.test(i.item)) walk(i.item, i.count * runs, depth + 1);
  };
  for (const a of bundle) walk(a.item, a.count, 0);
  return new Map([...raw].map(([k, v]) => [k, Math.ceil(v - 1e-9)]));
}

// ---------------------------------------------------------------------------------------------
// Age bundles
// ---------------------------------------------------------------------------------------------

const amounts = (text: string): ItemAmount[] =>
  text.split(',').map((part) => {
    const [n, item] = part.trim().split(/\s+/);
    return item === undefined ? { item: n, count: 1 } : { item, count: Number(n) };
  });

/**
 * What an age asks the player to own before the next furnace: the machines and tools the age exists to teach (the
 * "kit"). The gate is the next furnace tier's `upgradeCost` plus that hearth's shell, read live from content.
 * Items that content does not have yet (the planned steam parts of the Bronze Age) are NOT here: a bundle only
 * names what the game can build today, so the Bronze number is a floor until those land.
 */
export const AGE_KITS: ReadonlyArray<{ age: string; kit: ItemAmount[] }> = [
  { age: 'ember', kit: amounts('workbench, flint_pickaxe, flint_axe, flint_shovel, furnace_clay, 10 charcoal, bronze_hammer, ingot_mould, pickaxe_mould, axe_mould, shovel_mould, hoe_mould, alloy_pot, kettle_pot, clay_cup, drip_cone, 8 stone_brick, bronze_pickaxe_head, bronze_axe_head, bronze_shovel_head, bronze_hoe_head') },
  { age: 'bronze', kit: amounts('bronze_pickaxe, bronze_axe, bronze_shovel, bronze_hoe, 8 bronze_plate, 8 brick') },
  { age: 'forge', kit: amounts('iron_pickaxe, iron_axe, steel_pickaxe, steel_axe, plated_coat, steel_cuirass, crusher, boiler, steam_engine, 2 tank, pump') },
  { age: 'current', kit: amounts('steam_turbine, still, 2 wind_turbine, chainsaw, bore_rig, 2 battery, 6 heavy_cable, 4 circuit') },
  { age: 'atomic', kit: amounts('fission_pile, centrifuge, electrolyzer, power_drill, shield_suit, lithium_bank, 6 super_cable') },
];

const merge = (...lists: ItemAmount[][]): ItemAmount[] => {
  const m = new Map<string, number>();
  for (const l of lists) for (const a of l) m.set(a.item, (m.get(a.item) ?? 0) + a.count);
  return [...m].map(([item, count]) => ({ item, count }));
};

/** The gate out of age `i`: the upgrade to furnace tier i+2 and the smallest hearth shell of that tier. */
export function ageGate(i: number): ItemAmount[] {
  const next = FURNACE_TIERS[i + 1];
  if (!next) return [];
  return merge(next.upgradeCost, hearthMats(next.tier));
}

/** Kit plus gate of age `i` (0 = Ember). */
export function ageBundle(i: number): ItemAmount[] {
  return merge(AGE_KITS[i]?.kit ?? [], ageGate(i));
}

export const ageToolTier = (i: number): number => TIME_PARAMS.TOOL_TIER_BY_AGE[i] ?? 5;

/** Expert minutes to leave age `i`. */
export const ageMinutes = (i: number): number => expertMinutes(ageBundle(i), ageToolTier(i));
