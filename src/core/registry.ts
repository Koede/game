/**
 * The registry: resolves the authored content (src/content) into fast lookup tables.
 * Pure data, no DOM - imported by the game, by the chunk worker and by node tests alike.
 *
 * Everything outside src/content reads blocks, items and recipes through this module.
 */
import { ITEM_ALIASES, noteLostItem } from '../content/aliases';
import { STATUS_COUNT, statusTextureName, voxelStatus } from './machineStatus';
import {
  AGES as AGE_SPECS,
  AUTOMATON_SPECS,
  BLOCK_SPECS,
  CAST_METAL_SPECS,
  CREATURE_SPECS,
  FLUID_SPECS,
  FURNACE_TIERS as FURNACE_TIER_SPECS,
  ITEM_SPECS,
  ITEM_RARITY,
  LOOT_TABLES as LOOT_TABLE_SPECS,
  NAMED_TABLES as NAMED_TABLE_SPECS,
  applyNamedFind,
  STRUCTURE_LOOT as STRUCTURE_LOOT_SPECS,
  MACHINE_SPECS,
  MOULD_SPECS,
  OBJECTIVES as OBJECTIVE_SPECS,
  ORE_VEINS as ORE_VEIN_SPECS,
  RECIPE_SPECS,
} from '../content';
import {
  ALL_BIOMES,
  Face,
  FACING_TO_FACE,
  VOXEL_ID_MASK,
  voxelActive,
  voxelFacing,
  voxelId,
  type AgeSpec,
  type BlockDef,
  type BlockSpec,
  type CreatureSpec,
  type Drop,
  type Facing,
  type FluidKey,
  type FluidSpec,
  type FuelSpec,
  type FurnaceTierSpec,
  type ItemDef,
  type ItemSpec,
  type ItemStack,
  type LootRarity,
  type LootEntry,
  type LootTableSpec,
  type LiquidKind,
  type LootTier,
  type MachineSpec,
  type ObjectiveCondition,
  type ObjectiveSpec,
  type OreVeinSpec,
  type RecipeDef,
  type CastMetalSpec,
  type MouldSpec,
  type Voxel,
  LOOT_MAX_DEPTH,
} from './types';
import { enchantStack } from './enchant';
import { maxDurabilityOf } from '../game/inventory';
import { validateTech } from './techValidation';
import { validateAutomaton, validateGear } from './hostileValidation';
import { validateBrewing } from './brewValidation';
import { handStationKeys, validateHand } from './handValidation';

// ---------------------------------------------------------------------------------------------
// Textures: every texture name referenced by content gets a layer in one texture array.
// Layer 0 is always the "missing" texture.
// ---------------------------------------------------------------------------------------------

export const MISSING_TEXTURE = 'missing';
const textureNames: string[] = [MISSING_TEXTURE];
const textureLayers = new Map<string, number>([[MISSING_TEXTURE, 0]]);

