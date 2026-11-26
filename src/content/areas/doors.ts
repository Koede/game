/**
 * The wooden door (docs/api/door.md): two cells tall, a thin panel across its facing axis. Craft one by hand, place it in a
 * wall (the cell above must be free), and Use swings it open or shut. Closed it is solid; open it is passable.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const door: BlockSpec = {
  key: 'wooden_door', name: 'Wooden Door', desc: 'A plank door two cells tall. Place it in a wall with room above it, then Use it to open and shut it.',
  shape: 'door', oriented: true, solid: true, hardness: 1.5, tool: 'axe', category: 'block', textures: { all: 'plank' },
};
const recipe: RecipeSpec = { id: 'wooden_door', station: 'hand', inputs: amounts('4 plank, 2 stick'), output: amount('1 wooden_door'), age: 0 };

export default {
  blocks: [door],
  recipes: [recipe],
} satisfies AreaContent;
