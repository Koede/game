/**
 * The registry: resolves the authored content (src/content) into fast lookup tables.
 * Pure data, no DOM - imported by the game, by the chunk worker and by node tests alike.
 *
 * Everything outside src/content reads blocks, items and recipes through this module.
 */
import {
  AGES as AGE_SPECS,
  BLOCK_SPECS,
  FURNACE_TIERS as FURNACE_TIER_SPECS,
  ITEM_SPECS,
  MACHINE_SPECS,
  OBJECTIVES as OBJECTIVE_SPECS,
  ORE_VEINS as ORE_VEIN_SPECS,
  RECIPE_SPECS,
} from '../content';
import {
  Face,
  FACING_TO_FACE,
  VOXEL_ID_MASK,
  voxelActive,
  voxelFacing,
  voxelId,
  type AgeSpec,
  type BlockDef,
  type BlockSpec,
  type Drop,
  type Facing,
  type FuelSpec,
  type FurnaceTierSpec,
  type ItemDef,
  type ItemSpec,
  type MachineSpec,
  type ObjectiveCondition,
  type ObjectiveSpec,
  type OreVeinSpec,
  type RecipeDef,
  type Voxel,
} from './types';

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
  put(Face.NY, bottom, bottom);
  put(Face.PZ, side, sideA);
  put(Face.NZ, front, frontA);

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
    solid: spec.solid ?? (shape === 'cube' || shape === 'slab'),
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
    itemKey: hasItem ? spec.key : null,
    layers,
    layersActive,
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
export function faceLayer(def: BlockDef, face: Face, facing: Facing, active: boolean): number {
  const layers = active ? def.layersActive : def.layers;
  if (!def.oriented || face === Face.PY || face === Face.NY) return layers[face];
  return face === FACING_TO_FACE[facing] ? layers[Face.NZ] : layers[Face.PX];
}
export const voxelFaceLayer = (v: Voxel, face: Face): number =>
  faceLayer(blockOf(v), face, voxelFacing(v), voxelActive(v));
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
      const cubeLike = placed.shape === 'cube' || placed.shape === 'slab' || placed.shape === 'liquid';
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
  }
  for (const it of ITEMS) {
    if (it.block && !blocksByKey.has(it.block)) problems.push(`item ${it.key}: places unknown block "${it.block}"`);
    if (it.age < 0 || it.age >= AGES.length) problems.push(`item ${it.key}: age ${it.age} out of range`);
    if (it.stack < 1) problems.push(`item ${it.key}: stack must be >= 1`);
  }
  for (const r of RECIPES) {
    if (!knownItem(r.output.item)) problems.push(`recipe ${r.id}: output "${r.output.item}" is not an item`);
    for (const i of r.inputs) if (!knownItem(i.item)) problems.push(`recipe ${r.id}: input "${i.item}" is not an item`);
    for (const b of r.byproducts) if (!knownItem(b.item)) problems.push(`recipe ${r.id}: byproduct "${b.item}" is not an item`);
    if (r.inputs.length === 0) problems.push(`recipe ${r.id}: no inputs`);
    if (r.station !== 'hand' && r.station !== 'workbench' && r.station !== 'furnace' && !MACHINES.has(r.station)) {
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
  return problems;
}
