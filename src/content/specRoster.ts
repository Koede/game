/**
 * Test fixture for content.test.ts: the roster of spec section 2, typed in a second time straight from the design
 * document. The content files are compared against it, so a slip in either place shows up as a failing test.
 * A deliberate balance change has to be made here as well. Nothing but the test imports this file.
 */
import type { BiomeKey, BlockDef, MachineRole } from '../core/types';

type Numbers = Record<string, number>;

const furnaceBlock = (lightActive: number, warmthActive: number): Partial<BlockDef> => ({
  machine: 'furnace', oriented: true, power: 'device', lightActive, warmthActive, tool: 'pickaxe', minTier: 0,
});
const pick = (minTier: number): Partial<BlockDef> => ({ tool: 'pickaxe', minTier });
const AXE: Partial<BlockDef> = { tool: 'axe', minTier: 0 };
const SHOVEL: Partial<BlockDef> = { tool: 'shovel', minTier: 0 };
const DEVICE: Partial<BlockDef> = { power: 'device', tool: 'pickaxe', minTier: 0 };
const FOLIAGE: Partial<BlockDef> = { drops: [{ item: 'fiber', count: 1, chance: 0.3 }, { item: 'stick', count: 1, chance: 0.15 }] };

export const SPEC = {
  blocks: [
    'air', 'corestone', 'stone', 'rubble', 'dirt', 'grass', 'sand', 'gravel', 'clay', 'snow', 'ice', 'basalt', 'limestone',
    'water', 'lava', 'oak_log', 'oak_leaves', 'pine_log', 'pine_leaves', 'tall_grass', 'dry_shrub',
    'coal_ore', 'copper_ore', 'tin_ore', 'iron_ore', 'sulfur_ore', 'quartz_ore', 'bauxite', 'wolframite', 'spodumene',
    'pitchblende', 'oil_shale',
    'plank', 'stone_brick', 'brick', 'glass', 'concrete', 'torch', 'workbench', 'crate', 'lamp',
    'furnace_clay', 'furnace_blast', 'furnace_arc', 'furnace_plasma', 'furnace_star',
    'thermopile', 'steam_engine', 'burner_generator', 'water_wheel', 'wind_turbine', 'solar_panel', 'combustion_engine',
    'geothermal_tap', 'fission_pile',
    'copper_cable', 'heavy_cable', 'super_cable', 'battery', 'lithium_bank',
    'blower', 'space_heater', 'crusher', 'still', 'bore_rig', 'centrifuge', 'electrolyzer',
    'corium',
  ],

  items: [
    'stick', 'fiber', 'cord', 'flint', 'coal', 'charcoal', 'coke', 'sulfur',
    'flint_pickaxe', 'flint_axe', 'flint_shovel', 'bronze_pickaxe', 'bronze_axe', 'bronze_shovel',
    'iron_pickaxe', 'iron_axe', 'iron_shovel', 'steel_pickaxe', 'steel_axe', 'steel_shovel', 'power_drill',
    'copper_ingot', 'tin_ingot', 'bronze_ingot', 'iron_ingot', 'steel_ingot', 'aluminum_ingot',
    'crushed_copper', 'crushed_tin', 'crushed_iron',
    'firebrick', 'ceramic_insulator', 'bellows', 'iron_plate', 'steel_plate', 'copper_wire', 'copper_coil', 'chassis',
    'graphite_electrode', 'silica', 'silicon_wafer', 'circuit', 'alumina', 'tungsten_powder', 'tungsten_rod', 'lithium_salt',
    'yellowcake', 'enriched_pellet', 'fuel_rod', 'empty_cell', 'deuterium_cell', 'superalloy', 'fused_quartz', 'magnet_ring',
    'star_core', 'fuel_canister',
    'pail', 'water_pail', 'padded_coat', 'shield_suit',
  ],

  /** material -> [tier, speed, durability] for its pickaxe, axe and shovel. */
  toolSets: { flint: [1, 2, 64], bronze: [2, 3, 192], iron: [3, 4.5, 384], steel: [4, 6, 768] } as Record<string, number[]>,

  /** item -> [energyJ, burnS, flameTempC]. */
  fuels: {
    stick: [30_000, 12, 450], plank: [60_000, 20, 550], oak_log: [200_000, 50, 650], pine_log: [200_000, 50, 650],
    charcoal: [400_000, 80, 1000], coal: [800_000, 100, 1250], coke: [1_200_000, 120, 1550],
  } as Record<string, number[]>,

  /**
   * station -> one line per recipe, in list order: "id: N output <- N input, ...", then for the furnace
   * "@minTempC [timeS s] Ttier" (a time marks a crucible recipe) and for machines "timeS s energyJ J".
   */
  recipes: {
    hand: [
      'plank: 4 plank <- 1 oak_log',
      'plank_pine: 4 plank <- 1 pine_log',
      'stick: 4 stick <- 2 plank',
      'cord: 1 cord <- 3 fiber',
      'flint_pickaxe: 1 flint_pickaxe <- 2 flint, 2 stick, 1 cord',
      'flint_axe: 1 flint_axe <- 2 flint, 2 stick, 1 cord',
      'flint_shovel: 1 flint_shovel <- 1 flint, 2 stick, 1 cord',
      'workbench: 1 workbench <- 6 plank',
      'torch: 4 torch <- 1 stick, 1 charcoal',
      'torch_coal: 4 torch <- 1 stick, 1 coal',
    ],
    workbench: [
      'furnace_clay: 1 furnace_clay <- 12 rubble, 6 clay',
      'crate: 1 crate <- 8 plank',
      'stone_brick: 4 stone_brick <- 4 rubble',
      'pail: 1 pail <- 3 plank, 1 cord',
      'padded_coat: 1 padded_coat <- 6 cord, 6 fiber',
      'bellows: 1 bellows <- 4 plank, 4 cord',
    ],
    furnace: [
      'charcoal: 1 charcoal <- 1 oak_log @300 8s T1',
      'charcoal_pine: 1 charcoal <- 1 pine_log @300 8s T1',
      'tin_ingot: 1 tin_ingot <- 1 tin_ore @250 8s T1',
      'firebrick: 2 firebrick <- 1 clay @400 6s T1',
      'copper_ingot: 1 copper_ingot <- 1 copper_ore @700 10s T1',
      'glass: 1 glass <- 1 sand @700 8s T1',
      'tin_ingot_crushed: 1 tin_ingot <- 1 crushed_tin @250 5s T1',
      'copper_ingot_crushed: 1 copper_ingot <- 1 crushed_copper @700 6s T1',
      'coke: 1 coke <- 1 coal @1000 12s T2',
      'iron_ingot: 1 iron_ingot <- 1 iron_ore @1150 12s T2',
      'iron_ingot_crushed: 1 iron_ingot <- 1 crushed_iron @1150 8s T2',
      'aluminum_ingot: 1 aluminum_ingot <- 2 alumina @1500 12s T3',
      'tungsten_rod: 1 tungsten_rod <- 2 tungsten_powder @2000 16s T3',
      'fused_quartz: 1 fused_quartz <- 2 silica @2400 12s T4',

      'bronze_ingot: 4 bronze_ingot <- 3 copper_ingot, 1 tin_ingot @800 T1',
      'bronze_pickaxe: 1 bronze_pickaxe <- 3 bronze_ingot, 2 stick @600 T1',
      'bronze_axe: 1 bronze_axe <- 3 bronze_ingot, 2 stick @600 T1',
      'bronze_shovel: 1 bronze_shovel <- 1 bronze_ingot, 2 stick @600 T1',
      'brick: 1 brick <- 4 firebrick @400 T1',
      'ceramic_insulator: 2 ceramic_insulator <- 1 clay, 1 sand @600 T1',
      'copper_wire: 3 copper_wire <- 1 copper_ingot @500 T1',
      'copper_cable: 6 copper_cable <- 3 copper_wire, 2 ceramic_insulator @500 T1',
      'thermopile: 1 thermopile <- 4 copper_ingot, 2 tin_ingot, 2 firebrick @700 T1',
      'lamp: 1 lamp <- 1 glass, 2 copper_wire @500 T1',

      'iron_pickaxe: 1 iron_pickaxe <- 3 iron_ingot, 2 stick @1000 T2',
      'iron_axe: 1 iron_axe <- 3 iron_ingot, 2 stick @1000 T2',
      'iron_shovel: 1 iron_shovel <- 1 iron_ingot, 2 stick @1000 T2',
      'iron_plate: 1 iron_plate <- 2 iron_ingot @900 T2',
      'copper_coil: 1 copper_coil <- 4 copper_wire, 1 iron_ingot @700 T2',
      'chassis: 1 chassis <- 4 iron_plate, 2 bronze_ingot @1000 T2',
      'steam_engine: 1 steam_engine <- 1 chassis, 2 copper_coil, 4 iron_plate, 2 glass @1000 T2',
      'burner_generator: 1 burner_generator <- 1 chassis, 2 copper_coil, 4 firebrick @1000 T2',
      'water_wheel: 1 water_wheel <- 12 plank, 2 iron_plate, 2 copper_coil @700 T2',
      'blower: 1 blower <- 2 iron_plate, 1 copper_coil, 1 bellows @900 T2',
      'space_heater: 1 space_heater <- 2 iron_plate, 1 copper_coil @900 T2',
      'crusher: 1 crusher <- 1 chassis, 2 iron_plate, 1 copper_coil, 4 flint @1000 T2',
      'battery: 1 battery <- 2 iron_plate, 2 copper_ingot, 3 sulfur @900 T2',
      'steel_ingot: 2 steel_ingot <- 2 iron_ingot, 1 coke, 1 limestone @1400 T2',
      'steel_plate: 1 steel_plate <- 2 steel_ingot @1300 T2',
      'steel_pickaxe: 1 steel_pickaxe <- 3 steel_ingot, 2 stick @1300 T2',
      'steel_axe: 1 steel_axe <- 3 steel_ingot, 2 stick @1300 T2',
      'steel_shovel: 1 steel_shovel <- 1 steel_ingot, 2 stick @1300 T2',
      'graphite_electrode: 1 graphite_electrode <- 3 coke @1200 T2',
      'concrete: 8 concrete <- 4 gravel, 2 sand, 2 limestone @600 T2',

      'silicon_wafer: 1 silicon_wafer <- 2 silica, 1 coke @1700 T3',
      'circuit: 1 circuit <- 1 silicon_wafer, 3 copper_wire, 1 ceramic_insulator @900 T3',
      'heavy_cable: 6 heavy_cable <- 3 aluminum_ingot, 2 ceramic_insulator @900 T3',
      'empty_cell: 2 empty_cell <- 1 aluminum_ingot @900 T3',
      'wind_turbine: 1 wind_turbine <- 3 aluminum_ingot, 2 copper_coil, 1 steel_plate @1200 T3',
      'solar_panel: 1 solar_panel <- 2 silicon_wafer, 1 glass, 1 aluminum_ingot @1200 T3',
      'still: 1 still <- 1 chassis, 2 steel_plate, 2 glass, 1 copper_coil @1200 T3',
      'combustion_engine: 1 combustion_engine <- 1 chassis, 4 steel_plate, 3 copper_coil, 1 circuit @1400 T3',
      'geothermal_tap: 1 geothermal_tap <- 1 chassis, 4 steel_plate, 2 copper_coil, 1 circuit @1400 T3',
      'bore_rig: 1 bore_rig <- 1 chassis, 2 tungsten_rod, 2 copper_coil, 1 circuit @1600 T3',

      'superalloy: 2 superalloy <- 2 steel_ingot, 1 tungsten_rod, 1 aluminum_ingot @2600 T4',
      'power_drill: 1 power_drill <- 2 superalloy, 2 tungsten_rod, 1 copper_coil, 1 battery @2600 T4',
      'lithium_bank: 1 lithium_bank <- 6 lithium_salt, 2 superalloy, 2 circuit @2400 T4',
      'shield_suit: 1 shield_suit <- 4 superalloy, 2 fused_quartz, 6 cord @2400 T4',
      'centrifuge: 1 centrifuge <- 1 chassis, 4 superalloy, 2 copper_coil, 2 circuit @2600 T4',
      'electrolyzer: 1 electrolyzer <- 1 chassis, 2 superalloy, 2 fused_quartz, 1 circuit @2600 T4',
      'fuel_rod: 1 fuel_rod <- 4 enriched_pellet, 1 superalloy @2000 T4',
      'fission_pile: 1 fission_pile <- 1 chassis, 6 superalloy, 4 fused_quartz, 4 circuit @2800 T4',
      'magnet_ring: 1 magnet_ring <- 4 copper_coil, 2 superalloy, 2 lithium_salt @2800 T4',
      'super_cable: 6 super_cable <- 1 magnet_ring, 2 aluminum_ingot, 2 ceramic_insulator @2600 T4',
      'star_core: 1 star_core <- 6 magnet_ring, 8 superalloy, 6 fused_quartz, 4 circuit @3000 T4',
    ],
    crusher: [
      'crushed_copper: 2 crushed_copper <- 1 copper_ore 4s 4000J',
      'crushed_tin: 2 crushed_tin <- 1 tin_ore 4s 4000J',
      'crushed_iron: 2 crushed_iron <- 1 iron_ore 4s 4000J',
      'silica: 2 silica <- 1 quartz_ore 4s 4000J',
      'alumina: 2 alumina <- 1 bauxite 4s 4000J',
      'tungsten_powder: 2 tungsten_powder <- 1 wolframite 4s 4000J',
      'lithium_salt: 2 lithium_salt <- 1 spodumene 4s 4000J',
      'yellowcake: 2 yellowcake <- 1 pitchblende 4s 4000J',
      'gravel: 1 gravel <- 1 rubble 4s 4000J',
      'sand: 1 sand <- 1 gravel 4s 4000J',
    ],
    still: ['fuel_canister: 1 fuel_canister <- 2 oil_shale 20s 40000J'],
    centrifuge: ['enriched_pellet: 1 enriched_pellet <- 4 yellowcake 20s 160000J'],
    electrolyzer: ['deuterium_cell: 1 deuterium_cell <- 1 empty_cell 45s 900000J'],
  } as Record<string, string[]>,

  /** tier, block, name, maxTempC, heatCapacityJ, lossWPerC, crucibles, fuelSlots, speed, electricHeatW, warmth, upgradeTempC, upgradeCost. */
  furnaceTiers: [
    [1, 'furnace_clay', 'Clay Furnace', 800, 150, 2, 1, 1, 1, 0, 6, 0, ''],
    [2, 'furnace_blast', 'Blast Furnace', 1500, 300, 2.5, 2, 2, 1.25, 0, 8, 700, '12 firebrick, 8 bronze_ingot, 1 bellows'],
    [3, 'furnace_arc', 'Arc Furnace', 2100, 400, 3, 3, 2, 1.5, 8000, 10, 1200, '3 graphite_electrode, 4 copper_coil, 8 steel_plate, 8 firebrick'],
    [4, 'furnace_plasma', 'Plasma Furnace', 3200, 800, 8, 4, 2, 2, 40000, 12, 1900, '4 tungsten_rod, 8 steel_plate, 6 copper_coil, 3 circuit, 4 aluminum_ingot'],
    [5, 'furnace_star', 'Starhearth', 3200, 800, 8, 4, 2, 3, 40000, 24, 3000, '1 star_core, 8 deuterium_cell'],
  ] as Array<Array<string | number>>,

  /** kind -> [role, every number of spec 2.5 / 3.3, by MachineSpec field or params name]. */
  machines: {
    furnace: ['furnace', {
      outputW: 1_000_000, ignitionTempC: 3000, ignitionPowerW: 300_000, ignitionSeconds: 90,
      ignitionMinSatisfaction: 0.95, ignitionGraceS: 2, ignitedTempC: 5000,
    }],
    crate: ['crate', { slots: 27 }],
    thermopile: ['generator', { outputW: 300, wattsPerC: 0.25, minTempC: 100, capW: 300, heatPerWatt: 4 }],
    steam_engine: ['generator', { outputW: 2000, wattsPerC: 4, minTempC: 250, capW: 2000, heatPerWatt: 3, minWater: 1 }],
    burner_generator: ['generator', { outputW: 3000, efficiency: 0.3, slots: 1 }],
    water_wheel: ['generator', { outputW: 400, minWater: 2, shareRadius: 3 }],
    wind_turbine: ['generator', { outputW: 1500, windMin: 0.25, windMax: 1, altitudeBaseY: 40, altitudeSpanY: 40, altitudeMin: 0.25, altitudeMax: 1 }],
    solar_panel: ['generator', { outputW: 300, minSunlight: 0.1 }],
    combustion_engine: ['generator', { outputW: 12_000, efficiency: 0.4, fuelEnergyJ: 6_000_000, slots: 1 }],
    geothermal_tap: ['generator', { outputW: 6000, wattsPerLava: 2000, capW: 6000 }],
    fission_pile: ['generator', {
      outputW: 60_000, efficiency: 1, slots: 1, rodEnergyJ: 72_000_000, minWater: 2, runTempC: 600, warnTempC: 900, meltdownTempC: 1200,
      meltdownSeconds: 10, heatRateC: 8, coolRateC: 20, blastRadius: 3, warnRadiation: 4, warnRadius: 6, alarmIntervalS: 2,
    }],
    battery: ['storage', { capacityJ: 2_000_000, rateW: 3000, chargeEfficiency: 0.9 }],
    lithium_bank: ['storage', { capacityJ: 40_000_000, rateW: 150_000, chargeEfficiency: 0.9 }],
    lamp: ['consumer', { drawW: 10 }],
    blower: ['consumer', { drawW: 150, draftFloor: 0.8 }],
    space_heater: ['consumer', { drawW: 300, warmRadius: 6 }],
    crusher: ['consumer', { drawW: 1000, slots: 2 }],
    still: ['consumer', { drawW: 2000, slots: 2 }],
    bore_rig: ['consumer', { drawW: 4000, slots: 9, secondsPerBlock: 2, toolTier: 4 }],
    centrifuge: ['consumer', { drawW: 8000, slots: 2 }],
    electrolyzer: ['consumer', { drawW: 20_000, slots: 2, minWater: 1 }],
  } as Record<string, [MachineRole, Numbers]>,

  /** block, minY, maxY, veinsPerChunk, veinSize, biome multipliers. */
  oreVeins: [
    ['coal_ore', 20, 70, 5, 8, {}],
    ['copper_ore', 16, 60, 4, 6, { dunes: 2 }],
    ['tin_ore', 30, 66, 2.5, 5, {}],
    ['limestone', 22, 52, 1.5, 14, {}],
    ['iron_ore', 6, 46, 4, 6, {}],
    ['sulfur_ore', 4, 34, 1, 5, { scar: 3 }],
    ['oil_shale', 10, 40, 1, 8, { dunes: 2, scar: 2 }],
    ['quartz_ore', 6, 38, 1.5, 5, {}],
    ['bauxite', 18, 46, 1.5, 6, { dunes: 2 }],
    ['wolframite', 3, 20, 0.7, 5, { frostfell: 2 }],
    ['spodumene', 3, 22, 0.6, 5, { dunes: 2 }],
    ['pitchblende', 2, 14, 0.5, 4, { scar: 3 }],
  ] as Array<Array<string | number | Partial<Record<BiomeKey, number>>>>,

  /** Objective conditions in order, in the notation of `signature()` in the test. */
  objectives: [
    'any(break oak_log 4 | break pine_log 4)', 'make plank 4', 'place workbench 1', 'have flint 3', 'make flint_pickaxe 1',
    'have rubble 12', 'have clay 6', 'place furnace_clay 1', 'flag furnace_lit', 'make charcoal 4', 'flag well_warmed',
    'make copper_ingot 2', 'make bronze_ingot 4', 'make bronze_pickaxe 1', 'temp 800', 'generate 100', 'place lamp 1', 'tier 2',
    'make iron_ingot 8', 'make steel_ingot 6', 'place crusher 1', 'flag machine_job', 'generate 2000', 'stored 1000000', 'tier 3',
    'temp 1900', 'make circuit 2', 'generate 10000', 'make tungsten_rod 4', 'tier 4',
    'make superalloy 8', 'place fission_pile 1', 'generate 60000', 'make deuterium_cell 8', 'make star_core 1', 'tier 5',
    'flag ignited',
  ],

  /** Properties spec 2.1 states outright, checked against the resolved BlockDef. */
  blockProps: {
    corestone: { hardness: -1, drops: [] },
    stone: { ...pick(1), drops: [{ item: 'rubble', count: 1 }] },
    rubble: pick(0),
    dirt: SHOVEL, sand: SHOVEL, clay: SHOVEL, snow: SHOVEL,
    grass: { ...SHOVEL, drops: [{ item: 'dirt', count: 1 }] },
    gravel: { ...SHOVEL, drops: [{ item: 'gravel', count: 1 }, { item: 'flint', count: 1, chance: 0.25 }] },
    basalt: pick(2), limestone: pick(1),
    water: { shape: 'liquid', liquid: 'water', itemKey: null },
    lava: { shape: 'liquid', liquid: 'lava', light: 15, contactDamage: 4, warmth: 4, itemKey: null },
    oak_log: AXE, pine_log: AXE, plank: AXE, workbench: { ...AXE, station: 'workbench' }, crate: { ...AXE, machine: 'crate' },
    oak_leaves: FOLIAGE, pine_leaves: FOLIAGE,
    tall_grass: { shape: 'cross', drops: [{ item: 'fiber', count: 1, chance: 0.5 }] },
    dry_shrub: { shape: 'cross', drops: [{ item: 'stick', count: [1, 2] }] },
    coal_ore: { ...pick(1), drops: [{ item: 'coal', count: [1, 2] }] },
    copper_ore: pick(1), tin_ore: pick(1), iron_ore: pick(2), oil_shale: pick(2),
    sulfur_ore: { ...pick(2), drops: [{ item: 'sulfur', count: [1, 2] }] },
    quartz_ore: pick(3), bauxite: pick(3), wolframite: pick(4), spodumene: pick(4),
    pitchblende: { ...pick(5), radiation: 2 },
    glass: { translucent: true },
    torch: { shape: 'torch', light: 13, warmth: 2 },
    lamp: { ...DEVICE, machine: 'lamp', light: 0, lightActive: 15 },
    furnace_clay: furnaceBlock(11, 6), furnace_blast: furnaceBlock(12, 8), furnace_arc: furnaceBlock(13, 10),
    furnace_plasma: furnaceBlock(14, 12), furnace_star: furnaceBlock(15, 24),
    thermopile: DEVICE, steam_engine: DEVICE, burner_generator: DEVICE, water_wheel: DEVICE, wind_turbine: DEVICE,
    solar_panel: { ...DEVICE, shape: 'slab' }, combustion_engine: DEVICE, geothermal_tap: DEVICE, fission_pile: DEVICE,
    battery: DEVICE, lithium_bank: DEVICE, blower: DEVICE, crusher: DEVICE, still: DEVICE, bore_rig: DEVICE,
    centrifuge: DEVICE, electrolyzer: DEVICE,
    space_heater: { ...DEVICE, warmth: 0, warmthActive: 6 },
    corium: { ...pick(5), radiation: 8, light: 9, drops: [], itemKey: null },
  } as Record<string, Partial<BlockDef>>,

  /** Block items that exist for the codex but can never be picked up: these blocks drop something else. */
  worldOnlyItems: ['stone', 'grass', 'oak_leaves', 'pine_leaves', 'tall_grass', 'dry_shrub', 'coal_ore', 'sulfur_ore'],

  /** World blocks the tech tree must not depend on: lava, loose rubble, and the biome-flavoured ones. */
  optionalWorldBlocks: ['lava', 'rubble', 'snow', 'ice', 'basalt'],

  /** Ceiling on distinct texture names (block faces + item icons + 'missing'). */
  maxTextures: 170,
};
