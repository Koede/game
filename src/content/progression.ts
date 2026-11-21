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
 *
 * Food (spec 12): animals are hunted bare-handed from the start, so their drops are world resources. Wild plants
 * are natural blocks. A crop yields its ripe drops once its seed, a hoe and tillable soil are all to hand.
 *
 * A richer world (spec 13-14): marsh peat is a natural fuel, a picked berry bush leaves a bare bush (whose drops
 * count too), and a bucket fills from a liquid of the world (wooden bucket from water, bronze bucket from lava).
 * The Old Works' salvage blocks and crate loot are finite bonus finds, so they are not part of the assumed world:
 * content tests hold them to the ages they may hand out instead.
 *
 * Hearths (spec 17): an upgrade to tier 2-5 also needs the materials of that tier's smallest legal shell (its wall
 * blocks, electrodes and power ports), obtainable with the furnace the player already has. Transport (spec 16): a
 * steam turbine is heat-driven like the steam engine - it runs on a boiler over the one furnace, with water to hand.
 *
 * The Emberbound (spec 19): on Normal and Hard the automatons roam from the first night and can be broken by hand,
 * so their drops count from the start like an animal's (source 'automaton:<species>'; the kiln sentries of the ruins
 * are among them, so ember cores are always to hand). Relic drops - parts of a later age than the Ember Age - are
 * bonus finds the tech tree never relies on, like ruin loot. On Peaceful (`solve(..., { peaceful: true })`) there are
 * no automatons and no drops; the objectives that need one complete through the flag FLAG_PEACEFUL.
 */
import { AMBIENT_TEMP_C, DRAFT_FLAME_BONUS_C, FLAG_AUTOMATON_SALVAGED, FLAG_PEACEFUL, FURNACE_BUFF_C } from '../core/constants';
import { smallestShell } from '../core/hearth';
import {
  AUTOMATONS, BLOCKS, CREATURES, FURNACE_TIERS, ITEMS, MACHINES, MAX_FURNACE_TIER, ORE_VEINS, RECIPES,
  block, furnaceTier, item, machine, recipe, recipesFor,
} from '../core/registry';
import type {
  BiomeKey, BlockDef, Drop, FurnaceTierSpec, ItemAmount, LiquidKind, MachineSpec, ObjectiveCondition, RecipeDef, ToolKind,
} from '../core/types';

/** Blocks the world generator places besides ore veins (spec 2.1 "Natural", minus air and the unbreakable floor). */
export const NATURAL_BLOCKS: readonly string[] = [
  'stone', 'rubble', 'dirt', 'grass', 'sand', 'gravel', 'clay', 'snow', 'ice', 'basalt', 'limestone', 'water', 'lava',
  'oak_log', 'oak_leaves', 'pine_log', 'pine_leaves', 'tall_grass', 'dry_shrub',
  'wild_wheat', 'wild_potato', 'wild_carrot',
  'ember_poppy', 'skybell', 'frost_lily', 'fern', 'reeds', 'berry_bush', 'glowcap', 'cactus', 'packed_ice', 'ice_spike',
  'basalt_column', 'steam_vent', 'peat', 'cracked_stone_brick', 'mossy_stone_brick', 'crystal_cluster', 'oil',
];

/** Ruin blocks that hold finite salvage (spec 14): bonus finds, left out of the assumed world. */
export const RUIN_SALVAGE_BLOCKS: readonly string[] = ['collapsed_furnace', 'rusted_shell'];

/**
 * Natural blocks that only one biome has (as far as the tech tree may assume); every other natural block occurs in
 * any biome. Tests prove the game can be finished from each biome alone.
 */
export const BIOME_ONLY_BLOCKS: Readonly<Record<BiomeKey, readonly string[]>> = {
  woodland: ['fern'],
  dunes: ['cactus'],
  frostfell: ['snow', 'ice', 'packed_ice', 'ice_spike', 'frost_lily'],
  scar: ['basalt', 'basalt_column', 'steam_vent'],
  marsh: ['peat'],
};

/** Using an empty container on a liquid of the world fills it: [container, liquid, filled item] (spec 13). */
export const BUCKET_FILLS: ReadonlyArray<readonly [string, LiquidKind, string]> = [
  ['pail', 'water', 'water_pail'],
  ['bronze_bucket', 'lava', 'lava_bucket'],
];

/** Blocks a hoe turns into farmland. */
export const TILLABLE_BLOCKS: readonly string[] = ['grass', 'dirt'];

/** The item that places a block: its own block item, or another item that plants it (seeds, potato, carrot). */
export function itemPlacing(blockKey: string): string | null {
  return block(blockKey).itemKey ?? ITEMS.find((it) => it.block === blockKey)?.key ?? null;
}

