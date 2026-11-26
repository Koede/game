/**
 * The distillery's first goal (docs/DISTILLERY_PLAN.md "Left" 8): "Run your first spirit". Completed by the flag the
 * objective tracker raises when a boiling flask's 'distill:step' reaches `done` (src/game/objectives.ts). A Forge Age goal
 * placed before the Arc Furnace, so a save already past the Blast Furnace still starts the Forge Age at "Pipe it in".
 */
import type { AreaContent } from '../area';
import { FLAG_FIRST_SPIRIT } from '../../core/distill';

export default {
  objectives: [
    {
      id: 'first_spirit',
      title: 'Run your first spirit',
      text: 'Stand a boiling flask on a still base, run a column or condenser into a receiver, fill the flask and set the heat. When the flask chimes, the run is done.',
      condition: { type: 'flag', flag: FLAG_FIRST_SPIRIT },
      age: 2,
    },
  ],
  objectivesAfter: 'store_energy',
} satisfies AreaContent;
