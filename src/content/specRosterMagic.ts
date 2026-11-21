/**
 * Test fixture: Essentia & Research content (docs/OVERHAUL_PLAN.md B) typed in a second time. specRoster.ts appends it
 * after the distillery. Nothing but the tests imports this file. The 21 vials are listed by aspect name on purpose.
 * Arcane and infusion rows are not registry recipes (recipesMagic.ts), so they are not listed here.
 */
const ASPECT_NAMES = [
  'cinder', 'loam', 'brook', 'gale', 'rune', 'rift',
  'glow', 'spring', 'vein', 'frost', 'ash', 'wane', 'drive', 'craft', 'mind', 'ward', 'steam', 'clarity',
  'spark', 'soul', 'void',
];

export const MAGIC_SPEC = {
  blocks: ['essentia_jar', 'void_jar', 'essentia_tube', 'rune_desk', 'infusion_altar', 'arcane_pedestal', 'clay_servant', 'magic_light'],
  items: [
    'field_notebook', 'glass_vial', 'vis_rod', 'bronze_rod', 'iron_rod',
    'focus_kindle', 'focus_light', 'focus_ward', 'focus_blink', 'vein_lens',
    ...ASPECT_NAMES.map((a) => `vial_${a}`),
  ],
  recipes: {
    hand: ['field_notebook: 1 field_notebook <- 1 plank, 3 fiber, 1 charcoal'],
    workbench: [
      'vis_rod: 1 vis_rod <- 2 stick, 1 glass_vial, 1 copper_ingot',
      'essentia_jar: 1 essentia_jar <- 3 glass, 1 plank',
    ],
    furnace: [
      'glass_vial: 2 glass_vial <- 1 glass @650 T1',
      'rune_desk: 1 rune_desk <- 4 plank, 2 copper_ingot, 1 glass @500 T1',
      'essentia_tube: 4 essentia_tube <- 2 glass, 1 copper_ingot @650 T1',
      'arcane_pedestal: 1 arcane_pedestal <- 3 stone_brick, 1 copper_ingot @500 T1',
    ],
  } as Record<string, string[]>,
  /** Texture layers: 24 + 7 item icons, the jar faces and 15 faces of the second slice (the atlas splits past the device limit). */
  textures: 48,
};

export const MAGIC_RECIPE_COUNT = Object.values(MAGIC_SPEC.recipes).reduce((n, l) => n + l.length, 0);