/** The block items a hearth's electrodes and power ports are. */
export const ELECTRODE_ITEM = 'electrode';
export const POWER_PORT_ITEM = 'power_port';

/**
 * What the smallest legal hearth of a tier is built from (spec 17.1): its own wall block for every shell cell but the
 * controller and the parts, plus the electrodes and power ports it requires. Empty for tier 1.
 */
export function hearthMaterials(tier: number): ItemAmount[] {
  const s = furnaceTier(tier).structure;
  if (!s) return [];
  const shell = smallestShell(s);
  const out: ItemAmount[] = [{ item: s.wall[0], count: shell.wall }];
  if (shell.electrodes > 0) out.push({ item: ELECTRODE_ITEM, count: shell.electrodes });
  if (shell.powerPorts > 0) out.push({ item: POWER_PORT_ITEM, count: shell.powerPorts });
  return out;
}

/**
 * A relic (spec 19): an automaton's drop of a part from a later age than the Ember Age. Relics are lucky finds the
 * solver leaves out, so the tech tree never waits on a lucky drop and every age keeps its meaning.
 */
export const isRelic = (drop: Drop): boolean => item(drop.item).age > 0;

/** Every relic an automaton can carry, in authored order, without repeats. */
export const AUTOMATON_RELICS: readonly string[] = [...new Set(AUTOMATONS.flatMap((c) => c.drops.filter(isRelic).map((d) => d.item)))];

/** How many units of one generator or battery kind a "reasonable grid" is assumed to have. */
export const GRID_UNITS = 8;