function layerOf(name: string): number {
  let layer = textureLayers.get(name);
  if (layer === undefined) {
    layer = textureNames.length;
    textureNames.push(name);
    textureLayers.set(name, layer);
  }
  return layer;
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

function resolveBlock(spec: BlockSpec, id: number): BlockDef {
  const shape = spec.shape ?? 'cube';
  const t = spec.textures ?? {};
  const fallback = shape === 'none' ? MISSING_TEXTURE : `block_${spec.key}`;
  const side = t.side ?? t.all ?? fallback;
  const top = t.top ?? t.all ?? side;
  const bottom = t.bottom ?? t.top ?? t.all ?? side;
  const front = t.front ?? side;
  const sideA = t.sideActive ?? side;
  const topA = t.topActive ?? top;
  const bottomA = t.bottomActive ?? bottom;
  const frontA = t.frontActive ?? (t.front ? front : sideA);

  const layers: number[] = [];
  const layersActive: number[] = [];
  const put = (face: Face, name: string, nameActive: string): void => {
    layers[face] = shape === 'none' ? 0 : layerOf(name);
    layersActive[face] = shape === 'none' ? 0 : layerOf(nameActive);
  };
  put(Face.PX, side, sideA);
  put(Face.NX, side, sideA);
  put(Face.PY, top, topA);
  put(Face.NY, bottom, bottomA);
  put(Face.PZ, side, sideA);
  put(Face.NZ, front, frontA);
  for (const name of t.models ?? []) layerOf(name);

  // Status looks: the off textures of the faces that show a running machine (else the front), with a status badge.
  const layersStatus: (number[] | null)[] = [null];
  if (t.status && shape !== 'none') {
    const names = [side, side, top, bottom, side, front];
    const faces = [Face.PX, Face.NX, Face.PY, Face.NY, Face.PZ, Face.NZ].filter((f) => layers[f] !== layersActive[f]);
    const shown = faces.length > 0 ? faces : spec.oriented ? [Face.NZ] : [Face.PX, Face.NX, Face.PZ, Face.NZ];
    for (let status = 1; status < STATUS_COUNT; status++) {
      const l = layers.slice();
      for (const f of shown) l[f] = layerOf(statusTextureName(names[f], status));
      layersStatus.push(l);
    }
  }

  const hasItem = spec.item ?? shape !== 'none';
  let drops: Drop[];
  if (spec.drops === 'none') drops = [];
  else if (spec.drops === undefined || spec.drops === 'self') drops = hasItem ? [{ item: spec.key, count: 1 }] : [];
  else drops = spec.drops;

  return {
    id,
    key: spec.key,
    name: spec.name,
    desc: spec.desc ?? '',
    shape,
    solid: spec.solid ?? (shape === 'cube' || shape === 'slab' || shape === 'fence' || shape === 'stairs' || shape === 'slope'),
    opaque: spec.opaque ?? shape === 'cube',
    translucent: spec.translucent ?? false,
    hardness: spec.hardness ?? 1,
    tool: spec.tool ?? null,
    minTier: spec.minTier ?? 0,
    drops,
    light: spec.light ?? 0,
    lightActive: spec.lightActive ?? spec.light ?? 0,
    warmth: spec.warmth ?? 0,
    warmthActive: spec.warmthActive ?? spec.warmth ?? 0,
    replaceable: spec.replaceable ?? false,
    liquid: spec.liquid ?? null,
    oriented: spec.oriented ?? false,
    contactDamage: spec.contactDamage ?? 0,
    radiation: spec.radiation ?? 0,
    station: spec.station ?? null,
    machine: spec.machine ?? null,
    power: spec.power ?? null,
    cableRatingW: spec.cableRatingW ?? 0,
    age: spec.age ?? 0,
    placeOn: spec.placeOn ?? null,
    harvestLeaves: spec.harvestLeaves ?? null,
    pipe: spec.pipe ?? null,
    handStation: spec.handStation ?? null,
    itemKey: hasItem ? spec.key : null,
    layers,
    layersActive,
    layersStatus,
  };
}

if (BLOCK_SPECS.length === 0 || BLOCK_SPECS[0].key !== 'air') {
  throw new Error('content: BLOCK_SPECS[0] must be the "air" block');
}
if (BLOCK_SPECS.length > VOXEL_ID_MASK + 1) throw new Error('content: too many blocks for the voxel encoding');

/** All blocks, indexed by numeric id. BLOCKS[0] is air. */
export const BLOCKS: BlockDef[] = BLOCK_SPECS.map(resolveBlock);
const blocksByKey = new Map<string, BlockDef>();
for (const def of BLOCKS) {
  if (blocksByKey.has(def.key)) throw new Error(`content: duplicate block key "${def.key}"`);
  blocksByKey.set(def.key, def);
}

/** Block by key. Throws on unknown keys - a typo should fail loudly at startup, not silently place air. */
export function block(key: string): BlockDef {
  const def = blocksByKey.get(key);
  if (!def) throw new Error(`unknown block "${key}"`);
  return def;
}
export const blockOrNull = (key: string): BlockDef | null => blocksByKey.get(key) ?? null;
/** Numeric id of a block key. */
export const blockId = (key: string): number => block(key).id;
/** Block definition of a voxel value. Unknown ids resolve to air. */
export const blockOf = (v: Voxel): BlockDef => BLOCKS[voxelId(v)] ?? BLOCKS[0];

/** Texture layer of one face of a block, taking its facing and active flag into account. */
export function faceLayer(def: BlockDef, face: Face, facing: Facing, active: boolean, status = 0): number {
  const layers = (status > 0 ? def.layersStatus[status] : null) ?? (active ? def.layersActive : def.layers);
  if (!def.oriented || face === Face.PY || face === Face.NY) return layers[face];
  return face === FACING_TO_FACE[facing] ? layers[Face.NZ] : layers[Face.PX];
}
export const voxelFaceLayer = (v: Voxel, face: Face): number =>
  faceLayer(blockOf(v), face, voxelFacing(v), voxelActive(v), voxelStatus(v));
/** Light emitted by a voxel (0..15), honouring its active flag. */
export const voxelLight = (v: Voxel): number => {
  const def = blockOf(v);
  return voxelActive(v) ? def.lightActive : def.light;
};
/** Warmth radius of a voxel in blocks, honouring its active flag. */
export const voxelWarmth = (v: Voxel): number => {
  const def = blockOf(v);
  return voxelActive(v) ? def.warmthActive : def.warmth;
};

// ---------------------------------------------------------------------------------------------
// Items (explicit item specs plus one generated item per placeable block)
// ---------------------------------------------------------------------------------------------

function resolveItems(): ItemDef[] {
  const specs: ItemSpec[] = [];
  const explicit = new Map<string, ItemSpec>();
  for (const spec of ITEM_SPECS) {
    if (explicit.has(spec.key)) throw new Error(`content: duplicate item key "${spec.key}"`);
    explicit.set(spec.key, spec);
  }
  for (const spec of BLOCK_SPECS) {
    const def = block(spec.key);
    if (!def.itemKey) continue;
    const own = explicit.get(spec.key);
    if (own) {
      specs.push({ ...own, block: own.block ?? spec.key });
      explicit.delete(spec.key);
    } else {
      specs.push({
        key: spec.key,
        name: spec.name,
        desc: spec.desc,
        block: spec.key,
        stack: spec.stack,
        category: spec.category ?? (spec.machine ? 'machine' : 'block'),
        age: spec.age ?? 0,
      });
    }
  }
  for (const spec of explicit.values()) specs.push(spec);

  return specs.map((spec, id) => {
    const placed = spec.block ? block(spec.block) : null;
    let iconLayer: number;
    if (spec.icon) iconLayer = layerOf(spec.icon);
    else if (placed) {
      const cubeLike = placed.shape === 'cube' || placed.shape === 'slab' || placed.shape === 'liquid' || placed.shape === 'fence' || placed.shape === 'stairs' || placed.shape === 'slope';
      iconLayer = cubeLike ? -1 : placed.layers[Face.PX];
    } else iconLayer = layerOf(`item_${spec.key}`);
    return {
      ...spec,
      id,
      stack: spec.stack ?? (spec.tool ? 1 : 99),
      desc: spec.desc ?? '',
      iconLayer,
    };
  });
}

/** All items, indexed by numeric id (ids are not stable across versions - persist keys). */
export const ITEMS: ItemDef[] = resolveItems();
const itemsByKey = new Map<string, ItemDef>(ITEMS.map((it) => [it.key, it]));

export function item(key: string): ItemDef {
  const def = itemsByKey.get(key);
  if (!def) throw new Error(`unknown item "${key}"`);
  return def;
}
export const itemOrNull = (key: string): ItemDef | null => itemsByKey.get(key) ?? null;
/**
 * A stored item key resolved for loading: itself, its alias (content/aliases.ts), or null (then counted as lost so the
 * player is told). Use this, not `itemOrNull`, wherever a SAVED item key is read back.
 */
export function canonicalItemKey(key: string): string | null {
  if (itemsByKey.has(key)) return key;
  const to = ITEM_ALIASES[key];
  if (to !== undefined && itemsByKey.has(to)) return to;
  noteLostItem(key);
  return null;
}
export const fuelOf = (key: string): FuelSpec | null => itemsByKey.get(key)?.fuel ?? null;
/** The block an item places, or null. */
export const blockOfItem = (key: string): BlockDef | null => {
  const def = itemsByKey.get(key);
  return def?.block ? block(def.block) : null;
};

/** Texture names in layer order. src/render paints one 16x16 texture per entry. */
export const TEXTURE_NAMES: readonly string[] = textureNames;
export const textureLayer = (name: string): number => textureLayers.get(name) ?? 0;

// ---------------------------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------------------------

export const RECIPES: RecipeDef[] = RECIPE_SPECS.map((r) => ({
  ...r,
  kind: r.kind ?? 'forge',
  byproducts: r.byproducts ?? [],
  timeS: r.timeS ?? 0,
  minTempC: r.minTempC ?? 0,
  minTier: r.minTier ?? 1,
  energyJ: r.energyJ ?? 0,
}));
const recipesById = new Map<string, RecipeDef>();
const recipesByStationMap = new Map<string, RecipeDef[]>();
const recipesByOutput = new Map<string, RecipeDef[]>();
for (const r of RECIPES) {
  if (recipesById.has(r.id)) throw new Error(`content: duplicate recipe id "${r.id}"`);
  recipesById.set(r.id, r);
  const byStation = recipesByStationMap.get(r.station) ?? [];
  byStation.push(r);
  recipesByStationMap.set(r.station, byStation);
  const byOutput = recipesByOutput.get(r.output.item) ?? [];
  byOutput.push(r);
  recipesByOutput.set(r.output.item, byOutput);
}

export const recipe = (id: string): RecipeDef | null => recipesById.get(id) ?? null;
/** Recipes made at a station ('hand', 'workbench', 'furnace' or a machine kind), in authored order. */
export const recipesAt = (station: string): readonly RecipeDef[] => recipesByStationMap.get(station) ?? [];
/** Recipes whose main output is the given item. */
export const recipesFor = (itemKey: string): readonly RecipeDef[] => recipesByOutput.get(itemKey) ?? [];

// ---------------------------------------------------------------------------------------------
// Technology
// ---------------------------------------------------------------------------------------------

export const AGES: readonly AgeSpec[] = AGE_SPECS;
/** Furnace tiers sorted by tier; FURNACE_TIERS[0] is tier 1. */
export const FURNACE_TIERS: readonly FurnaceTierSpec[] = [...FURNACE_TIER_SPECS].sort((a, b) => a.tier - b.tier);
export const furnaceTier = (tier: number): FurnaceTierSpec => {
  const spec = FURNACE_TIERS[tier - 1];
  if (!spec) throw new Error(`unknown furnace tier ${tier}`);
  return spec;
};
/** Tier spec of a furnace block key, or null when the block is not a furnace. */
export const furnaceTierOfBlock = (blockKey: string): FurnaceTierSpec | null =>
  FURNACE_TIERS.find((t) => t.block === blockKey) ?? null;
export const MAX_FURNACE_TIER = FURNACE_TIERS.length;

export const MACHINES: ReadonlyMap<string, MachineSpec> = new Map(MACHINE_SPECS.map((m) => [m.kind, m]));
export function machine(kind: string): MachineSpec {
  const spec = MACHINES.get(kind);
  if (!spec) throw new Error(`unknown machine "${kind}"`);
  return spec;
}
/** Machine spec carried by a block, or null. */
export const machineOfBlock = (def: BlockDef): MachineSpec | null => (def.machine ? MACHINES.get(def.machine) ?? null : null);

export const OBJECTIVES: readonly ObjectiveSpec[] = OBJECTIVE_SPECS;
export const ORE_VEINS: readonly OreVeinSpec[] = ORE_VEIN_SPECS;

// ---------------------------------------------------------------------------------------------
// Creatures
// ---------------------------------------------------------------------------------------------

/** Every animal species, in authored order. */
export const CREATURES: readonly CreatureSpec[] = CREATURE_SPECS;
const creaturesByKey = new Map<string, CreatureSpec>();
for (const c of CREATURES) {
  if (creaturesByKey.has(c.key)) throw new Error(`content: duplicate creature key "${c.key}"`);
  creaturesByKey.set(c.key, c);
}
/**
 * The Emberbound automatons (spec 19), in authored order: every CreatureSpec with `hostile`. They are not in
 * CREATURES (the animal spawner reads that list); creature() and creatureOrNull() find both.
 */
export const AUTOMATONS: readonly CreatureSpec[] = AUTOMATON_SPECS;
for (const c of AUTOMATONS) {
  if (creaturesByKey.has(c.key)) throw new Error(`content: duplicate creature key "${c.key}"`);
  creaturesByKey.set(c.key, c);
}
/** Species (animal or automaton) by key. Throws on unknown keys. */
export function creature(key: string): CreatureSpec {
  const spec = creaturesByKey.get(key);
  if (!spec) throw new Error(`unknown creature "${key}"`);
  return spec;
}
export const creatureOrNull = (key: string): CreatureSpec | null => creaturesByKey.get(key) ?? null;

// ---------------------------------------------------------------------------------------------
// Old Works loot (spec 14)
// ---------------------------------------------------------------------------------------------

/** The loot tables of ruin crates, one per tier. */
export const LOOT_TABLES: readonly LootTableSpec[] = LOOT_TABLE_SPECS;
/** The crate tables of the generated structures, by structure key (docs/SYNERGY_PLAN.md). */
export const STRUCTURE_LOOT: Readonly<Record<string, LootTableSpec>> = STRUCTURE_LOOT_SPECS;
/** The table of a tier. Throws when the content has none. */
export function lootTable(tier: LootTier): LootTableSpec {
  const table = LOOT_TABLES.find((t) => t.tier === tier);
  if (!table) throw new Error(`no loot table for tier "${tier}"`);
  return table;
}

/** Every table that has an id: the ruin tiers ('ruin_near', 'ruin_deep'), the structure tables (by structure key) and the named tables. */
const lootById = new Map<string, LootTableSpec>();
for (const t of LOOT_TABLES) lootById.set(t.id ?? `ruin_${t.tier}`, t);
for (const [key, t] of Object.entries(STRUCTURE_LOOT)) lootById.set(t.id ?? key, t);
for (const t of NAMED_TABLE_SPECS) if (t.id) lootById.set(t.id, t);
/** The tables with ids that are not ruin tiers or structures (the tavern's closet and vault). */
export const NAMED_LOOT_TABLES: readonly LootTableSpec[] = NAMED_TABLE_SPECS;
/** Every loot table by id (tier tables as 'ruin_near' / 'ruin_deep', structure tables by structure key). Throws on an unknown id. */
export function lootTableById(id: string): LootTableSpec {
  const table = lootById.get(id);
  if (!table) throw new Error(`no loot table "${id}"`);
  return table;
}
/** Whether a table id exists. */
export const hasLootTable = (id: string): boolean => lootById.has(id);

const RARITY_RANK: Readonly<Record<LootRarity, number>> = { common: 0, fine: 1, rare: 2, legendary: 3 };
/** Rarity of an item (data only, never a stack field): 'common' unless the item is named in the content's rarity list. */
export function rarityOf(itemKey: string): LootRarity {
  return ITEM_RARITY[itemKey] ?? 'common';
}

const rollCount = (count: number | readonly [number, number], random: () => number): number =>
  typeof count === 'number' ? count : count[0] + Math.floor(random() * (count[1] - count[0] + 1));

export interface RollOptions {
  /** 0 (default) leaves the weights as authored; each point multiplies an entry's weight by 1 + luck x its rarity rank (fine 1, rare 2, legendary 3). */
  luck?: number;
}

/**
 * Fills a container: the table's `guaranteed` entries first (each once), then `rolls` weighted draws (with replacement) from
 * its entries, each of its count, merged into stacks no larger than each item's stack size, in draw order (tools come with full
 * durability, a named find with its fixed enchants). An entry may name another table (`table`), which rolls itself once in place
 * (depth limit LOOT_MAX_DEPTH). `random` returns [0, 1) - pass a stream seeded from the world seed and the container's position
 * so the same world always holds the same loot. A table without guaranteed, nested or rarity data rolls exactly as it always did.
 */
export function rollLoot(table: LootTableSpec, random: () => number, opts: RollOptions = {}): ItemStack[] {
  const out: ItemStack[] = [];
  rollInto(out, table, random, opts.luck ?? 0, 0);
  return out;
}

function addStacks(out: ItemStack[], key: string, amount: number): void {
  let count = amount;
  const def = item(key);
  const stack = def.stack;
  for (const s of out) {
    if (count === 0) break;
    if (s.item !== key || s.count >= stack) continue;
    const moved = Math.min(count, stack - s.count);
    s.count += moved;
    count -= moved;
  }
  for (; count > 0; count -= Math.min(count, stack)) {
    const n = Math.min(count, stack);
    out.push(applyNamedFind(def.tool ? { item: key, count: n, durability: def.tool.durability } : { item: key, count: n }));
  }
}

function give(out: ItemStack[], entry: LootEntry, random: () => number, luck: number, depth: number): void {
  if (entry.table !== undefined) {
    rollInto(out, lootTableById(entry.table), random, luck, depth + 1);
    return;
  }
  const n = rollCount(entry.count, random);
  if (entry.enchants || entry.quality) {
    // A special find is its own stack (never merged), a tool at its quality's full durability with whatever enchants it can take.
    const def = item(entry.item);
    for (let i = 0; i < n; i++) {
      const stack: ItemStack = { item: entry.item, count: 1 };
      if (def.tool) {
        stack.durability = def.tool.durability;
        if (entry.quality) {
          stack.quality = entry.quality;
          stack.durability = maxDurabilityOf(entry.item, entry.quality) ?? def.tool.durability;
        }
      }
      for (const [k, lv] of Object.entries(entry.enchants ?? {})) enchantStack(stack, k, lv, def);
      out.push(stack);
    }
    return;
  }
  addStacks(out, entry.item, n);
}

function rollInto(out: ItemStack[], table: LootTableSpec, random: () => number, luck: number, depth: number): void {
  if (depth > LOOT_MAX_DEPTH) throw new Error(`loot table "${table.id ?? table.tier}" nests deeper than ${LOOT_MAX_DEPTH}`);
  for (const g of table.guaranteed ?? []) give(out, g, random, luck, depth);
  const weigh = luck === 0 ? (e: LootEntry) => e.weight : (e: LootEntry) => e.weight * (1 + luck * RARITY_RANK[e.rarity ?? 'common']);
  const total = table.entries.reduce((sum, e) => sum + weigh(e), 0);
  const draws = rollCount(table.rolls, random);
  for (let d = 0; d < draws; d++) {
    let pick = random() * total;
    const entry = table.entries.find((e) => (pick -= weigh(e)) < 0) ?? table.entries[table.entries.length - 1];
    give(out, entry, random, luck, depth);
  }
}

/** Problems with the tables' entries, ids, nesting (unknown ids, cycles, depth) and the rarity list. */
export function validateLootTables(knownItem: (k: string) => boolean, byId: ReadonlyMap<string, LootTableSpec> = lootById): string[] {
  const problems: string[] = [];
  const entryProblems = (name: string, e: LootEntry): void => {
    if (e.table !== undefined) {
      if (!byId.has(e.table)) problems.push(`loot ${name}: nested table "${e.table}" does not exist`);
    } else {
      if (!knownItem(e.item)) problems.push(`loot ${name}: "${e.item}" is not an item`);
      const [lo, hi] = typeof e.count === 'number' ? [e.count, e.count] : e.count;
      if (!(lo >= 1) || hi < lo) problems.push(`loot ${name}: ${e.item} count must be >= 1`);
    }
    if (!(e.weight > 0)) problems.push(`loot ${name}: ${e.item || e.table} needs a weight > 0`);
    if (e.rarity !== undefined && !(e.rarity in RARITY_RANK)) problems.push(`loot ${name}: unknown rarity "${e.rarity}"`);
  };
  for (const [name, t] of byId) {
    for (const e of t.entries) entryProblems(name, e);
    for (const e of t.guaranteed ?? []) entryProblems(`${name} (guaranteed)`, e);
    // Depth and cycles: walk the nested ids depth first from this table.
    const walk = (cur: LootTableSpec, path: string[]): void => {
      for (const e of [...(cur.guaranteed ?? []), ...cur.entries]) {
        if (e.table === undefined) continue;
        const next = byId.get(e.table);
        if (!next) continue;
        if (path.includes(e.table)) problems.push(`loot ${name}: nesting cycle ${[...path, e.table].join(' > ')}`);
        else if (path.length > LOOT_MAX_DEPTH) problems.push(`loot ${name}: nests deeper than ${LOOT_MAX_DEPTH} (${[...path, e.table].join(' > ')})`);
        else walk(next, [...path, e.table]);
      }
    };
    walk(t, [name]);
  }
  if (byId === lootById) for (const key of Object.keys(ITEM_RARITY)) if (!knownItem(key)) problems.push(`rarity: "${key}" is not an item`);
  return problems;
}

/** The items a table can give, nested tables and guaranteed entries included (for content tests holding every entry to an age). */
export function lootTableItems(table: LootTableSpec, seen: ReadonlySet<LootTableSpec> = new Set()): string[] {
  if (seen.has(table)) return [];
  const next = new Set(seen).add(table);
  const out: string[] = [];
  for (const e of [...(table.guaranteed ?? []), ...table.entries]) {
    if (e.table !== undefined) out.push(...lootTableItems(lootTableById(e.table), next));
    else out.push(e.item);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Fluids, pipes and hearths (spec 16-17). Pure geometry of hearths is in src/core/hearth.ts.
// ---------------------------------------------------------------------------------------------

/** Every fluid, in authored order. */
export const FLUIDS: readonly FluidSpec[] = FLUID_SPECS;
const fluidsByKey = new Map<string, FluidSpec>(FLUIDS.map((f) => [f.key, f]));
/** Fluid by key. Throws on unknown keys. */
export function fluid(key: FluidKey): FluidSpec {
  const spec = fluidsByKey.get(key);
  if (!spec) throw new Error(`unknown fluid "${key}"`);
  return spec;
}
/** Fluid by any string (a saved network, a filter slot), or null. */
export const fluidOrNull = (key: string): FluidSpec | null => fluidsByKey.get(key) ?? null;
/** The fluid a pump draws from a world liquid block (water -> water, lava -> lava, oil -> crude_oil), or null. */
export const fluidOfLiquid = (kind: LiquidKind): FluidSpec | null => FLUIDS.find((f) => f.liquid === kind) ?? null;
/** The fluid a full bucket item holds (water_pail -> water, lava_bucket -> lava), or null for anything else. */
export const fluidInBucket = (itemKey: string): FluidSpec | null => FLUIDS.find((f) => f.bucket?.full === itemKey) ?? null;
/** The full bucket an empty one becomes when it takes 1000 L of `fluid` (pail + water -> water_pail), or null. */
export const bucketFilledWith = (emptyKey: string, key: FluidKey): string | null => {
  const b = fluidsByKey.get(key)?.bucket;
  return b && b.empty === emptyKey ? b.full : null;
};

/** Takes or gives items through a pipe end (spec 16.2): furnaces, item hatches and every machine with slots (crates too). */
export function isItemEndpoint(def: BlockDef): boolean {
  const m = machineOfBlock(def);
  // `itemPipes: false` keeps a slotted machine (the casting bench) out of the pipe graph.
  if (!m || m.itemPipes === false) return false;
  return m.role === 'furnace' || (m.slots ?? 0) > 0 || (m.role === 'hearth_part' && m.kind === 'item_hatch');
}
/** Takes or gives a fluid through a pipe end: every machine with fluid ports (MachineSpec.fluids). */
export const isFluidEndpoint = (def: BlockDef): boolean => machineOfBlock(def)?.fluids !== undefined;

/**
 * Whether a pipe grows an arm towards a neighbour: a pipe of the same family, or an endpoint of that family. Item and
 * fluid pipes never join each other. (A wrench may still switch a joint off; that is per-pipe state in src/sim.)
 */
export function pipeJoins(pipe: BlockDef, other: BlockDef): boolean {
  const family = pipe.pipe?.family;
  if (!family) return false;
  if (other.pipe) return other.pipe.family === family;
  return family === 'item' ? isItemEndpoint(other) : isFluidEndpoint(other);
}
/** Whether a pipe may carry a fluid: fluid pipes only, and hot fluids (lava, steam) only in hot pipes. */
export const pipeCarries = (pipe: BlockDef, f: FluidSpec): boolean =>
  pipe.pipe?.family === 'fluid' && (!f.hot || pipe.pipe.hot === true);

/**
 * The highest hearth tier whose walls this block may form (0 when it is no hearth wall): brick 2, refractory brick 3,
 * plasma casing 4, star casing 5. It satisfies every lower tier too.
 */
export function hearthWallTier(blockKey: string): number {
  let best = 0;
  for (const t of FURNACE_TIERS) if (t.structure?.wall.includes(blockKey)) best = Math.max(best, t.tier);
  return best;
}

// ---------------------------------------------------------------------------------------------
// Validation (used by tests; returns human-readable problems, empty when content is consistent)
// ---------------------------------------------------------------------------------------------

export function validateContent(): string[] {
  const problems: string[] = [];
  const knownItem = (key: string): boolean => itemsByKey.has(key);

  for (const def of BLOCKS) {
    for (const d of def.drops) if (!knownItem(d.item)) problems.push(`block ${def.key}: drop "${d.item}" is not an item`);
    if (def.machine && !MACHINES.has(def.machine)) problems.push(`block ${def.key}: unknown machine "${def.machine}"`);
    if (def.placeOn) for (const k of def.placeOn) if (!blocksByKey.has(k)) problems.push(`block ${def.key}: placeOn "${k}" is not a block`);
    if (def.power === 'cable' && def.cableRatingW <= 0) problems.push(`block ${def.key}: cable without cableRatingW`);
    if (def.light < 0 || def.light > 15 || def.lightActive < 0 || def.lightActive > 15) problems.push(`block ${def.key}: light out of 0..15`);
    if (def.harvestLeaves !== null && !blocksByKey.has(def.harvestLeaves)) problems.push(`block ${def.key}: harvestLeaves "${def.harvestLeaves}" is not a block`);
  }
  for (const it of ITEMS) {
    if (it.block && !blocksByKey.has(it.block)) problems.push(`item ${it.key}: places unknown block "${it.block}"`);
    if (it.age < 0 || it.age >= AGES.length) problems.push(`item ${it.key}: age ${it.age} out of range`);
    if (it.stack < 1) problems.push(`item ${it.key}: stack must be >= 1`);
    const back = it.fuel?.fuelReturns;
    if (back !== undefined && !knownItem(back)) problems.push(`item ${it.key}: fuelReturns "${back}" is not an item`);
    if (back !== undefined && it.stack !== 1) problems.push(`item ${it.key}: a fuel that returns its container must stack to 1`);
  }
  for (const r of RECIPES) {
    if (!knownItem(r.output.item)) problems.push(`recipe ${r.id}: output "${r.output.item}" is not an item`);
    for (const i of r.inputs) if (!knownItem(i.item)) problems.push(`recipe ${r.id}: input "${i.item}" is not an item`);
    for (const b of r.byproducts) if (!knownItem(b.item)) problems.push(`recipe ${r.id}: byproduct "${b.item}" is not an item`);
    if (r.inputs.length === 0) problems.push(`recipe ${r.id}: no inputs`);
    if (r.station !== 'hand' && r.station !== 'workbench' && r.station !== 'furnace' && !MACHINES.has(r.station) && !handStationBlocks.has(r.station)) {
      problems.push(`recipe ${r.id}: unknown station "${r.station}"`);
    }
    if (r.station === 'furnace' && r.minTier > MAX_FURNACE_TIER) problems.push(`recipe ${r.id}: minTier ${r.minTier} exceeds furnace tiers`);
    if (r.station === 'furnace' && r.minTier <= MAX_FURNACE_TIER && r.minTempC > furnaceTier(MAX_FURNACE_TIER).maxTempC) {
      problems.push(`recipe ${r.id}: minTempC ${r.minTempC} is hotter than any furnace gets`);
    }
    if (r.age < 0 || r.age >= AGES.length) problems.push(`recipe ${r.id}: age ${r.age} out of range`);
  }
  FURNACE_TIERS.forEach((t, i) => {
    if (t.tier !== i + 1) problems.push(`furnace tiers must be numbered 1..n without gaps (found ${t.tier} at ${i})`);
    if (!blocksByKey.has(t.block)) problems.push(`furnace tier ${t.tier}: unknown block "${t.block}"`);
    for (const c of t.upgradeCost) if (!knownItem(c.item)) problems.push(`furnace tier ${t.tier}: upgrade cost "${c.item}" is not an item`);
  });
  for (const m of MACHINES.values()) {
    for (const b of m.blocks) {
      const def = blocksByKey.get(b);
      if (!def) problems.push(`machine ${m.kind}: unknown block "${b}"`);
      else if (def.machine !== m.kind) problems.push(`machine ${m.kind}: block "${b}" does not point back to it`);
    }
    for (const f of m.fuels ?? []) if (!knownItem(f)) problems.push(`machine ${m.kind}: fuel "${f}" is not an item`);
  }
  const objectiveIds = new Set<string>();
  for (const o of OBJECTIVES) {
    if (objectiveIds.has(o.id)) problems.push(`objective ${o.id}: duplicate id`);
    objectiveIds.add(o.id);
    const checkCondition = (c: ObjectiveCondition): void => {
      if ((c.type === 'have' || c.type === 'make') && !knownItem(c.item)) problems.push(`objective ${o.id}: unknown item "${c.item}"`);
      if ((c.type === 'place' || c.type === 'break') && !blocksByKey.has(c.block)) problems.push(`objective ${o.id}: unknown block "${c.block}"`);
      if (c.type === 'furnaceTier' && (c.tier < 1 || c.tier > MAX_FURNACE_TIER)) problems.push(`objective ${o.id}: furnace tier ${c.tier} does not exist`);
      if (c.type === 'any') c.of.forEach(checkCondition);
    };
    checkCondition(o.condition);
    if (o.age < 0 || o.age >= AGES.length) problems.push(`objective ${o.id}: age ${o.age} out of range`);
    for (const r of o.reward ?? []) if (!knownItem(r.item)) problems.push(`objective ${o.id}: reward "${r.item}" is not an item`);
  }
  for (const v of ORE_VEINS) {
    if (!blocksByKey.has(v.block)) problems.push(`ore vein: unknown block "${v.block}"`);
    if (v.minY > v.maxY) problems.push(`ore vein ${v.block}: minY > maxY`);
  }
  for (const it of ITEMS) {
    const food = it.food;
    if (!food) continue;
    if (!(food.hunger > 0)) problems.push(`item ${it.key}: food must restore hunger > 0`);
    if ((food.buff === undefined) !== (food.buffS === undefined)) problems.push(`item ${it.key}: food buff and buffS go together`);
    if (food.buffS !== undefined && !(food.buffS > 0)) problems.push(`item ${it.key}: food buffS must be > 0`);
  }
  for (const c of CREATURES) problems.push(...validateCreature(c));
  for (const c of CREATURES) if (c.hostile) problems.push(`creature ${c.key}: automatons belong in AUTOMATON_SPECS`);
  for (const c of AUTOMATONS) problems.push(...validateAutomaton(c, knownItem));
  problems.push(...validateGear(ITEMS));
  for (const v of ORE_VEINS) for (const b of Object.keys(v.biomes ?? {})) if (!BIOMES.has(b)) problems.push(`ore vein ${v.block}: unknown biome "${b}"`);
  const tiers = new Set<string>();
  for (const t of LOOT_TABLES) {
    if (tiers.has(t.tier)) problems.push(`loot ${t.tier}: duplicate table`);
    tiers.add(t.tier);
    if (!(t.rolls[0] >= 1) || t.rolls[1] < t.rolls[0]) problems.push(`loot ${t.tier}: rolls must be [min >= 1, max >= min]`);
    if (t.entries.length === 0) problems.push(`loot ${t.tier}: no entries`);
  }
  problems.push(...validateLootTables(knownItem));
  problems.push(...validateHand({ blocks: BLOCKS, recipes: RECIPES, moulds: MOULDS, metals: CAST_METALS, item: itemOrNull, machine: (k) => MACHINES.get(k) ?? null }));
  problems.push(...validateBrewing({ items: ITEMS, knownItem, block: blockOrNull, machine: (k) => MACHINES.get(k) ?? null }));
  problems.push(...validateTech({ blocks: BLOCKS, knownBlock: (k) => blocksByKey.has(k), knownItem, fluids: FLUIDS, tiers: FURNACE_TIERS, machines: [...MACHINES.values()] }));
  return problems;
}

const BIOMES: ReadonlySet<string> = new Set(ALL_BIOMES);

/** Problems with one species (validateContent runs it on every creature; exported for tests of the checks). */
export function validateCreature(c: CreatureSpec): string[] {
  const knownItem = (key: string): boolean => itemsByKey.has(key);
  const problems: string[] = [];
  const at = `creature ${c.key}`;
  if (c.biomes.length === 0 && c.pet !== true) problems.push(`${at}: no biomes`);
  for (const b of c.biomes) if (!BIOMES.has(b)) problems.push(`${at}: unknown biome "${b}"`);
  if (!(c.health > 0) || !(c.speed > 0) || !(c.size.w > 0) || !(c.size.h > 0)) problems.push(`${at}: health, speed and size must be > 0`);
  if (!(c.group[0] >= 1) || c.group[1] < c.group[0]) problems.push(`${at}: group must be [min >= 1, max >= min]`);
  for (const d of c.drops) if (!knownItem(d.item)) problems.push(`${at}: drop "${d.item}" is not an item`);
  for (const k of c.likes) if (!knownItem(k)) problems.push(`${at}: liked item "${k}" is not an item`);
  if (c.likes.length === 0) problems.push(`${at}: likes nothing, so it can never be lured or bred`);

  const names = new Set<string>();
  const pivots = new Map<string, string>();
  let top = 0;
  for (const p of c.model) {
    if (names.has(p.name)) problems.push(`${at}: duplicate model part "${p.name}"`);
    names.add(p.name);
    if (p.from.some((v, i) => !(p.to[i] > v))) problems.push(`${at}: part ${p.name} has an empty or inverted box`);
    if (!Number.isInteger(p.color) || p.color < 0 || p.color > 0xffffff) problems.push(`${at}: part ${p.name} colour is not 0xRRGGBB`);
    top = Math.max(top, p.to[1]);
    if (p.anim === 'none') continue;
    if (!p.pivot) {
      problems.push(`${at}: animated part ${p.name} has no pivot`);
      continue;
    }
    const pivot = p.pivot.join(',');
    const shared = pivots.get(p.anim);
    if (shared !== undefined && shared !== pivot) problems.push(`${at}: parts animated as ${p.anim} disagree on the pivot`);
    pivots.set(p.anim, pivot);
  }
  // Bipeds use the front pair only; quadrupeds have all four.
  if (!pivots.has('legFL') || !pivots.has('legFR')) problems.push(`${at}: model needs legFL and legFR parts`);
  if (pivots.has('legBL') !== pivots.has('legBR')) problems.push(`${at}: back legs come in pairs (legBL and legBR)`);
  if (!pivots.has('head')) problems.push(`${at}: model has no head part`);
  if (!c.model.some((p) => p.from[1] <= 0)) problems.push(`${at}: model does not touch the ground`);
  const h16 = c.size.h * 16;
  if (top < h16 * 0.75 || top > h16 * 1.2) problems.push(`${at}: model is ${top}/16 tall but its box is ${h16.toFixed(1)}/16`);
  return problems;
}

// ---------------------------------------------------------------------------------------------
// Brewing (BREWING_PLAN 2, 11): drinks, ingredients and containers by item
// ---------------------------------------------------------------------------------------------

/** Every drinkable item (a cup of tea or coffee), in authored order. */
export const DRINKS: readonly ItemDef[] = ITEMS.filter((it) => it.drink !== undefined);
/** The drink item an ingredient brews (dried_tea -> green_tea), or null when the item is no ingredient. */
export const drinkBrewedFrom = (ingredientKey: string): ItemDef | null => {
  const key = itemsByKey.get(ingredientKey)?.brews;
  return key === undefined ? null : itemsByKey.get(key) ?? null;
};
/** Whether the item is something a cup is loaded with. */
export const isBrewIngredient = (key: string): boolean => itemsByKey.get(key)?.brews !== undefined;
/** The container item that boils into `boilingKey` (boiling_pail -> water_pail), or null: the pour row's lookup. */
export const containerBoilingTo = (boilingKey: string): ItemDef | null => ITEMS.find((it) => it.container?.holds === 'water' && it.container.boilsTo === boilingKey) ?? null;
/** The container that is `emptyKey` when empty (pail -> water_pail): the kettle fills an empty one with boiling water. */
export const containerEmptiedTo = (emptyKey: string): ItemDef | null => ITEMS.find((it) => it.container?.holds === 'water' && it.container.emptyTo === emptyKey) ?? null;

// ---------------------------------------------------------------------------------------------
// Ember handwork (docs/api/handwork-content.md): hand stations, moulds and cast metals
// ---------------------------------------------------------------------------------------------

/** Metals that can be poured (copper, tin, bronze), in authored order. */
export const CAST_METALS: readonly CastMetalSpec[] = CAST_METAL_SPECS;
/** Every fired mould, in authored order. */
export const MOULDS: readonly MouldSpec[] = MOULD_SPECS;
const mouldsByItem = new Map<string, MouldSpec>(MOULDS.map((m) => [m.item, m]));
/** The mould spec of a fired mould item, or null. */
export const mouldOf = (itemKey: string): MouldSpec | null => mouldsByItem.get(itemKey) ?? null;
const metalsByIngot = new Map<string, CastMetalSpec>(CAST_METALS.map((m) => [m.ingot, m]));
/** The cast metal whose ingot this item is (copper_ingot -> copper), or null: a crucible output of one is molten for a while. */
export const castMetalOfIngot = (itemKey: string): CastMetalSpec | null => metalsByIngot.get(itemKey) ?? null;
/** What a pour of `ingotKey` into the mould makes: the cast item and the ingots one pour uses, or null when it does not take that metal. */
export function castOf(mouldItem: string, ingotKey: string): { item: string; units: number } | null {
  const mould = mouldsByItem.get(mouldItem);
  const metal = metalsByIngot.get(ingotKey);
  const out = mould && metal ? mould.casts[metal.key] : undefined;
  return mould && out !== undefined ? { item: out, units: mould.units } : null;
}
/** Block keys that are hand stations (their key is the `station` of their recipes). */
const handStationBlocks: ReadonlySet<string> = handStationKeys(BLOCKS, (k) => MACHINES.get(k) ?? null);
export const isHandStation = (blockKey: string): boolean => handStationBlocks.has(blockKey);
