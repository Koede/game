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

/**
 * Mining tools, plus the hoe: a farming tool that tills soil and never speeds up mining (it counts as bare hands),
 * and the maul (spec 19.4): a weapon made for breaking metal. No block names 'hoe' or 'maul' as its tool, so both
 * count as bare hands for mining and never wear while mining; a maul's combat numbers are its ItemSpec.weapon.
 */
export type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'maul' | 'hammer';

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
  /**
   * A chainsaw: breaking a log with it fells the connected trunk too (at most `maxLogs` logs, game/felling.ts). Its
   * `durability` is its FUEL TANK, not blade wear: every log cut takes `fuelPerLog`; a Fuel Canister refills it
   * (`canisterFuel`); at 1 it is out of fuel and counts as bare hands.
   */
  fell?: { maxLogs: number; fuelPerLog: number; canisterFuel: number };
}

export interface FuelSpec {
  /** Heat released by burning one item, in joules. */
  energyJ: number;
  /** Hottest temperature this fuel can drive a furnace to, in degrees C. */
  flameTempC: number;
  /** Seconds one item burns for in a furnace firebox. */
  burnS: number;
  /**
   * Item handed back when one of this fuel has burned (the container it came in): a lava bucket returns the
   * bronze bucket. Whatever consumes the fuel must give this item back; machines with no place to put it do not
   * accept the fuel at all (spec 13).
   */
  fuelReturns?: string;
}

export type ItemCategory = 'block' | 'resource' | 'material' | 'component' | 'tool' | 'machine' | 'fuel' | 'misc' | 'food';

/** What eating one of an item does (spec 12.1/12.2). */
export interface FoodSpec {
  /** Food points restored (the bar holds MAX_FOOD). */
  hunger: number;
  /** Buff granted on eating. Foods with a buff may be eaten on a full stomach. */
  buff?: 'well_fed' | 'sugar_rush';
  /** Duration of the buff in seconds. */
  buffS?: number;
}

/** The six drink buffs of brewing (BREWING_PLAN 11.1): three from tea, three from coffee. */
export type DrinkBuff = 'spring' | 'hearthkept' | 'mending' | 'swift' | 'vigor' | 'lasting';
export type DrinkFamily = 'tea' | 'coffee';

/**
 * What drinking one of an item does (brewing). Drinking grants `buff` for `buffS` seconds; at most one buff of each
 * family is active, and a new one of the same family replaces it. The numbers of the buffs are in constants.ts.
 */
export interface DrinkSpec {
  buff: DrinkBuff;
  family: DrinkFamily;
  buffS: number;
  /** 0xRRGGBB of the liquid: the tint of the quad that shows the drink in the cup. */
  colour: number;
  /** Warmth restored on drinking (Hearthkept's +10). */
  warmth?: number;
  /** Food points restored on drinking. */
  hunger?: number;
}

/**
 * An item that can hold water and be boiled on a furnace top (BREWING_PLAN 11.3). Only the water bucket today; a bowl
 * or flask needs this field and a furnace-top block in src/core/brewing.ts CONTAINER_BLOCKS.
 */
export interface ContainerSpec {
  /** 'water' boils (brewing, kettles); 'sap' cooks down to `boilsTo` on a furnace top and never counts as water. */
  holds: 'water' | 'sap';
  /** Key of the same container full of boiling water (water_pail -> boiling_pail). */
  boilsTo: string;
  /** Key of the container when empty (water_pail -> pail). */
  emptyTo: string;
  /** Share of BOIL_SECONDS it takes on a furnace top (small glass < 1). Default 1. */
  boilScale?: number;
  /** Handed back too when the cooked `boilsTo` is taken (the beaker a cooked resin sat in). */
  returns?: string;
}

/** An item that goes back to another one after a while in a pack (a carried boiling bucket cools to water). */
export interface CoolsSpec {
  to: string;
  /** Seconds it lasts. A stack's `durability` holds the seconds left; a fresh one starts at this. */
  afterS: number;
}

/**
 * What a weapon does when Mine hits a creature with it (spec 19.4). It replaces the tool table of spec 12.5 for that
 * item; the hit cooldown is WEAPON_HIT_COOLDOWN_S and every hit wears the weapon's ToolSpec durability by 1.
 */
export interface WeaponSpec {
  /** Damage of one hit, automaton or animal. */
  damage: number;
  /** Automatons it hits are stunned this long: they stop, and a wind-up in progress is cancelled (the arc maul). */
  stunS?: number;
}