export interface Progress {
  /** Furnace tier reached (0 = no furnace yet). */
  tier: number;
  /** Automatons roam this world (false on Peaceful). */
  hostiles: boolean;
  /** Keys of every obtainable item. */
  items: ReadonlySet<string>;
  /** Ids of every usable recipe. */
  recipes: ReadonlySet<string>;
  /**
   * How each item was first obtained: the id of a recipe, 'world' (mined, gathered, scooped), 'upgrade',
   * 'animal:<species>' (hunted), 'automaton:<species>' (salvaged) or 'crop:<block>' (harvested ripe).
   */
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

/** Blocks in the world, plus what harvesting them leaves behind (a picked berry bush), transitively. */
function withHarvests(keys: Iterable<string>): BlockDef[] {
  const out = new Set<string>(keys);
  for (const key of out) {
    const leaves = block(key).harvestLeaves;
    if (leaves) out.add(leaves);
  }
  return [...out].map(block);
}
const worldKeys: readonly string[] = [...new Set([...NATURAL_BLOCKS, ...ORE_VEINS.map((v) => v.block)])];
const worldBlocks: BlockDef[] = withHarvests(worldKeys);
const generators = [...MACHINES.values()].filter((m) => m.role === 'generator');
const storages = [...MACHINES.values()].filter((m) => m.role === 'storage');
const cables = BLOCKS.filter((b) => b.power === 'cable' && b.itemKey !== null);
/** Each crop: the item that plants it and the ripe stage, whose drops a harvest yields. */
const crops = [...MACHINES.values()].filter((m) => m.role === 'crop').flatMap((m) => {
  const stagesOf = new Map<string, string[]>();
  for (const key of m.blocks) {
    const name = key.replace(/_\d+$/, '');
    stagesOf.set(name, [...(stagesOf.get(name) ?? []), key]);
  }
  return [...stagesOf.values()].map((stages) => ({ seed: itemPlacing(stages[0]), ripe: block(stages[stages.length - 1]) }));
});
/** Recipes run by a processing machine (the furnace is a machine kind too, but it is the player who works it). */
export const isMachineRecipe = (r: RecipeDef): boolean => r.station !== 'hand' && r.station !== 'workbench' && r.station !== 'furnace';
/** Generators that run on the steam of a boiler (spec 16.5). */
const steamFed = (m: MachineSpec): boolean => m.fluids?.accepts?.includes('steam') ?? false;
const boilers = [...MACHINES.values()].filter((m) => m.role === 'boiler');
const pumps = [...MACHINES.values()].filter((m) => m.kind === 'pump');
/** Generators that live off a furnace's heat (directly or through a boiler) cannot be what heats that furnace electrically. */
const heatDriven = (m: MachineSpec): boolean => m.params?.heatPerWatt !== undefined || steamFed(m);

/** World options of a solve: Peaceful has no automatons. */
export interface SolveOptions {
  peaceful?: boolean;
}

/**
 * Everything obtainable and doable with a furnace of at most `maxTier` (0 = before the first furnace).
 * `missing` removes blocks from the assumed world, to prove that nothing essential hangs on them.
 */
export function solve(maxTier: number, missing: readonly string[] = [], options: SolveOptions = {}): Progress {
  const hostiles = options.peaceful !== true;
  const world = withHarvests(worldKeys.filter((key) => !missing.includes(key)));
  const worldHasLiquid = (kind: LiquidKind): boolean => world.some((b) => b.liquid === kind);
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
  /** Watts a heat-driven generator makes over a furnace at `hottest`: directly, or from a boiler's steam. */
  const heatW = (m: MachineSpec, hottest: number): number => {
    const p = m.params ?? {};
    if (!steamFed(m)) return Math.min(p.capW ?? 0, (p.wattsPerC ?? 0) * (hottest - (p.minTempC ?? 0)));
    const boiler = boilers.find(owns);
    if (!boiler || !(hasWater() || pumps.some(owns))) return 0;
    const b = boiler.params ?? {};
    const steam = Math.min(b.capLPerS, Math.max(0, b.steamLPerC * (hottest - b.minTempC)));
    return (m.outputW ?? 0) * Math.min(1, steam / p.steamLPerS);
  };
  const generationW = (): number => {
    const hottest = Math.max(...temps());
    const heat = generators.filter((m) => heatDriven(m) && tier >= 1 && runs(m)).map((m) => heatW(m, hottest));
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
    // An empty bucket used on its liquid fills (item use, not a recipe).
    for (const [empty, liquid, full] of BUCKET_FILLS) {
      if (items.has(empty) && worldHasLiquid(liquid) && gain(full, 'world')) changed = true;
    }
    // Animals live in the world from the start and can be hunted by hand.
    for (const c of CREATURES) {
      for (const drop of c.drops) if ((drop.chance ?? 1) > 0 && gain(drop.item, `animal:${c.key}`)) changed = true;
    }
    // So do the automatons (not on Peaceful); their relic parts are left to luck.
    for (const c of hostiles ? AUTOMATONS : []) {
      for (const drop of c.drops) if ((drop.chance ?? 1) > 0 && !isRelic(drop) && gain(drop.item, `automaton:${c.key}`)) changed = true;
    }
    if (canTill(world, items)) {
      for (const crop of crops) {
        if (!crop.seed || !items.has(crop.seed)) continue;
        for (const drop of crop.ripe.drops) if (gain(drop.item, `crop:${crop.ripe.key}`)) changed = true;
      }
    }

    if (tier === 0 && maxTier >= 1 && items.has(furnaceTier(1).block)) {
      tier = 1;
      changed = true;
    }
    while (tier >= 1 && tier < Math.min(maxTier, MAX_FURNACE_TIER)) {
      const next = furnaceTier(tier + 1);
      const affordable = [...next.upgradeCost, ...hearthMaterials(next.tier)].every((c) => items.has(c.item));
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
    tier, hostiles, items, recipes, source, tempC,
    hottestC: Math.max(...tempC),
    generationW: generationW(),
    storageJ: GRID_UNITS * (bank?.capacityJ ?? 0),
    storageRateW: GRID_UNITS * (bank?.rateW ?? 0),
    cableRatingW: cableRatingW(),
  };
}

const hasFuel = (p: Progress): boolean => [...p.items].some((key) => item(key).fuel !== undefined);

/** A hoe in hand and soil to use it on. */
function canTill(world: readonly BlockDef[], items: ReadonlySet<string>): boolean {
  const hoe = [...items].some((key) => item(key).tool?.kind === 'hoe');
  return hoe && world.some((b) => TILLABLE_BLOCKS.includes(b.key));
}

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
  // The bellows are part of every fuel-fired furnace: pumping needs no bellows item.
  bellows_pumped: (p) => p.tier >= 1,
  well_warmed: (p) => p.tier >= 1 && p.hottestC >= FURNACE_BUFF_C,
  rested: (p) => p.tier >= 1 && hasFuel(p),
  machine_job: (p) => RECIPES.some((r) => isMachineRecipe(r) && p.recipes.has(r.id)),
  ignited: canIgnite,
  ate: (p) => [...p.items].some((key) => item(key).food !== undefined),
  tilled: (p) => canTill(worldBlocks, p.items),
  // Spec 19: an automaton broken apart (bare hands will do, slowly), or a world on Peaceful.
  [FLAG_AUTOMATON_SALVAGED]: (p) => p.hostiles,
  [FLAG_PEACEFUL]: (p) => !p.hostiles,
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
      return p.items.has(itemPlacing(c.block) ?? '');
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
