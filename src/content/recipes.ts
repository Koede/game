/**
 * Every recipe of the game (spec 2.3), in the order the stations list them. The furnace list is the tech tree:
 * crucible recipes first, then everything forged, tier by tier.
 *
 * `age` is the age in which a recipe first becomes usable; content.test.ts proves it against the progression
 * solver. When several recipes make the same item, the first one listed is the plain route (straight from ore).
 */
import type { RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';
import { MACHINE_SPECS } from './tech';

const hand = (id: string, output: string, inputs: string): RecipeSpec => ({
  id, station: 'hand', inputs: amounts(inputs), output: amount(output), age: 0,
});

const workbench = (id: string, output: string, inputs: string): RecipeSpec => ({
  id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age: 0,
});

/** Crucible recipe: one input item type, cooked over `timeS` while the furnace stays at `minTempC` or hotter. */
const smelt = (id: string, output: string, input: string, minTempC: number, timeS: number, minTier = 1, age = minTier - 1): RecipeSpec => ({
  id, station: 'furnace', kind: 'smelt', inputs: [amount(input)], output: amount(output), minTempC, timeS, minTier, age,
});

/** Made on the spot at a furnace of `minTier` or better that is at `minTempC` or hotter. The id is the output key. */
function forge(minTier: number, output: string, inputs: string, minTempC: number): RecipeSpec {
  const out = amount(output);
  return { id: out.item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: out, minTempC, minTier, age: minTier - 1 };
}

/** Recipes of one processing machine: one input item type, `timeS` per run, energy = the machine's draw x time. */
function machineRecipes(station: string, timeS: number, rows: Array<[output: string, input: string, age: number]>): RecipeSpec[] {
  const drawW = MACHINE_SPECS.find((m) => m.kind === station)?.drawW;
  if (!drawW) throw new Error(`content: "${station}" is not a powered machine`);
  return rows.map(([output, input, age]) => {
    const out = amount(output);
    return { id: out.item, station, inputs: [amount(input)], output: out, timeS, energyJ: drawW * timeS, age };
  });
}

const HAND: RecipeSpec[] = [
  hand('plank', '4 plank', 'oak_log'),
  hand('plank_pine', '4 plank', 'pine_log'),
  hand('stick', '4 stick', '2 plank'),
  hand('cord', 'cord', '3 fiber'),
  hand('flint_pickaxe', 'flint_pickaxe', '2 flint, 2 stick, 1 cord'),
  hand('flint_axe', 'flint_axe', '2 flint, 2 stick, 1 cord'),
  hand('flint_shovel', 'flint_shovel', '1 flint, 2 stick, 1 cord'),
  hand('workbench', 'workbench', '6 plank'),
  hand('torch', '4 torch', '1 stick, 1 charcoal'),
  hand('torch_coal', '4 torch', '1 stick, 1 coal'),
];

/** The complete workbench list, forever: it builds the first furnace and a handful of cold wooden things. */
const WORKBENCH: RecipeSpec[] = [
  workbench('furnace_clay', 'furnace_clay', '12 rubble, 6 clay'),
  workbench('crate', 'crate', '8 plank'),
  workbench('stone_brick', '4 stone_brick', '4 rubble'),
  workbench('pail', 'pail', '3 plank, 1 cord'),
  workbench('padded_coat', 'padded_coat', '6 cord, 6 fiber'),
  workbench('bellows', 'bellows', '4 plank, 4 cord'),
];

const SMELT: RecipeSpec[] = [
  smelt('charcoal', 'charcoal', 'oak_log', 300, 8),
  smelt('charcoal_pine', 'charcoal', 'pine_log', 300, 8),
  smelt('tin_ingot', 'tin_ingot', 'tin_ore', 250, 8),
  smelt('firebrick', '2 firebrick', 'clay', 400, 6),
  smelt('copper_ingot', 'copper_ingot', 'copper_ore', 700, 10),
  smelt('glass', 'glass', 'sand', 700, 8),
  // The crushed routes need a crusher, which is Forge Age equipment.
  smelt('tin_ingot_crushed', 'tin_ingot', 'crushed_tin', 250, 5, 1, 1),
  smelt('copper_ingot_crushed', 'copper_ingot', 'crushed_copper', 700, 6, 1, 1),
  smelt('coke', 'coke', 'coal', 1000, 12, 2),
  smelt('iron_ingot', 'iron_ingot', 'iron_ore', 1150, 12, 2),
  smelt('iron_ingot_crushed', 'iron_ingot', 'crushed_iron', 1150, 8, 2),
  smelt('aluminum_ingot', 'aluminum_ingot', '2 alumina', 1500, 12, 3),
  smelt('tungsten_rod', 'tungsten_rod', '2 tungsten_powder', 2000, 16, 3),
  smelt('fused_quartz', 'fused_quartz', '2 silica', 2400, 12, 4),
];

const FORGE: RecipeSpec[] = [
  // ---- Clay Furnace ----
  forge(1, '4 bronze_ingot', '3 copper_ingot, 1 tin_ingot', 800),
  forge(1, 'bronze_pickaxe', '3 bronze_ingot, 2 stick', 600),
  forge(1, 'bronze_axe', '3 bronze_ingot, 2 stick', 600),
  forge(1, 'bronze_shovel', '1 bronze_ingot, 2 stick', 600),
  forge(1, 'brick', '4 firebrick', 400),
  forge(1, '2 ceramic_insulator', '1 clay, 1 sand', 600),
  forge(1, '3 copper_wire', '1 copper_ingot', 500),
  forge(1, '6 copper_cable', '3 copper_wire, 2 ceramic_insulator', 500),
  forge(1, 'thermopile', '4 copper_ingot, 2 tin_ingot, 2 firebrick', 700),
  forge(1, 'lamp', '1 glass, 2 copper_wire', 500),

  // ---- Blast Furnace ----
  forge(2, 'iron_pickaxe', '3 iron_ingot, 2 stick', 1000),
  forge(2, 'iron_axe', '3 iron_ingot, 2 stick', 1000),
  forge(2, 'iron_shovel', '1 iron_ingot, 2 stick', 1000),
  forge(2, 'iron_plate', '2 iron_ingot', 900),
  forge(2, 'copper_coil', '4 copper_wire, 1 iron_ingot', 700),
  forge(2, 'chassis', '4 iron_plate, 2 bronze_ingot', 1000),
  forge(2, 'steam_engine', '1 chassis, 2 copper_coil, 4 iron_plate, 2 glass', 1000),
  forge(2, 'burner_generator', '1 chassis, 2 copper_coil, 4 firebrick', 1000),
  forge(2, 'water_wheel', '12 plank, 2 iron_plate, 2 copper_coil', 700),
  forge(2, 'blower', '2 iron_plate, 1 copper_coil, 1 bellows', 900),
  forge(2, 'space_heater', '2 iron_plate, 1 copper_coil', 900),
  forge(2, 'crusher', '1 chassis, 2 iron_plate, 1 copper_coil, 4 flint', 1000),
  forge(2, 'battery', '2 iron_plate, 2 copper_ingot, 3 sulfur', 900),
  forge(2, '2 steel_ingot', '2 iron_ingot, 1 coke, 1 limestone', 1400),
  forge(2, 'steel_plate', '2 steel_ingot', 1300),
  forge(2, 'steel_pickaxe', '3 steel_ingot, 2 stick', 1300),
  forge(2, 'steel_axe', '3 steel_ingot, 2 stick', 1300),
  forge(2, 'steel_shovel', '1 steel_ingot, 2 stick', 1300),
  forge(2, 'graphite_electrode', '3 coke', 1200),
  forge(2, '8 concrete', '4 gravel, 2 sand, 2 limestone', 600),

  // ---- Arc Furnace ----
  forge(3, 'silicon_wafer', '2 silica, 1 coke', 1700),
  forge(3, 'circuit', '1 silicon_wafer, 3 copper_wire, 1 ceramic_insulator', 900),
  forge(3, '6 heavy_cable', '3 aluminum_ingot, 2 ceramic_insulator', 900),
  forge(3, '2 empty_cell', '1 aluminum_ingot', 900),
  forge(3, 'wind_turbine', '3 aluminum_ingot, 2 copper_coil, 1 steel_plate', 1200),
  forge(3, 'solar_panel', '2 silicon_wafer, 1 glass, 1 aluminum_ingot', 1200),
  forge(3, 'still', '1 chassis, 2 steel_plate, 2 glass, 1 copper_coil', 1200),
  forge(3, 'combustion_engine', '1 chassis, 4 steel_plate, 3 copper_coil, 1 circuit', 1400),
  forge(3, 'geothermal_tap', '1 chassis, 4 steel_plate, 2 copper_coil, 1 circuit', 1400),
  forge(3, 'bore_rig', '1 chassis, 2 tungsten_rod, 2 copper_coil, 1 circuit', 1600),

  // ---- Plasma Furnace ----
  forge(4, '2 superalloy', '2 steel_ingot, 1 tungsten_rod, 1 aluminum_ingot', 2600),
  forge(4, 'power_drill', '2 superalloy, 2 tungsten_rod, 1 copper_coil, 1 battery', 2600),
  forge(4, 'lithium_bank', '6 lithium_salt, 2 superalloy, 2 circuit', 2400),
  forge(4, 'shield_suit', '4 superalloy, 2 fused_quartz, 6 cord', 2400),
  forge(4, 'centrifuge', '1 chassis, 4 superalloy, 2 copper_coil, 2 circuit', 2600),
  forge(4, 'electrolyzer', '1 chassis, 2 superalloy, 2 fused_quartz, 1 circuit', 2600),
  forge(4, 'fuel_rod', '4 enriched_pellet, 1 superalloy', 2000),
  forge(4, 'fission_pile', '1 chassis, 6 superalloy, 4 fused_quartz, 4 circuit', 2800),
  forge(4, 'magnet_ring', '4 copper_coil, 2 superalloy, 2 lithium_salt', 2800),
  forge(4, '6 super_cable', '1 magnet_ring, 2 aluminum_ingot, 2 ceramic_insulator', 2600),
  forge(4, 'star_core', '6 magnet_ring, 8 superalloy, 6 fused_quartz, 4 circuit', 3000),
];

const MACHINE: RecipeSpec[] = [
  ...machineRecipes('crusher', 4, [
    ['2 crushed_copper', 'copper_ore', 1],
    ['2 crushed_tin', 'tin_ore', 1],
    ['2 crushed_iron', 'iron_ore', 1],
    ['2 silica', 'quartz_ore', 1],
    ['2 alumina', 'bauxite', 1],
    ['2 tungsten_powder', 'wolframite', 1],
    ['2 lithium_salt', 'spodumene', 1],
    ['2 yellowcake', 'pitchblende', 3],
    ['gravel', 'rubble', 1],
    ['sand', 'gravel', 1],
  ]),
  ...machineRecipes('still', 20, [['fuel_canister', '2 oil_shale', 2]]),
  ...machineRecipes('centrifuge', 20, [['enriched_pellet', '4 yellowcake', 3]]),
  ...machineRecipes('electrolyzer', 45, [['deuterium_cell', 'empty_cell', 3]]),
];

export const RECIPE_SPECS: RecipeSpec[] = [...HAND, ...WORKBENCH, ...SMELT, ...FORGE, ...MACHINE];
