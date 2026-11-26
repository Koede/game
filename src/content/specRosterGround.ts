/**
 * Test fixture: the roster of ground items (hand vacuum), the vehicles and chainsaw, and resin/sugar baking, typed in a
 * second time. specRoster.ts merges its items, furnace recipes and objectives into the roster (recipes sit where
 * recipes.ts lists them, not at the end). Nothing but the tests imports this file.
 */
export const GROUND_SPEC = {
  items: [
    'hand_vacuum', 'chainsaw', 'tractor', 'tractor_tiller', 'tractor_harvester',
    'glass_beaker', 'pine_sap', 'pine_resin', 'sugar', 'sugar_cookie', 'sweet_bun', 'sugar_cake',
  ],
  /** Furnace recipes inserted after the recipe with the given id prefix (the line before them in recipes.ts). */
  furnaceAfterWrench: [
    'hand_vacuum: 1 hand_vacuum <- 4 bronze_plate, 2 leather, 1 bellows, 2 copper_plate @800 T2',
    'glass_beaker: 2 glass_beaker <- 1 glass @650 T1',
    'pine_resin: 1 pine_resin <- 1 pine_sap @180 T1',
    'sugar: 3 sugar <- 2 pine_resin, 1 water_pail, 1 glass_beaker @260 T1',
    'sugar_cookie: 3 sugar_cookie <- 1 flour, 1 sugar @190 T1',
    'sweet_bun: 1 sweet_bun <- 1 dough, 1 sugar @220 T1',
    'sugar_cake: 1 sugar_cake <- 2 flour, 2 sugar, 1 water_pail @200 T1',
  ],
  furnaceAfterCombustionEngine: [
    'chainsaw: 1 chainsaw <- 1 chassis, 2 steel_plate, 1 copper_coil, 1 circuit @1300 T4',
    'tractor: 1 tractor <- 2 chassis, 4 steel_plate, 3 copper_coil, 1 circuit, 4 iron_plate @1400 T4',
    'tractor_tiller: 1 tractor_tiller <- 1 chassis, 4 iron_plate, 2 steel_plate @1200 T4',
    'tractor_harvester: 1 tractor_harvester <- 1 chassis, 4 steel_plate, 2 copper_coil @1300 T4',
  ],
  /** Objectives that follow the ward beacon one. */
  objectivesAfterBeacon: ['flag felled_tree', 'flag drove_tractor'],
};
