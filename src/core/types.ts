/**
 * Shared data contracts. Everything in this file is plain data or pure helpers: no DOM, no three.js,
 * safe to import from workers and from node tests. Content (src/content) is authored against the
 * *Spec types; the registry (src/core/registry.ts) resolves specs into the *Def types everybody reads.
 */

// ---------------------------------------------------------------------------------------------
// World geometry
// ---------------------------------------------------------------------------------------------

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 96;
export const SEA_LEVEL = 32;
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT;

/** Index of a voxel inside a chunk's Uint16Array. x and z are 0..15, y is 0..WORLD_HEIGHT-1. */
export const voxelIndex = (x: number, y: number, z: number): number => (y * CHUNK_SIZE + z) * CHUNK_SIZE + x;

/** Axis convention: +X east, +Y up, +Z south. A camera with yaw 0 looks north (-Z). */
export const enum Face {
  PX = 0,
  NX = 1,
  PY = 2,
  NY = 3,
  PZ = 4,
  NZ = 5,
}
export const FACE_DIRS: ReadonlyArray<readonly [number, number, number]> = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const OPPOSITE_FACE: ReadonlyArray<Face> = [Face.NX, Face.PX, Face.NY, Face.PY, Face.NZ, Face.PZ];

/** Horizontal facing stored in a voxel: the direction the block's FRONT face points to. */
export const enum Facing {
  North = 0, // -Z
  East = 1, // +X
  South = 2, // +Z
  West = 3, // -X
}
/** The Face that a block's front texture is drawn on, for each Facing. */
export const FACING_TO_FACE: ReadonlyArray<Face> = [Face.NZ, Face.PX, Face.PZ, Face.NX];

// ---------------------------------------------------------------------------------------------
// Voxel encoding: one Uint16 per block.
//   bits 0-9   block id (index into BLOCKS)
//   bits 10-11 facing (Facing)
//   bit  12    active flag (lit furnace, running machine, ...)
//   bits 13-15 variant (free for per-block use, e.g. fill level)
// ---------------------------------------------------------------------------------------------

export type Voxel = number;
export const VOXEL_ID_MASK = 0x3ff;
export const AIR: Voxel = 0;

export const voxelId = (v: Voxel): number => v & VOXEL_ID_MASK;
export const voxelFacing = (v: Voxel): Facing => ((v >> 10) & 3) as Facing;
export const voxelActive = (v: Voxel): boolean => ((v >> 12) & 1) === 1;
export const voxelVariant = (v: Voxel): number => (v >> 13) & 7;
export const makeVoxel = (id: number, facing: Facing = Facing.North, active = false, variant = 0): Voxel =>
  (id & VOXEL_ID_MASK) | ((facing & 3) << 10) | ((active ? 1 : 0) << 12) | ((variant & 7) << 13);
export const withActive = (v: Voxel, active: boolean): Voxel => (active ? v | (1 << 12) : v & ~(1 << 12));
export const withId = (v: Voxel, id: number): Voxel => (v & ~VOXEL_ID_MASK) | (id & VOXEL_ID_MASK);

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

export interface ItemAmount {
  item: string;
  count: number;
}

/** A stack in an inventory slot. `durability` is only present on tools (uses left). */
export interface ItemStack {
  item: string;
  count: number;
  durability?: number;
}
export type Slot = ItemStack | null;

export type ToolKind = 'pickaxe' | 'axe' | 'shovel';

export interface ToolSpec {
  kind: ToolKind;
  /** 1 wood/stone .. 5 endgame. A block with minTier N only drops when mined with tier >= N. */
  tier: number;
  /** Mining speed multiplier on blocks this tool is effective against. */
  speed: number;
  /** Number of blocks it can mine before breaking. */
  durability: number;
  /** Effective against every block regardless of the block's tool kind (the power drill). */
  universal?: boolean;
}

export interface FuelSpec {
  /** Heat released by burning one item, in joules. */
  energyJ: number;
  /** Hottest temperature this fuel can drive a furnace to, in degrees C. */
  flameTempC: number;
  /** Seconds one item burns for in a furnace firebox. */
  burnS: number;
}