/**
 * Gear worn from the inventory (spec 19.4): it counts while it is anywhere in the player's inventory, and of several
 * the best one counts, separately for each number (the best reduction, the lowest warmth multiplier).
 */
export interface ArmourSpec {
  /** Fraction 0..1 taken off every hit of a cause in ARMOUR_CAUSES (0.25 = 25% less damage). 0 for clothing. */
  reduction: number;
  /** Multiplier on the cold's warmth drain while carried (the padded coat's 0.5). Absent: no effect on warmth. */
  warmthDrainMult?: number;
}

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
  /** Uses of an item that wears out without being a tool (the hand vacuum pump: seconds of suction). Stack 1. */
  wear?: number;
  fuel?: FuelSpec;
  /** Edible: Use eats one (unless it would plant it, see `block`). */
  food?: FoodSpec;
  /** A weapon (spec 19.4): the damage a hit with it deals to any creature. Mauls also carry a ToolSpec of kind 'maul'. */
  weapon?: WeaponSpec;
  /** Worn gear that counts while it is anywhere in the inventory (spec 19.4; the padded coat too). */
  armour?: ArmourSpec;
  /** A fired mould (Ember handwork): stack 1; the stack's durability is the pours left (absent = `pours`). */
  mould?: { pours: number };
  /** A cup of tea or coffee: Use drinks it (brewing). */
  drink?: DrinkSpec;
  /** An ingredient: loaded into a cup with a drip cone it brews the drink item with this key. */
  brews?: string;
  /** A container that holds water and boils on a furnace top. */
  container?: ContainerSpec;
  /** Reverts to another item after a while carried (boiling_pail -> water_pail). */
  cools?: CoolsSpec;
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
 *  pipe   - a core with arms to every neighbour it joins (spec 16): another pipe of the same family or an endpoint of
 *           that family (see `BlockSpec.pipe`). Core and arms span PIPE_CORE_MIN..PIPE_CORE_MAX of the cell; the
 *           texture is a plus whose centre square is the core and whose bands are the arms, like a cable's.
 *  cup    - a small box standing on the floor of the cell, not solid (brewing): the clay cup and its cone states. A
 *           cup is 6/16 wide and 5/16 tall, a cone on top makes it 10/16; its textures are cut-out sprites.
 *  bucket - a small round-ish pot box standing on the floor of the cell, not solid (brewing): a bucket on a furnace
 *           top and the kettle pot, 10/16 wide and 8/16 tall.
 */
export type BlockShape = 'none' | 'cube' | 'liquid' | 'cross' | 'torch' | 'cable' | 'slab' | 'pipe' | 'cup' | 'bucket';

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
  /** While active, on the bottom face (default: `bottom`). A hearth's ceiling glows on its underside too. */
  bottomActive?: string;
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
  /**
   * Harvesting this block (breaking it, or picking it with Use) gives its drops and leaves this block in its
   * place instead of air, keeping the voxel's block entity: a picked berry bush stays as a bare bush (spec 14).
   */
  harvestLeaves?: string;
  /** Item or fluid transport (spec 16): set on every block of shape 'pipe' and on nothing else. */
  pipe?: PipeSpec;
  /** Ember handwork: the block is worked by the player's strokes (its machine has role 'hand'). */
  handStation?: HandStationSpec;
}

/**
 * What a pipe moves and how fast (spec 16.1). Item pipes join item pipes and item endpoints, fluid pipes join fluid
 * pipes and fluid endpoints; the two families never join.
 */
