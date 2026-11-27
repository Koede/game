/**
 * Heat as a resource (docs/api/thermal.md): the insulated wall, a thick quilted panel that keeps a room's heat in. Every
 * other block's insulation is a table in src/game/thermal.ts. Data only.
 */
import type { AreaContent } from '../area';
import type { RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const bench = (id: string, output: string, inputs: string): RecipeSpec => ({ id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age: 0 });

export default {
  items: [],
  blocks: [
    {
      key: 'insulated_wall', name: 'Insulated Wall',
      desc: 'Planks packed with wool. Heat barely passes through it: a room walled and roofed in these stays warm on one torch. See it in the heat view.',
      hardness: 1.2, tool: 'axe', category: 'block', textures: { all: 'insulated_wall' },
    },
  ],
  recipes: [bench('insulated_wall', '4 insulated_wall', '4 plank, 3 wool')],
} satisfies AreaContent;
