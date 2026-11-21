/** Goals of brewing (BREWING_PLAN 3, 11.1), placed right after `bake_bread`. Their flags are emitted by src/sim and src/game. */
import { FLAG_BOILED_WATER, FLAG_BREWED, FLAG_SIX_CUPS } from '../core/constants';
import type { ObjectiveSpec } from '../core/types';
import { amounts } from './amounts';

export const BREW_OBJECTIVES: ObjectiveSpec[] = [
  {
    id: 'boil_bucket', title: 'Boil a bucket', age: 0, condition: { type: 'flag', flag: FLAG_BOILED_WATER },
    text: 'Fill a bucket with water and set it on top of your hot furnace (aim at the top and Use). In a few seconds it boils and steams.',
  },
  {
    id: 'first_brew', title: 'Brew a cup', age: 0, condition: { type: 'flag', flag: FLAG_BREWED }, reward: amounts('2 clay_cup'),
    text: 'Forge a clay cup and a drip cone at 400 C, set the cone on the cup, load it with dried tea (tea leaves dried in a crucible), then pour boiling water over it.',
  },
  {
    id: 'six_cups', title: 'Taste them all', age: 0, condition: { type: 'flag', flag: FLAG_SIX_CUPS }, reward: amounts('4 coal'),
    text: 'Green, black and berry tea, light and dark roast, and trail blend each give a different boost. Brew and drink all six.',
  },
];
