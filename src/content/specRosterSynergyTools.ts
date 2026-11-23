/**
 * Test fixture: the tool-and-block synergy blocks and their workbench recipes (src/content/areas/synergy_tools.ts),
 * typed in a second time. Items only the new tool uses can make are "world only" to the progression solver.
 */
export const SYNERGY_TOOLS_SPEC = {
  blocks: [
    'stripped_oak_log', 'stripped_pine_log', 'plank_slab', 'stone_slab', 'brick_slab', 'stone_brick_slab', 'stone_pillar', 'brick_pillar',
    'brick_lintel', 'brick_chimney', 'bronze_plate_block', 'rivet_plate_block',
  ],
  /** Made only by a tool Use in the world (axe strips a log, hammer rivets a plate block). */
  worldOnly: ['stripped_oak_log', 'stripped_pine_log', 'rivet_plate_block'],
  textures: 9,
};

/** The fence (src/content/areas/fence.ts): a connecting post for railings and rafters; no new texture (it wears the plank tile). */
export const FENCE_SPEC = {
  blocks: ['fence', 'plank_stairs', 'stone_brick_stairs', 'plank_roof', 'stone_brick_roof'],
  recipes: {
    hand: [
      'fence: 4 fence <- 2 plank, 2 stick',
      'plank_stairs: 4 plank_stairs <- 3 plank',
      'stone_brick_stairs: 4 stone_brick_stairs <- 3 stone_brick',
      'plank_roof: 4 plank_roof <- 3 plank',
      'stone_brick_roof: 4 stone_brick_roof <- 3 stone_brick',
    ],
  },
};

/** Goat milk and wool (src/content/areas/synergy_animals.ts). */
export const SYNERGY_ANIMALS_SPEC = {
  blocks: ['wool_bedding'],
  items: ['milk_pail', 'milk_beaker', 'wool', 'shears', 'cheese', 'butter', 'milk_tea', 'milk_coffee'],
  /** Eight icons and the bedding tile. */
  textures: 9,
};