export type ItemCategory = 'block' | 'resource' | 'material' | 'component' | 'tool' | 'machine' | 'fuel' | 'misc';

export interface ItemSpec {
  key: string;
  name: string;
  /** One or two short sentences for tooltips and the codex. */
  desc?: string;
  /** Max stack size. Default 99 (tools: 1). */
  stack?: number;
  /** Name of the 16x16 icon texture. Block items leave this out and are drawn as a little cube. */
  icon?: string;
  /** Key of the block this item places. */
  block?: string;
  tool?: ToolSpec;
  fuel?: FuelSpec;
  category: ItemCategory;
  /** Technology age (0-based index into AGES) in which the item first becomes obtainable. */
  age: number;
}

export interface ItemDef extends ItemSpec {
  /** Index into ITEMS. */
  id: number;
  stack: number;
  desc: string;
  /** Layer of the icon in the texture array, or -1 for block items. */
  iconLayer: number;
}

// ---------------------------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------------------------

/**
 * How a block is drawn and collided with.
 *  none   - air
 *  cube   - full 1x1x1 block
 *  liquid - full block, slightly lowered surface, no collision
 *  cross  - two crossed quads (plants)
 *  torch  - thin stick standing in the middle of the cell
 *  cable  - small core with arms towards every neighbouring power block
 *  slab   - bottom half of a cell (0.5 high)
 */
export type BlockShape = 'none' | 'cube' | 'liquid' | 'cross' | 'torch' | 'cable' | 'slab';

/**
 * Names of procedural 16x16 textures. Fallbacks for unlisted faces:
 *   side -> all;  top -> all -> side;  bottom -> top -> all -> side;  front -> side.
 * A block with no textures at all uses the single texture `block_<key>`.
 */
export interface BlockTextures {
  all?: string;
  top?: string;
  bottom?: string;
  side?: string;
  /** Only meaningful for `oriented` blocks: drawn on the face the block is facing. */
  front?: string;
  /** Optional replacements used while the voxel's active flag is set. */
  frontActive?: string;
  sideActive?: string;
  topActive?: string;
}

export interface Drop {
  item: string;
  /** Count, or an inclusive [min, max] range. */
  count: number | [number, number];
  /** Probability 0..1. Default 1. */
  chance?: number;
}

export type LiquidKind = 'water' | 'lava' | 'oil';

export interface BlockSpec {
  key: string;
  name: string;
  desc?: string;
  /** Default 'cube'. */
  shape?: BlockShape;
  textures?: BlockTextures;
  /** Blocks movement. Default: true for cube and slab, false otherwise. */
  solid?: boolean;
  /** Completely hides the faces behind it and stops light. Default: true for cube, false otherwise. */
  opaque?: boolean;
  /** Drawn in the blended (see-through) pass: water, glass. Default false. */
  translucent?: boolean;
  /** Seconds to break with bare hands. -1 = unbreakable. Default 1. */
  hardness?: number;
  /** Tool kind that speeds up breaking. */
  tool?: ToolKind;
  /** Minimum tool tier needed for the block to drop anything. 0 = any (hands included). Default 0. */
  minTier?: number;
  /** What breaking yields. Default 'self' (one item with the block's key). */
  drops?: Drop[] | 'self' | 'none';
  /** Light emitted, 0..15. */
  light?: number;
  /** Light emitted while active. Default: same as `light`. */
  lightActive?: number;
  /** Warmth radius in blocks (keeps the player warm). 0 = none. */
  warmth?: number;
  /** Warmth radius while active. Default: same as `warmth`. */
  warmthActive?: number;
  /** Placing another block here replaces this one (air, liquids, plants). Default false. */
  replaceable?: boolean;
  liquid?: LiquidKind;
  /** Stores a facing when placed (front faces the player). Default false. */
  oriented?: boolean;
  /** Damage per second while the player touches or stands inside it. */
  contactDamage?: number;
  /** Radiation dose per second at distance 0, falling off linearly to 0 at 4 blocks. */
  radiation?: number;
  /** Interacting opens this hand-crafting station screen. */
  station?: 'workbench';
  /** This block owns a block entity simulated by src/sim (key into MACHINES). */
  machine?: string;
  /** 'cable' carries power; 'device' is something cables attach to. */
  power?: 'cable' | 'device';
  /** Cables only: the most power, in watts, a network containing this cable can carry. */
  cableRatingW?: number;
  /** If false no block item is generated (liquids, air, internal blocks). Default true. */
  item?: boolean;
  /** Stack size of the generated block item. Default 99. */
  stack?: number;
  /** Category of the generated block item. Default 'block' ('machine' when `machine` is set). */
  category?: ItemCategory;
  /** Technology age (index into AGES) for the codex. Default 0. */
  age?: number;
  /** If set, the block can only be placed on top of a block with one of these keys (plants, oil pump...). */
  placeOn?: string[];
}

