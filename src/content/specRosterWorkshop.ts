/** Test fixture: the Bronze workshop pieces (docs/OVERHAUL_PLAN.md A) typed in a second time; appended after magic. */
export const WORKSHOP_SPEC = {
  blocks: ['hand_crank', 'drive_shaft', 'conveyor_belt', 'mech_saw', 'mech_millstone', 'mech_mortar', 'mech_loom'],
  items: ['engineer_goggles'],
  recipes: {
    workbench: [
      'hand_crank: 1 hand_crank <- 3 plank, 2 stick, 1 cord',
      'drive_shaft: 4 drive_shaft <- 2 plank, 1 stick',
      'conveyor_belt: 6 conveyor_belt <- 3 leather, 2 stick, 1 plank',
      'conveyor_belt_cloth: 6 conveyor_belt <- 4 cloth, 2 stick, 1 plank',
      'mech_millstone: 1 mech_millstone <- 4 stone_brick, 1 drive_shaft',
      'mech_loom: 1 mech_loom <- 1 loom, 2 plank, 1 drive_shaft',
    ],
    furnace: [
      'mech_saw: 1 mech_saw <- 2 bronze_plate, 2 plank, 1 drive_shaft @600 T1',
      'mech_mortar: 1 mech_mortar <- 2 bronze_ingot, 2 stone_brick, 1 drive_shaft @600 T1',
      'engineer_goggles: 1 engineer_goggles <- 2 copper_ingot, 1 glass, 1 leather @650 T1',
    ],
  } as Record<string, string[]>,
  /** 19 faces and one icon. */
  textures: 20,
};

export const WORKSHOP_RECIPE_COUNT = Object.values(WORKSHOP_SPEC.recipes).reduce((n, l) => n + l.length, 0);
