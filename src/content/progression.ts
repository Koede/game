/**
 * Progression solver: works out, from the resolved content alone, what a player can obtain and do while owning a
 * furnace of at most a given tier. It is a design and balance tool - content.test.ts uses it to prove that the
 * game can be completed and that ages, objectives and rewards agree with the tech tree. The running game never
 * imports it.
 *
 * The model errs on the strict side: electric heat needs a cable and is limited by the best cable's rating,
 * water has to be carried in a pail, a fire only gets a draft once a bellows exists, a temperature only counts
 * when the heat balance of that furnace tier can actually hold it, and only the player's own tools mine (a bore
 * rig is taken to reach nothing a steel pickaxe could not).
 */
import { AMBIENT_TEMP_C, DRAFT_FLAME_BONUS_C, FURNACE_BUFF_C } from '../core/constants';
import {
  BLOCKS, FURNACE_TIERS, MACHINES, MAX_FURNACE_TIER, ORE_VEINS, RECIPES,
  block, furnaceTier, item, machine, recipe, recipesFor,
} from '../core/registry';
import type { BlockDef, FurnaceTierSpec, ItemAmount, MachineSpec, ObjectiveCondition, RecipeDef, ToolKind } from '../core/types';

/** Blocks the world generator places besides ore veins (spec 2.1 "Natural", minus air and the unbreakable floor). */
export const NATURAL_BLOCKS: readonly string[] = [
  'stone', 'rubble', 'dirt', 'grass', 'sand', 'gravel', 'clay', 'snow', 'ice', 'basalt', 'limestone', 'water', 'lava',
  'oak_log', 'oak_leaves', 'pine_log', 'pine_leaves', 'tall_grass', 'dry_shrub',
];

/** How many units of one generator or battery kind a "reasonable grid" is assumed to have. */
export const GRID_UNITS = 8;

export interface Progress {
  /** Furnace tier reached (0 = no furnace yet). */
  tier: number;
  /** Keys of every obtainable item. */
  items: ReadonlySet<string>;
  /** Ids of every usable recipe. */
  recipes: ReadonlySet<string>;
  /** How each item was first obtained: the id of a recipe, 'world' (mined, gathered, scooped) or 'upgrade'. */
  source: ReadonlyMap<string, string>;
  /** Hottest temperature each owned tier can hold; index = tier, index 0 is ambient. */
  tempC: readonly number[];
  /** Hottest of those. */
  hottestC: number;
  /** Watts a grid of GRID_UNITS of the best working generator makes (heat-driven ones count once: one furnace). */
  generationW: number;
  /** Joules and watts of GRID_UNITS of the best obtainable battery. */
  storageJ: number;
  storageRateW: number;
  /** Rating of the best obtainable cable (0 = none). */
  cableRatingW: number;
}

const worldBlocks: BlockDef[] = [...new Set([...NATURAL_BLOCKS, ...ORE_VEINS.map((v) => v.block)])].map(block);
const generators = [...MACHINES.values()].filter((m) => m.role === 'generator');
const storages = [...MACHINES.values()].filter((m) => m.role === 'storage');
const cables = BLOCKS.filter((b) => b.power === 'cable' && b.itemKey !== null);
/** Recipes run by a processing machine (the furnace is a machine kind too, but it is the player who works it). */
export const isMachineRecipe = (r: RecipeDef): boolean => r.station !== 'hand' && r.station !== 'workbench' && r.station !== 'furnace';
/** Generators that live off a furnace's heat cannot be what heats that furnace electrically. */
const heatDriven = (m: MachineSpec): boolean => m.params?.heatPerWatt !== undefined;

/**
 * Everything obtainable and doable with a furnace of at most `maxTier` (0 = before the first furnace).
 * `missing` removes blocks from the assumed world, to prove that nothing essential hangs on them.
 */
