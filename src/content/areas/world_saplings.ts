/**
 * Saplings (docs/api/tree-growth.md, "Planted trees"): one per tree species. Leaves and cut fallen logs drop them now
 * and then; placed on grass or dirt one grows into a tree through the tree growth (src/world/saplings.ts), and a
 * felling stump sometimes sprouts one of its own. Data only.
 */
import type { AreaContent } from '../area';

export default {
  blocks: [
    {
      key: 'oak_sapling', name: 'Oak Sapling', category: 'block', age: 0, shape: 'cross', hardness: 0.1, drops: 'self',
      desc: 'A young oak on a thin stem. Plant it on grass or dirt and in a few days it is a tree.',
      placeOn: ['grass', 'dirt'], textures: { all: 'oak_sapling' },
    },
    {
      key: 'pine_sapling', name: 'Pine Sapling', category: 'block', age: 0, shape: 'cross', hardness: 0.1, drops: 'self',
      desc: 'A pine seedling with a tuft of needles. Plant it on grass or dirt and it grows into a pine.',
      placeOn: ['grass', 'dirt'], textures: { all: 'pine_sapling' },
    },
  ],
} satisfies AreaContent;
