/**
 * The Builder's Square (docs/api/blueprint.md): the blueprint tool. Hold it and Use two corners of a build to save it as a
 * blueprint; in place mode, Use a spot and a builder automaton raises a copy from the chests near it. Rules in
 * src/game/blueprints.ts. Optional: nothing needs it.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

export default {
  items: [
    {
      key: 'builders_square', name: "Builder's Square", category: 'misc', age: 0, stack: 1,
      desc: 'Use two corners of a build to save it as a blueprint. In place mode, Use a spot and a builder raises a copy from the chests nearby.',
    },
  ],
  recipes: [
    { id: 'builders_square', station: 'workbench', inputs: amounts('2 stick, 1 plank, 1 charcoal'), output: amount('builders_square'), age: 0 },
  ],
} satisfies AreaContent;
