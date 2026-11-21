/** Test fixture: the glassware (src/content/itemsGlass.ts) typed in a second time; appended after the workshop. */
export const GLASS_SPEC = {
  blocks: ['furnace_beaker', 'furnace_beaker_boiling', 'furnace_vial', 'furnace_vial_boiling', 'furnace_sap', 'furnace_sap_resin'],
  items: ['water_beaker', 'boiling_beaker', 'water_vial', 'boiling_vial'],
  recipes: {
    workbench: [
      'water_beaker: 4 water_beaker <- 1 water_pail, 4 glass_beaker',
      'water_vial: 4 water_vial <- 1 water_pail, 4 glass_vial',
    ],
    furnace: ['sugar_vial: 3 sugar <- 2 pine_resin, 1 water_pail, 1 glass_vial @260 T1'],
  } as Record<string, string[]>,
  /** Four icons and six furnace-top faces. */
  textures: 10,
};

export const GLASS_RECIPE_COUNT = Object.values(GLASS_SPEC.recipes).reduce((n, l) => n + l.length, 0);