export function solve(maxTier: number, missing: readonly string[] = []): Progress {
  const world = worldBlocks.filter((b) => !missing.includes(b.key));
  const worldHasLiquid = (kind: 'water' | 'lava'): boolean => world.some((b) => b.liquid === kind);
  const items = new Set<string>();
  const source = new Map<string, string>();
  const recipes = new Set<string>();
  let tier = 0;

  const gain = (key: string, how: string): boolean => {
    if (items.has(key)) return false;
    items.add(key);
    source.set(key, how);
    return true;
  };
  const toolTier = (kind: ToolKind | null): number => {
    let best = 0;
    for (const key of items) {
      const tool = item(key).tool;
      if (tool && (tool.universal || tool.kind === kind)) best = Math.max(best, tool.tier);
    }
    return best;
  };
  const minable = (def: BlockDef): boolean =>
    def.hardness >= 0 && def.liquid === null && (def.minTier === 0 || toolTier(def.tool) >= def.minTier);
  const owns = (m: MachineSpec): boolean => m.blocks.some((b) => items.has(block(b).itemKey ?? ''));
  const hasWater = (): boolean => items.has('water_pail');
  const placed = (m: MachineSpec): boolean => owns(m) && ((m.params?.minWater ?? 0) === 0 || hasWater());
  const runs = (m: MachineSpec): boolean =>
    placed(m) &&
    (!m.fuels?.length || m.fuels.some((f) => items.has(f))) &&
    (m.params?.wattsPerLava === undefined || worldHasLiquid('lava'));
  const gridW = (): number =>
    GRID_UNITS * Math.max(0, ...generators.filter((m) => !heatDriven(m) && runs(m)).map((m) => m.outputW ?? 0));
  const cableRatingW = (): number => Math.max(0, ...cables.filter((c) => items.has(c.itemKey ?? '')).map((c) => c.cableRatingW));

  /** Steady temperature this tier can hold: the best fuel's flame (with a draft once a bellows exists) or electric heat. */
  const holdTemp = (spec: FurnaceTierSpec): number => {
    const draft = items.has('bellows') ? 1 : 0;
    let best = AMBIENT_TEMP_C;
    for (const key of items) {
      const fuel = item(key).fuel;
      if (!fuel) continue;
      const flame = fuel.flameTempC + DRAFT_FLAME_BONUS_C * draft;
      const balance = AMBIENT_TEMP_C + ((fuel.energyJ / fuel.burnS) * (1 + draft)) / spec.lossWPerC;
      best = Math.max(best, Math.min(flame, balance));
    }
    const electricW = Math.min(spec.electricHeatW, cableRatingW(), gridW());
    best = Math.max(best, AMBIENT_TEMP_C + electricW / spec.lossWPerC);
    return Math.min(best, spec.maxTempC);
  };
  const temps = (): number[] => [AMBIENT_TEMP_C, ...FURNACE_TIERS.slice(0, tier).map(holdTemp)];
  const generationW = (): number => {
    const hottest = Math.max(...temps());
    const heat = generators
      .filter((m) => heatDriven(m) && tier >= 1 && runs(m))
      .map((m) => Math.min(m.params?.capW ?? 0, (m.params?.wattsPerC ?? 0) * (hottest - (m.params?.minTempC ?? 0))));
    return Math.max(gridW(), ...heat);
  };
  const usable = (r: RecipeDef): boolean => {
    if (!r.inputs.every((i) => items.has(i.item))) return false;
    if (r.station === 'hand') return true;
    if (r.station === 'workbench') return items.has('workbench');
    if (r.station === 'furnace') return tier >= r.minTier && Math.max(...temps().slice(r.minTier)) >= r.minTempC;
    const m = MACHINES.get(r.station);
    return m !== undefined && placed(m) && generationW() >= (m.drawW ?? 0);
  };

  for (let changed = true; changed; ) {
    changed = false;
    for (const def of world) {
      if (!minable(def)) continue;
      for (const drop of def.drops) if ((drop.chance ?? 1) > 0 && gain(drop.item, 'world')) changed = true;
    }
    // A pail used on water becomes a pail of water (item use, not a recipe).
    if (items.has('pail') && worldHasLiquid('water') && gain('water_pail', 'world')) changed = true;

    if (tier === 0 && maxTier >= 1 && items.has(furnaceTier(1).block)) {
      tier = 1;
      changed = true;
    }
    while (tier >= 1 && tier < Math.min(maxTier, MAX_FURNACE_TIER)) {
      const next = furnaceTier(tier + 1);
      const affordable = next.upgradeCost.every((c) => items.has(c.item));
      if (!affordable || holdTemp(furnaceTier(tier)) < next.upgradeTempC) break;
      tier++;
      gain(next.block, 'upgrade');
      changed = true;
    }
    for (const r of RECIPES) {
      if (recipes.has(r.id) || !usable(r)) continue;
      recipes.add(r.id);
      gain(r.output.item, r.id);
      for (const extra of r.byproducts) gain(extra.item, r.id);
      changed = true;
    }
  }

  const tempC = temps();
  const bank = storages.filter(owns).sort((a, b) => (b.capacityJ ?? 0) - (a.capacityJ ?? 0))[0];
  return {
    tier, items, recipes, source, tempC,
    hottestC: Math.max(...tempC),
    generationW: generationW(),
    storageJ: GRID_UNITS * (bank?.capacityJ ?? 0),
    storageRateW: GRID_UNITS * (bank?.rateW ?? 0),
    cableRatingW: cableRatingW(),
  };
}

