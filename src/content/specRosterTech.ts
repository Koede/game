/**
 * Test fixture: the roster of spec sections 16-17 (item and fluid transport, multiblock hearths), typed in a second
 * time from the design document and docs/api/tech-content.md. specRoster.ts merges its blocks, items, machines and
 * block properties into the section 2 roster; techContent.test.ts checks the rest. Nothing but the tests imports it.
 */
import type { BlockDef, FluidKey, MachineRole, PipeSpec } from '../core/types';

type Numbers = Record<string, number>;

const pipe = (spec: PipeSpec): Partial<BlockDef> => ({ shape: 'pipe', solid: false, opaque: false, power: null, machine: null, pipe: spec, tool: 'pickaxe' });
const shellPart = (props: Partial<BlockDef> = {}): Partial<BlockDef> => ({ shape: 'cube', tool: 'pickaxe', minTier: 0, ...props });

export const TECH_SPEC = {
  blocks: [
    'item_pipe', 'fast_item_pipe', 'fluid_pipe', 'hot_fluid_pipe', 'pump', 'tank', 'boiler', 'steam_turbine',
    'refractory_brick', 'plasma_casing', 'star_casing', 'electrode', 'item_hatch', 'fluid_hatch', 'power_port',
  ],

  items: ['wrench'],

  blockProps: {
    item_pipe: pipe({ family: 'item', ratePerS: 0.5, batch: 4, speedBlocksPerS: 4 }),
    fast_item_pipe: pipe({ family: 'item', ratePerS: 2, batch: 16, speedBlocksPerS: 10 }),
    fluid_pipe: pipe({ family: 'fluid', ratePerS: 200, capacityL: 250 }),
    hot_fluid_pipe: pipe({ family: 'fluid', ratePerS: 1000, capacityL: 250, hot: true }),
    pump: { machine: 'pump', power: 'device', oriented: true },
    tank: { machine: 'tank', power: null },
    boiler: { machine: 'boiler', power: null, oriented: true },
    steam_turbine: { machine: 'steam_turbine', power: 'device', oriented: true },
    refractory_brick: shellPart({ machine: null }),
    plasma_casing: shellPart({ machine: null }),
    star_casing: shellPart({ machine: null }),
    electrode: shellPart({ machine: null }),
    item_hatch: shellPart({ machine: 'item_hatch', power: null }),
    fluid_hatch: shellPart({ machine: 'fluid_hatch', power: null }),
    power_port: shellPart({ machine: 'power_port', power: 'device' }),
  } as Record<string, Partial<BlockDef>>,

  /** kind -> [role, numbers by MachineSpec field or params name] (machines new in sections 16-17). */
  machines: {
    pump: ['consumer', { drawW: 50, litresPerS: 200, litresPerBlock: 1000, searchLimit: 32 }],
    tank: ['tank', {}],
    boiler: ['boiler', { minTempC: 200, steamPerWater: 10, steamLPerC: 1, capLPerS: 800, heatPerSteamL: 20 }],
    steam_turbine: ['generator', { outputW: 8000, steamLPerS: 800 }],
    item_hatch: ['hearth_part', {}],
    fluid_hatch: ['hearth_part', { lavaLPerFuel: 1000 }],
    power_port: ['hearth_part', {}],
  } as Record<string, [MachineRole, Numbers]>,

  /** kind -> [accepts, gives, capacityL] of every fluid endpoint (spec 16.2). */
  fluidPorts: {
    pump: [[], ['water', 'lava', 'crude_oil'], 1000],
    tank: [
      ['water', 'lava', 'steam', 'crude_oil', 'fuel', 'sap', 'syrup', 'sugar_wash', 'low_wines', 'spirit', 'fuel_ethanol', 'gasoline', 'kerosene', 'diesel', 'residue', 'slop'],
      ['water', 'lava', 'steam', 'crude_oil', 'fuel', 'sap', 'syrup', 'sugar_wash', 'low_wines', 'spirit', 'fuel_ethanol', 'gasoline', 'kerosene', 'diesel', 'residue', 'slop'],
      16_000,
    ],
    boiler: [['water'], ['steam'], 1000],
    steam_turbine: [['steam'], [], 1000],
    fluid_hatch: [['lava'], [], 1000],
    steam_engine: [['water'], [], 1000],
    electrolyzer: [['water'], [], 1000],
    fission_pile: [['water'], [], 2000],
    combustion_engine: [['fuel'], [], 4000],
    still: [['crude_oil'], ['fuel'], 4000],
    geothermal_tap: [['lava'], [], 2000],
    chem_port: [
      ['water', 'crude_oil', 'sap', 'syrup', 'sugar_wash', 'low_wines', 'spirit', 'fuel_ethanol', 'gasoline', 'kerosene', 'diesel', 'residue', 'slop'],
      ['water', 'sap', 'syrup', 'sugar_wash', 'low_wines', 'spirit', 'fuel_ethanol', 'gasoline', 'kerosene', 'diesel', 'residue', 'slop'],
      1000,
    ],
  } as Record<string, [FluidKey[], FluidKey[], number]>,

  /** key -> [name, hot, glow, world liquid, full bucket]. */
  fluids: {
    water: ['Water', false, false, 'water', 'water_pail'],
    lava: ['Lava', true, true, 'lava', 'lava_bucket'],
    steam: ['Steam', true, false, null, null],
    crude_oil: ['Crude Oil', false, false, 'oil', 'crude_canister'],
    fuel: ['Refined Fuel', false, false, null, null],
    // The glass distillery (fluidsDistill.ts).
    sap: ['Pine Sap', false, false, null, null],
    syrup: ['Pine Syrup', false, false, null, null],
    sugar_wash: ['Sugar Wash', false, false, null, null],
    low_wines: ['Low Wines', false, false, null, null],
    spirit: ['Spirit', false, false, null, null],
    fuel_ethanol: ['Fuel Ethanol', false, false, null, null],
    gasoline: ['Gasoline', false, false, null, 'gasoline_canister'],
    kerosene: ['Kerosene', false, false, null, 'kerosene_canister'],
    diesel: ['Diesel', false, false, null, 'diesel_canister'],
    residue: ['Heavy Residue', false, false, null, 'residue_canister'],
    slop: ['Slop', false, false, null, null],
  } as Record<string, [string, boolean, boolean, string | null, string | null]>,

  /** tier -> [walls, minInner, maxInner, ceiling, electrodes, powerPorts, maxCrucibles, crucibleBonus] (spec 17.1). */
  hearths: {
    2: [['brick', 'refractory_brick', 'plasma_casing', 'star_casing'], [1, 1, 1], [3, 3, 3], 'optional', 0, 0, 5, 1],
    3: [['refractory_brick', 'plasma_casing', 'star_casing'], [1, 1, 1], [4, 4, 3], 'required', 1, 0, 6, 1],
    4: [['plasma_casing', 'star_casing'], [2, 2, 2], [5, 5, 4], 'required', 0, 2, 8, 2],
    5: [['star_casing'], [3, 3, 3], [5, 5, 5], 'required', 0, 4, 9, 0],
  } as Record<number, [string[], number[], number[], string, number, number, number, number]>,
};
