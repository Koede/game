/**
 * Treasure maps (docs/api/treasure.md): a loot item. The map's serial and age ride on the stack; src/world/treasure.ts
 * turns them into a landmark clue and a buried chest. Optional: nothing needs it.
 */
import type { AreaContent } from '../area';

export default {
  items: [
    {
      key: 'treasure_map', name: 'Treasure Map', category: 'misc', age: 0, stack: 4,
      desc: 'A stained map with a landmark circled and a chest drawn beside it. Hold it for the clue; older maps hide humbler loot.',
    },
  ],
} satisfies AreaContent;