const hasFuel = (p: Progress): boolean => [...p.items].some((key) => item(key).fuel !== undefined);

/** Starhearth ignition: the top tier at ignition temperature, with cable and supply for ignition plus holding the heat. */
function canIgnite(p: Progress): boolean {
  const params = machine('furnace').params ?? {};
  const top = furnaceTier(MAX_FURNACE_TIER);
  if (p.tier < MAX_FURNACE_TIER || p.tempC[MAX_FURNACE_TIER] < params.ignitionTempC) return false;
  const needW = params.ignitionPowerW + top.lossWPerC * (params.ignitionTempC - AMBIENT_TEMP_C);
  return p.cableRatingW >= needW && p.generationW + p.storageRateW >= needW;
}

/** When each flag the game code emits can be earned. */
const FLAG_RULES: Record<string, (p: Progress) => boolean> = {
  furnace_lit: (p) => p.tier >= 1 && hasFuel(p),
  bellows_pumped: (p) => p.tier >= 1 && p.items.has('bellows'),
  well_warmed: (p) => p.tier >= 1 && p.hottestC >= FURNACE_BUFF_C,
  rested: (p) => p.tier >= 1 && hasFuel(p),
  machine_job: (p) => RECIPES.some((r) => isMachineRecipe(r) && p.recipes.has(r.id)),
  ignited: canIgnite,
};
export const KNOWN_FLAGS: readonly string[] = Object.keys(FLAG_RULES);

/** Whether an objective condition can be satisfied with what `p` offers. */
export function conditionMet(c: ObjectiveCondition, p: Progress): boolean {
  switch (c.type) {
    case 'have':
      return p.items.has(c.item);
    case 'make':
      return recipesFor(c.item).some((r) => p.recipes.has(r.id));
    case 'place':
      return p.items.has(block(c.block).itemKey ?? '');
    case 'break': {
      const def = block(c.block);
      return def.hardness >= 0 && (worldBlocks.includes(def) || p.items.has(def.itemKey ?? ''));
    }
    case 'furnaceTemp':
      return p.tier >= 1 && p.hottestC >= c.tempC;
    case 'furnaceTier':
      return p.tier >= c.tier;
    case 'generate':
      return p.generationW >= c.watts;
    case 'stored':
      return p.generationW > 0 && p.storageJ >= c.joules;
    case 'flag':
      return FLAG_RULES[c.flag]?.(p) ?? false;
    case 'any':
      return c.of.some((inner) => conditionMet(inner, p));
  }
}

/**
 * Raw inputs (things taken from the world) behind a list of items, following the route by which the solver
 * first obtained each one. Counts are fractional: batch recipes are costed pro rata. `visit` sees every item on
 * the route, intermediates included.
 */
export function rawCost(p: Progress, wanted: readonly ItemAmount[], visit?: (key: string) => void): Map<string, number> {
  const totals = new Map<string, number>();
  const add = (key: string, count: number): void => {
    visit?.(key);
    const made = recipe(p.source.get(key) ?? '');
    if (!made) {
      totals.set(key, (totals.get(key) ?? 0) + count);
      return;
    }
    for (const input of made.inputs) add(input.item, (count * input.count) / made.output.count);
  };
  for (const w of wanted) add(w.item, w.count);
  return totals;
}
