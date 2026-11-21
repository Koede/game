/**
 * Test fixture: Essentia & Research content (docs/OVERHAUL_PLAN.md B) typed in a second time. specRoster.ts appends it
 * after the distillery. Nothing but the tests imports this file. The 21 vials are listed by aspect name on purpose.
 */
const ASPECT_NAMES = [
  'cinder', 'loam', 'brook', 'gale', 'rune', 'rift',
  'glow', 'spring', 'vein', 'frost', 'ash', 'wane', 'drive', 'craft', 'mind', 'ward', 'steam', 'clarity',
  'spark', 'soul', 'void',
];

export const MAGIC_SPEC = {
  blocks: ['essentia_jar'],
  items: ['field_notebook', 'glass_vial', 'vis_rod', ...ASPECT_NAMES.map((a) => `vial_${a}`)],
  recipes: {
    hand: ['field_notebook: 1 field_notebook <- 1 plank, 3 fiber, 1 charcoal'],
    workbench: [
      'vis_rod: 1 vis_rod <- 2 stick, 1 glass_vial, 1 copper_ingot',
      'essentia_jar: 1 essentia_jar <- 3 glass, 1 plank',
    ],
    furnace: ['glass_vial: 4 glass_vial <- 1 glass @650 T1'],
  } as Record<string, string[]>,
  /** Texture layers added: 24 item icons and the two jar faces (the atlas splits beyond the device's layer limit). */
  textures: 26,
};

export const MAGIC_RECIPE_COUNT = Object.values(MAGIC_SPEC.recipes).reduce((n, l) => n + l.length, 0);