export interface BlockDef {
  /** Index into BLOCKS, stored in voxels. Air is always 0. */
  id: number;
  key: string;
  name: string;
  desc: string;
  shape: BlockShape;
  solid: boolean;
  opaque: boolean;
  translucent: boolean;
  hardness: number;
  tool: ToolKind | null;
  minTier: number;
  drops: Drop[];
  light: number;
  lightActive: number;
  warmth: number;
  warmthActive: number;
  replaceable: boolean;
  liquid: LiquidKind | null;
  oriented: boolean;
  contactDamage: number;
  radiation: number;
  station: 'workbench' | null;
  machine: string | null;
  power: 'cable' | 'device' | null;
  /** Cable rating in watts; 0 for anything that is not a cable. */
  cableRatingW: number;
  age: number;
  placeOn: string[] | null;
  /** Key of the item that places this block, or null. */
  itemKey: string | null;
  /**
   * Texture-array layer for each Face (indexed by Face) when facing North and inactive.
   * Use `faceLayer(def, face, facing, active)` from the registry instead of reading this directly.
   */
  layers: number[];
  /** Same, while active. */
  layersActive: number[];
}

// ---------------------------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------------------------

/**
 * Where a recipe is made.
 *  hand      - anywhere, from the inventory screen
 *  workbench - at a workbench block
 *  furnace   - at the furnace (the main crafting station of the game)
 *  anything else - a machine kind that processes it automatically (e.g. 'crusher')
 */
export type StationKind = 'hand' | 'workbench' | 'furnace' | (string & {});

export interface RecipeSpec {
  /** Unique id. Convention: output key, plus a suffix when several recipes make the same item. */
  id: string;
  station: StationKind;
  /**
   * Furnace only. 'smelt' = loaded into a crucible slot and cooked over `timeS` while the furnace stays hot enough.
   * 'forge' = made on the spot by the player if the furnace is currently at or above `minTempC`.
   * Ignored elsewhere (hand/workbench recipes are instant, machine recipes are timed).
   */
  kind?: 'smelt' | 'forge';
  inputs: ItemAmount[];
  output: ItemAmount;
  /** Extra outputs (slag, by-products). */
  byproducts?: ItemAmount[];
  /** Processing time in seconds for smelt and machine recipes. */
  timeS?: number;
  /** Furnace recipes: minimum furnace temperature in degrees C. */
  minTempC?: number;
  /** Furnace recipes: minimum furnace tier (1-based). Default 1. */
  minTier?: number;
  /** Machine recipes: electrical energy consumed per run, in joules. */
  energyJ?: number;
  /** Technology age (index into AGES) the recipe belongs to. */
  age: number;
}

export interface RecipeDef extends RecipeSpec {
  kind: 'smelt' | 'forge';
  byproducts: ItemAmount[];
  timeS: number;
  minTempC: number;
  minTier: number;
  energyJ: number;
}

// ---------------------------------------------------------------------------------------------
// Technology: ages, furnace tiers, machines, objectives
// ---------------------------------------------------------------------------------------------

export interface AgeSpec {
  key: string;
  name: string;
  /** One sentence shown when the age begins. */
  blurb: string;
}