export interface PipeSpec {
  family: 'item' | 'fluid';
  /**
   * Per port. Item pipes: transfers per second a 'pull' port makes (0.5 = one every 2 s). Fluid pipes: litres per
   * second a port moves.
   */
  ratePerS: number;
  /** Item pipes: the most items one transfer takes (one stack's worth, never more than the stack holds). */
  batch?: number;
  /** Item pipes: how fast a packet travels, in blocks (pipe lengths) per second. */
  speedBlocksPerS?: number;
  /** Fluid pipes: litres each pipe adds to its network's capacity. */
  capacityL?: number;
  /** Fluid pipes: carries hot fluids (FluidSpec.hot: lava, steam) too. A cold pipe refuses them. */
  hot?: boolean;
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
  /** Key of the block left behind when this one is harvested (see BlockSpec.harvestLeaves), or null. */
  harvestLeaves: string | null;
  /** Transport numbers of a pipe block (spec 16), or null for anything that is not a pipe. */
  pipe: PipeSpec | null;
  handStation: HandStationSpec | null;
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
  /**
   * Hand stations (Ember handwork): strokes of progress the job needs (whole number). Timed hand stations (drying
   * rack, tanning trough, alloy pot) leave it out and use `timeS` instead.
   */
  strokes?: number;
  /** Hand stations: the output instead of `output` when the finishing stroke was struck with the station's tool. */
  toolOutput?: ItemAmount;
  /** Hand stations: an extra output rolled once per finished job. */
  bonus?: ItemAmount & { chance: number };
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
  /**
   * The hearth this tier needs (spec 17.1): to run at this tier the furnace (the controller) must sit in a wall of a
   * formed structure that meets these rules. Absent on tier 1 (the clay furnace stands alone).
   */
  structure?: HearthStructureSpec;
}

/**
 * Rules of one tier's hearth: a hollow cuboid of `wall` blocks (frame, faces, floor and ceiling) around an empty
 * interior, with the controller in a face cell of a wall. Pure lookups over it live in src/core/hearth.ts.
 */
export interface HearthStructureSpec {
  /**
   * Blocks accepted as wall, this tier's own first. A higher tier's wall block also satisfies a lower tier, so each
   * list holds the walls of every tier from this one up.
   */
  wall: string[];
  /** Smallest interior, [x, z, y] in blocks (x and z are interchangeable: a hearth may face any way). */
  minInner: [number, number, number];
  /** Largest interior, [x, z, y]. */
  maxInner: [number, number, number];
  /** 'optional': an open top is allowed (it shows the fire); 'required': the top layer must be a full ceiling. */
  ceiling: 'optional' | 'required';
  /** Electrode blocks needed in the ceiling (0 or absent: none). */
  electrodes?: number;
  /** Power port blocks needed in the faces (0 or absent: none). */
  powerPorts?: number;
  /** Crucibles = min(maxCrucibles, interior x * z + crucibleBonus). */
  maxCrucibles: number;
  crucibleBonus: number;
}

export type MachineRole =
  | 'furnace'
  | 'generator'
  | 'consumer'
  | 'storage'
  | 'crate'
  | 'boiler'
  /** A growing plant on farmland (no power, no screen): src/sim advances its stage block. */
  | 'crop'
  /**
   * A wild plant that fruits again after being picked (the berry bush; no power, no screen): src/sim swaps its
   * picked block back to the fruiting block after params.regrowS seconds.
   */
  | 'bush'
  /** A fluid store (spec 16.1): holds one fluid; vertically stacked tanks share one fluid and one level. */
  | 'tank'
  /**
   * A part set into a hearth's shell (spec 17.1): item hatch, fluid hatch, power port. It proxies to the controller
   * of the formed hearth it belongs to and does nothing on its own.
   */
  | 'hearth_part'
  /**
   * Brewing (no power, no machine screen): the cup setup, a bucket boiling on a furnace, the kettle pot. Each has an
   * entity of its own kind but is never a machine node, like a crop. The world interaction is the interface.
   */
  | 'brew'
  /**
   * An Ember handwork station (no power, no screen; the world interaction is the interface): worked by strokes
   * (`BlockSpec.handStation`), timed (drying rack, tanning trough, alloy pot) or holding moulds (casting bench).
   * Never a machine node. Recipes name the station block's key as their `station`.
   */
  | 'hand'
  /**
   * A module of the glass distillery (docs/DISTILLERY_PLAN.md): flask, column, condenser, receiver and the rest. Each
   * has an entity of kind 'chem', never a machine node; the rig it belongs to is found by touching blocks.
   */
  | 'chem';

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
  /** Fluid ports (spec 16.2): a fluid pipe or a bucket can fill or drain it. */
  fluids?: MachineFluids;
}

/** The fluid side of an endpoint: which fluids a pipe may push into it and pull out of it. */
export interface MachineFluids {
  /** Fluids it takes in (a 'push' port or a full bucket fills it). */
  accepts?: FluidKey[];
  /** Fluids it hands out (a 'pull' port or an empty bucket drains it). */
  gives?: FluidKey[];
  /** Litres each of its internal fluid buffers holds (one buffer per fluid it accepts or gives at a time). */
  capacityL: number;
}

