/**
 * The fence (docs/api/fence.md): a thin wooden post that grows an arm to every neighbouring fence or solid block, in all six
 * directions, so a run of fences is a railing, a lattice or a set of rafters. It is solid (a full-cell collision box) and does not
 * block light. Made by hand from planks and sticks.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

export default {
  blocks: [
    {
      key: 'fence', name: 'Fence', desc: 'A slim wooden post that joins to the fences and walls beside it. Use it for railings and rafters.',
      shape: 'fence', hardness: 0.8, tool: 'axe', category: 'block', textures: { all: 'plank' },
    },
  ],
  recipes: [{ id: 'fence', station: 'hand', inputs: amounts('2 plank, 2 stick'), output: amount('4 fence'), age: 0 }],
} satisfies AreaContent;