export interface FurnaceTierSpec {
  /** 1-based tier. */
  tier: number;
  /** Block key of the furnace at this tier. */
  block: string;
  name: string;
  /** Hottest temperature this tier can hold, degrees C. */
  maxTempC: number;
  /** Heat capacity in joules per degree C: how much heat it takes to warm the furnace up. */
  heatCapacityJ: number;
  /** Heat lost to the surroundings, in watts per degree C above ambient. */
  lossWPerC: number;
  /** Number of crucible (smelting) slots. */
  crucibles: number;
  /** Number of firebox (fuel) slots. */
  fuelSlots: number;
  /** Smelting speed multiplier. */
  speed: number;
  /** Maximum electric heating power in watts this tier can draw from its power network (0 = fuel only). */
  electricHeatW: number;
  /** Radius in blocks kept warm while the furnace is hot. */
  warmth: number;
  /** Items consumed to upgrade the previous tier in place (tier 1: empty, it is crafted as a block). */
  upgradeCost: ItemAmount[];
  /** Temperature the furnace must be at (in its previous tier) to perform the upgrade. */
  upgradeTempC: number;
  /** Index into AGES that reaching this tier begins. */
  age: number;
  /** Flavour text for the upgrade panel. */
  blurb: string;
}

export type MachineRole =
  | 'furnace'
  | 'generator'
  | 'consumer'
  | 'storage'
  | 'crate'
  | 'boiler';

/** Static numbers for one kind of machine. The behaviour itself lives in src/sim. */
export interface MachineSpec {
  /** Machine kind; also the value of BlockSpec.machine. */
  kind: string;
  name: string;
  role: MachineRole;
  /** Block keys that carry this machine (furnace tiers share one kind). */
  blocks: string[];
  /** Generators: rated electrical output in watts. */
  outputW?: number;
  /** Consumers: electrical draw in watts while working. */
  drawW?: number;
  /** Storage: capacity in joules. */
  capacityJ?: number;
  /** Storage: maximum charge/discharge rate in watts. */
  rateW?: number;
  /** Fuel-burning generators: item keys accepted as fuel. Empty or undefined = none. */
  fuels?: string[];
  /** Fuel-burning generators: fraction of the fuel's energyJ converted to electricity (0..1). */
  efficiency?: number;
  /** Number of inventory slots the machine exposes (crates, fuel hoppers, in/out buffers). */
  slots?: number;
  /** Free-form tunables read by the behaviour in src/sim (documented in the content file). */
  params?: Record<string, number>;
  /** One or two sentences for the machine screen and the codex. */
  desc: string;
  /** Short rule about where it must stand, shown when placing (e.g. "Needs water next to it"). */
  placementHint?: string;
}

export type ObjectiveCondition =
  /** Player holds at least `count` of `item` right now. */
  | { type: 'have'; item: string; count?: number }
  /** Player has crafted/forged/smelted at least `count` of `item` in total. */
  | { type: 'make'; item: string; count?: number }
  /** Player has placed at least `count` blocks with this key in total. */
  | { type: 'place'; block: string; count?: number }
  /** Player has broken at least `count` blocks with this key in total. */
  | { type: 'break'; block: string; count?: number }
  /** Any furnace of the player reached this temperature. */
  | { type: 'furnaceTemp'; tempC: number }
  /** The player's furnace reached this tier. */
  | { type: 'furnaceTier'; tier: number }
  /** Total electrical generation across all networks reached this many watts. */
  | { type: 'generate'; watts: number }
  /** Total energy stored in batteries reached this many joules. */
  | { type: 'stored'; joules: number }
  /** A named one-off thing happened (see GameEvents 'flag'). */
  | { type: 'flag'; flag: string }
  /** Satisfied when any one of the listed conditions is. */
  | { type: 'any'; of: ObjectiveCondition[] };

