/**
 * Ruined old-age machines (docs/api/restoration.md): the rusted machine found in the Old Factory and the Chem Lab and
 * the machine it becomes when repaired. Rules in src/game/restoration.ts.
 */
import type { AreaContent } from '../area';

export default {
  blocks: [
    {
      key: 'ruined_machine', name: 'Ruined Machine', desc: 'A machine of the old age, rusted solid. Use it with the right parts in your pack to repair it and learn what it knew.',
      hardness: 6, tool: 'pickaxe', minTier: 2, item: false, drops: [{ item: 'iron_ore', count: [1, 2] }, { item: 'copper_wire', count: 1, chance: 0.5 }],
      textures: { top: 'ruined_machine_top', side: 'ruined_machine', bottom: 'ruined_machine' },
    },
    {
      key: 'repaired_machine', name: 'Repaired Machine', desc: 'An old-age machine, repaired and humming. It has taught you all it knew.',
      hardness: 4, tool: 'pickaxe', minTier: 1, item: false, light: 5, drops: [{ item: 'bronze_plate', count: 1 }],
      textures: { top: 'repaired_machine_top', side: 'repaired_machine', bottom: 'repaired_machine' },
    },
  ],
  naturalBlocks: ['ruined_machine'],
} satisfies AreaContent;
