/**
 * Waypoint stones (docs/api/waypoints.md): a craftable standing stone. Placing one registers it and visiting it
 * unlocks fast travel to it from any other stone (rules in src/sim/waypoints.ts). Optional: nothing needs it.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

export default {
  blocks: [
    {
      key: 'waypoint_stone', name: 'Waypoint Stone', category: 'block', age: 0, hardness: 2, tool: 'pickaxe', minTier: 0,
      desc: 'A carved standing stone. Place it, then Use it to name it. Use one to travel to any other stone you have visited, for a little charcoal.',
      light: 4, textures: { top: 'waypoint_stone_top', side: 'waypoint_stone_side', bottom: 'waypoint_stone_side' },
    },
  ],
  recipes: [
    { id: 'waypoint_stone', station: 'furnace', kind: 'forge', inputs: amounts('6 stone_brick, 2 charcoal, 1 flint'), output: amount('waypoint_stone'), minTempC: 500, minTier: 1, age: 0 },
  ],
} satisfies AreaContent;