export interface ObjectiveSpec {
  id: string;
  /** Imperative, short: "Light the furnace". */
  title: string;
  /** One or two sentences explaining why and how. */
  text: string;
  condition: ObjectiveCondition;
  /** Age (index into AGES) this objective belongs to. */
  age: number;
  /** Optional gift on completion. */
  reward?: ItemAmount[];
}

// ---------------------------------------------------------------------------------------------
// World generation data (authored in src/content, consumed by src/world)
// ---------------------------------------------------------------------------------------------

export type BiomeKey = 'woodland' | 'dunes' | 'frostfell' | 'scar';

export interface OreVeinSpec {
  /** Block key of the ore. */
  block: string;
  /** Inclusive y band the vein centres are placed in. */
  minY: number;
  maxY: number;
  /** Average number of veins per 16x16 chunk column (may be fractional). */
  veinsPerChunk: number;
  /** Approximate number of blocks in one vein. */
  veinSize: number;
  /** Per-biome multiplier on veinsPerChunk. Missing biomes count as 1. */
  biomes?: Partial<Record<BiomeKey, number>>;
}

// ---------------------------------------------------------------------------------------------
// World access (implemented by src/world, consumed by game logic, simulation and player code)
// ---------------------------------------------------------------------------------------------

/** Base shape of a block entity (machine state). src/sim defines the concrete per-kind fields. */
export interface BlockEntity {
  /** Machine kind (key into MACHINES). */
  kind: string;
  x: number;
  y: number;
  z: number;
  [field: string]: unknown;
}

export type ChangeSource = 'player' | 'sim' | 'load';

export interface IWorld {
  readonly seed: number;
  /** Voxel at a world position. AIR above the world, bedrock-solid below it, AIR in unloaded chunks. */
  getVoxel(x: number, y: number, z: number): Voxel;
  /** Shortcut for BLOCKS[voxelId(getVoxel(x, y, z))]. */
  getBlock(x: number, y: number, z: number): BlockDef;
  /** Sets a voxel, marks meshes dirty, emits 'block:changed'. Returns false when the chunk is not loaded. */
  setVoxel(x: number, y: number, z: number, voxel: Voxel, source?: ChangeSource): boolean;
  /** True when the chunk column containing world x,z holds voxel data. */
  isLoaded(x: number, z: number): boolean;
  /** Highest non-air block y in a column, or -1 when unloaded. */
  surfaceY(x: number, z: number): number;

  getEntity(x: number, y: number, z: number): BlockEntity | undefined;
  setEntity(entity: BlockEntity): void;
  removeEntity(x: number, y: number, z: number): BlockEntity | undefined;
  /** Every block entity in the world (loaded or not): machines keep running everywhere. */
  entities(): Iterable<BlockEntity>;
}

// ---------------------------------------------------------------------------------------------
// Chunk mesh data (produced by src/world's mesher, drawn by src/render)
// ---------------------------------------------------------------------------------------------

/**
 * One draw batch of a chunk. Vertices are chunk-local (x,z in 0..16, y in 0..WORLD_HEIGHT).
 *  positions  3 floats per vertex
 *  uvs        2 floats per vertex (0..1 across one texture layer; may exceed 1 only if the layer repeats)
 *  layers     1 float per vertex: texture-array layer
 *  light      4 bytes per vertex: [skyLight 0..255, blockLight 0..255, shade 0..255 (AO x face shading), flags]
 *             flags: bit0 = emissive (always fully bright), bit1 = sways (plants), bit2 = liquid surface
 *  indices    triangle list
 */
export interface MeshBatch {
  positions: Float32Array;
  uvs: Float32Array;
  layers: Float32Array;
  light: Uint8Array;
  indices: Uint32Array;
}

export interface ChunkMeshData {
  cx: number;
  cz: number;
  /** Fully opaque geometry. */
  opaque: MeshBatch;
  /** Alpha-tested geometry (plants, torches, anything with holes). */
  cutout: MeshBatch;
  /** Blended geometry (water, glass). */
  translucent: MeshBatch;
}

export const LIGHT_FLAG_EMISSIVE = 1;
export const LIGHT_FLAG_SWAY = 2;
export const LIGHT_FLAG_LIQUID = 4;