// ---------------------------------------------------------------------------------------------
// Fluids (spec 16.5; authored in src/content/fluids.ts, read through the registry's FLUIDS)
// ---------------------------------------------------------------------------------------------

export type FluidKey =
  | 'water' | 'lava' | 'steam' | 'crude_oil' | 'fuel'
  // The glass distillery (src/content/fluidsDistill.ts).
  | 'sap' | 'syrup' | 'sugar_wash' | 'low_wines' | 'spirit' | 'fuel_ethanol' | 'gasoline' | 'kerosene' | 'diesel' | 'residue' | 'slop';

export interface FluidSpec {
  key: FluidKey;
  name: string;
  /** Colour in tank windows, pipe windows and the UI, 0xRRGGBB. */
  colour: number;
  /** Hot fluids (lava, steam) need a hot pipe; a cold pipe refuses them ("Too hot for this pipe"). */
  hot: boolean;
  /** Drawn full-bright (it glows) in pipe windows, tanks and the UI. */
  glow: boolean;
  /** The world liquid a pump draws this fluid from, if any. */
  liquid?: LiquidKind;
  /** The bucket that carries 1000 L of it: `full` is the filled item, `empty` the bucket handed back. */
  bucket?: { full: string; empty: string };
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

export type BiomeKey = 'woodland' | 'dunes' | 'frostfell' | 'scar' | 'marsh';

/** Every biome, in a fixed order (spec 14 added the marsh). */
export const ALL_BIOMES: readonly BiomeKey[] = ['woodland', 'dunes', 'frostfell', 'scar', 'marsh'];

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
// Creatures (authored in src/content/creatures.ts, simulated by src/mobs, drawn by src/render)
// ---------------------------------------------------------------------------------------------

/**
 * Which animation drives a model part. Legs swing about their pivot's X axis in pairs (FL with BR, FR with BL)
 * in proportion to walking speed; 'head' parts tilt together about the head pivot (down while grazing, a small
 * bob while walking); 'none' parts are rigid with the body.
 */
export type CreatureAnim =
  | 'legFL' | 'legFR' | 'legBL' | 'legBR' | 'head' | 'none'
  /**
   * Automatons (spec 19): the middle pair of a six-legged walker (legML swings with legFR and legBL, legMR with legFL
   * and legBR, so the gait alternates three legs at a time), and arms about the shoulder's X axis (armL is the
   * model's left, -X; armR its right, +X). Arms hang still while walking and RISE through a wind-up: the warden's
   * hammer arm (armR), both of the colossus's arms.
   */
  | 'legML' | 'legMR' | 'armL' | 'armR';

/**
 * One box of a creature's model. Units are 1/16 of a block, relative to the centre of the creature's feet.
 * The model is authored FACING NORTH (-Z, like a camera at yaw 0): the head is at negative z, +X is east
 * (the creature's right), +Y is up and y = 0 is the ground. A creature with yaw θ is this model rotated by θ
 * about +Y (the camera convention: positive turns left).
 */
export interface CreaturePart {
  /** Unique within the model, e.g. 'body', 'head', 'beak', 'legFL'. */
  name: string;
  /** Minimum corner [x, y, z] (1/16 block). */
  from: readonly [number, number, number];
  /** Maximum corner [x, y, z] (1/16 block); every component > the same one of `from`. */
  to: readonly [number, number, number];
  /** Fill colour, 0xRRGGBB. The renderer shades faces and adds subtle pixel noise in this colour. */
  color: number;
  anim: CreatureAnim;
  /**
   * Point the part rotates about (1/16 block), required for every animated part: the hip of a leg (top
   * centre), the neck of the head. All parts that share an anim tag share the same pivot and move as one.
   */
  pivot?: readonly [number, number, number];
  /**
   * An ember part (spec 19.5): drawn full-bright in its colour while the automaton is active, brighter still through a
   * wind-up (the flare that telegraphs an attack), dark while it is dormant or dead.
   */
  emissive?: boolean;
}

export interface CreatureSpec {
  key: string;
  name: string;
  /** One or two short sentences for the codex. */
  desc: string;
  /** Biomes it spawns in. */
  biomes: BiomeKey[];
  /** Hit points of an adult. */
  health: number;
  /** Walking speed in blocks (metres) per second. */
  speed: number;
  /** Collision box of an adult in blocks: w x w footprint, h tall (babies are half size). */
  size: { w: number; h: number };
  /** What an adult drops when killed (straight into the player's inventory). Babies drop nothing. */
  drops: Drop[];
  /** Item keys that lure it (held within follow range) and, fed with Use, make it eager to breed. */
  likes: string[];
  /** Animals per spawned group, inclusive [min, max]. */
  group: readonly [number, number];
  /** Box model of an adult (see CreaturePart for units and orientation). */
  model: CreaturePart[];
  /**
   * Hostile automatons only (spec 19): how it fights and where it lives. Automatons never breed or grow (`likes` is
   * empty), are authored in src/content/automatons.ts and listed in the registry's AUTOMATONS, never in CREATURES.
   */
  hostile?: HostileSpec;
}

/**
 * How an automaton attacks (spec 19.1). Every attack is telegraphed: a wind-up of `windupS` (ember parts flare,
 * sfx automaton_windup, event 'hostile:windup') starts when the player is within `range` (and, for bolt and zap, in
 * line of sight), then the attack is released ('hostile:attack') and judged against where the player is THEN, so
 * stepping out of reach during the wind-up dodges it.
 *  melee - a blow at the end of the wind-up: hits if the player is still within `range` and in front (90-degree arc)
 *  dash  - crouch through the wind-up, then charge in a straight line at `dashSpeed` towards where the player stood,
 *          HOSTILE_DASH_OVERRUN blocks past it or until it hits a wall; touching the player hits once
 *  bolt  - lob an ember bolt (a projectile with gravity EMBER_BOLT_GRAVITY) at `projectileSpeed`, aimed to land on
 *          the player; it hits the first solid block or the player and never breaks blocks
 *  zap   - an arc to the player if still within `range` with line of sight (x `wetMult` in water)
 *  slam  - both arms come down: hits everything within `range` around it, no facing needed
 */
export type HostileAttack = 'melee' | 'dash' | 'bolt' | 'zap' | 'slam';

/**
 * Kinds of place the night spawner tells apart (spec 19.3). A candidate spot (solid floor, block light below
 * HOSTILE_SPAWN_LIGHT, never sunlit) matches every place whose test it passes:
 *  cave       - no open sky above, y >= HOSTILE_DEEP_Y (any time of day)
 *  deep       - no open sky above, y < HOSTILE_DEEP_Y (any time of day)
 *  surface    - open sky above, at night
 *  scar       - in the scar biome, any time it is dark there (night, or a cave or overhang by day)
 *  scar_night - in the scar biome, at night (open sky or not)
 *  peak       - open sky above, y >= HOSTILE_PEAK_Y, at night
 */
export type SpawnPlace = 'cave' | 'deep' | 'surface' | 'scar' | 'scar_night' | 'peak';

export interface HostileHabitat {
  /**
   * Relative spawn weight per place. At a spot, a type's weight is the largest of its weights for the places the
   * spot matches (absent or 0: it never spawns there). Empty for types only ever placed with ruins.
   */
  places: Partial<Record<SpawnPlace, number>>;
  /** Extra condition on the sky: spawns only while a storm rages or the moon is (nearly) new (HOSTILE_MOONLESS_*). */
  sky?: 'storm_or_moonless';
  /**
   * Placed by src/world with each Old Works ruin (spec 19.3), persistent and never respawned: 'guard' walks the ruin
   * (RUIN_WARDENS of them, active day and night within RUIN_GUARD_LEASH blocks of it); 'turret' stands on a ruin wall
   * (on RUIN_SENTRY_CHANCE of the ruins).
   */
  ruin?: 'guard' | 'turret';
  /** At most this many of the type loaded at once (the colossus: one). */
  maxLoaded?: number;
}

export interface HostileSpec {
  attack: HostileAttack;
  /** Damage of one landed attack on Normal (x HOSTILE_DAMAGE_MULT of the difficulty), cause 'automaton'. */
  damage: number;
  /** Seconds of telegraph before the attack is released. */
  windupS: number;
  /** Seconds from the start of one wind-up to the start of the next: the attack period (always > windupS). */
  cooldownS: number;
  /** Blocks: reach of a melee blow or zap, range of a bolt, distance a dash starts from, radius of a slam. */
  range: number;
  /** Blocks within which it notices the player with line of sight (HOSTILE_SENSE_BLIND without). */
  senseRange: number;
  /** Flies HOSTILE_HOVER_MIN..MAX blocks above the ground instead of walking (no legs; gravity does not apply). */
  flying?: boolean;
  /** Never moves: turns to aim but stays where it was placed (speed 0). */
  stationary?: boolean;
  /** Damage multiplier on hits from the front (within 90 degrees of where it faces): a shield arm, 0.5 halves them. */
  shieldFront?: number;
  /** Horizontal speed (blocks per second) a landed hit throws the player back with. */
  knockback?: number;
  /** bolt: a hit also sets the player burning, `perS` damage a second for `seconds` (cause 'ember'). */
  burn?: { seconds: number; perS: number };
  /** zap: damage multiplier while the player stands in water. */
  wetMult?: number;
  /** bolt: launch speed in blocks per second. */
  projectileSpeed?: number;
  /** dash: charge speed in blocks per second. */
  dashSpeed?: number;
  habitat: HostileHabitat;
}

/** Projectiles in flight (spec 19.2). */
export type ProjectileKind = 'ember_bolt';

// ---------------------------------------------------------------------------------------------
// Old Works loot (authored in src/content/loot.ts, rolled by src/world into the crates of ruins; spec 14)
// ---------------------------------------------------------------------------------------------

/** 'near': ruins on the surface close to spawn - modest help. 'deep': buried or far-flung ruins - richer finds. */
export type LootTier = 'near' | 'deep';

export interface LootEntry {
  item: string;
  /** Count, or an inclusive [min, max] range. */
  count: number | [number, number];
  /** Relative weight among the entries of its table (> 0). */
  weight: number;
}

export interface LootTableSpec {
  tier: LootTier;
  /** Number of weighted draws (with replacement), inclusive [min, max]. */
  rolls: [number, number];
  entries: LootEntry[];
}

// ---------------------------------------------------------------------------------------------
// Weather and the moon (spec 15). Numbers live in src/core/constants.ts, lookups in src/core/weather.ts.
// ---------------------------------------------------------------------------------------------

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm';
/** What actually falls at a place: rain turns to snow in the cold and to blown dust in the dunes. */
export type Precipitation = 'rain' | 'snow' | 'dust' | 'none';

/**
 * The weather as one module computes it (src/game, from the seed and the elapsed time) and the others read it
 * (sim, render, audio, HUD). Plain JSON: it is saved as it is.
 */
export interface WeatherState {
  /** The state the sky is in, or changing to while `blend` < 1. */
  kind: WeatherKind;
  /** The state it is changing from; equals `kind` once settled. */
  previous: WeatherKind;
  /** Progress of the change from `previous` to `kind`, 0..1 (1 = settled). Every effect eases across it. */
  blend: number;
  /** What falls where the player is (their biome and height): see `precipitationFor` in src/core/weather.ts. */
  precipitation: Precipitation;
  /** Strength of that precipitation right now, 0..1 (already eased by `blend`; 0 when nothing falls). */
  intensity: number;
  /** Cloud cover 0..1, eased by `blend`. */
  cloudCover: number;
  /** Phase of tonight's moon, integer 0..7: 0 = new moon, 4 = full moon. */
  moonPhase: number;
  /** The state that follows this one (the Hearth Log forecast). */
  next: WeatherKind;
  /** Seconds until the change to `next` begins. */
  nextInS: number;
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

// ---------------------------------------------------------------------------------------------
// Ember handwork: strokes and casting (docs/api/handwork-content.md)
// ---------------------------------------------------------------------------------------------

/** A block worked stroke by stroke: holding Use repeats `strokesPerS` times a second; `tool` in hand doubles strokes. */
export interface HandStationSpec {
  strokesPerS: number;
  tool?: ToolKind;
  /** The `SfxName` played on a stroke (one per station kind). */
  strokeSound?: string;
  /** Strokes count double for 20 s after taking molten metal from a crucible (the Stone Anvil). */
  hot?: boolean;
  /** Timed station: runs only under open sky by day, and rain resets it (the Drying Rack). */
  sky?: boolean;
}

/** A metal that can be poured: its ingot item and the bloom a take without a mould (or after the window) cools it into. */
export interface CastMetalSpec {
  key: string;
  ingot: string;
  bloom: string;
}

/** A fired mould: `unfired` is the clay piece it is fired from; one pour uses `units` ingots of a metal in `casts`. */
export interface MouldSpec {
  item: string;
  unfired: string;
  units: number;
  /** Metal key (CastMetalSpec.key) -> the item one pour makes. */
  casts: Record<string, string>;
}
