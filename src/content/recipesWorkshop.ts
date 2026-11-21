/** Recipes of the Bronze workshop pieces (src/content/itemsWorkshop.ts). Workbench and Clay Furnace, Ember materials. */
import type { RecipeSpec } from '../core/types';
import { amount, amounts } from './amounts';

const bench = (id: string, output: string, inputs: string): RecipeSpec => ({ id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age: 0 });
const forge = (output: string, inputs: string, minTempC: number): RecipeSpec => ({
  id: amount(output).item, station: 'furnace', kind: 'forge', inputs: amounts(inputs), output: amount(output), minTempC, minTier: 1, age: 0,
});

export const WORKSHOP_RECIPES: RecipeSpec[] = [
  bench('hand_crank', 'hand_crank', '3 plank, 2 stick, 1 cord'),
  bench('drive_shaft', '4 drive_shaft', '2 plank, 1 stick'),
  bench('conveyor_belt', '6 conveyor_belt', '3 leather, 2 stick, 1 plank'),
  bench('conveyor_belt_cloth', '6 conveyor_belt', '4 cloth, 2 stick, 1 plank'),
  forge('mech_saw', '2 bronze_plate, 2 plank, 1 drive_shaft', 600),
  bench('mech_millstone', 'mech_millstone', '4 stone_brick, 1 drive_shaft'),
  forge('mech_mortar', '2 bronze_ingot, 2 stone_brick, 1 drive_shaft', 600),
  bench('mech_loom', 'mech_loom', '1 loom, 2 plank, 1 drive_shaft'),
  // Transmission parts (docs/OVERHAUL_PLAN.md A.2).
  forge('2 bronze_cog', '1 bronze_ingot', 600),
  forge('reverse_box', '2 bronze_cog, 1 drive_shaft, 1 plank', 600),
  forge('ratio_dial', '2 bronze_cog, 1 bronze_plate, 1 stick', 600),
  forge('clutch', '1 bronze_cog, 1 drive_shaft, 1 stick, 1 leather', 600),
  forge('split_box', '3 bronze_cog, 1 plank', 600),
  forge('clockwork_motor', '3 bronze_ingot, 2 bronze_cog, 1 bronze_plate', 600),
  forge('sequence_gearshift', '3 bronze_cog, 1 bronze_plate, 1 clockwork_motor', 700),
  forge('governor', '2 bronze_ingot, 1 bronze_cog, 1 drive_shaft', 600),
  forge('worm_gear', '1 bronze_ingot, 1 bronze_cog, 1 drive_shaft', 600),
  forge('2 chain_sprocket', '2 bronze_ingot, 1 bronze_cog', 600),
  forge('2 belt_pulley', '2 plank, 1 leather, 1 drive_shaft', 600),
  // Logistics and processing (docs/OVERHAUL_PLAN.md A.5-A.7).
  forge('2 funnel', '2 bronze_ingot', 600),
  forge('2 chute', '1 bronze_ingot, 1 plank', 600),
  forge('depot', '2 stone_brick, 1 bronze_ingot', 600),
  forge('basin', '3 stone_brick, 1 bronze_ingot', 600),
  forge('spout', '1 bronze_ingot, 1 stick', 600),
  forge('item_drain', '2 bronze_ingot, 1 stone_brick', 600),
  forge('mixer', '2 bronze_ingot, 1 bronze_cog, 1 drive_shaft', 600),
  forge('mech_press', '2 bronze_plate, 2 stone_brick, 1 drive_shaft', 600),
  forge('deployer', '2 bronze_plate, 1 bronze_cog, 1 drive_shaft, 1 leather', 600),
  forge('mech_arm', '2 bronze_plate, 2 bronze_cog, 1 drive_shaft', 600),
  forge('mech_drill', '2 bronze_ingot, 2 bronze_plate, 1 bronze_cog, 1 drive_shaft', 600),
  forge('mech_hammer', '3 bronze_ingot, 2 stone_brick, 1 drive_shaft', 600),
  forge('mech_rack', '2 bronze_ingot, 3 stick, 1 drive_shaft', 600),
  forge('engineer_goggles', '2 copper_ingot, 1 glass, 1 leather', 650),
];
