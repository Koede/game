/**
 * Breadcrumbs for the caves (docs/plans/caves-and-depths.md, phase 4): chalk marks to draw a way home on a cave floor, and a cairn that glows.
 * Cheap on purpose, so a first torch-and-pickaxe trip below ground can afford to leave a trail. Optional: nothing needs them.
 */
import type { AreaContent } from '../area';
import { amount, amounts } from '../amounts';

export default {
  blocks: [
    {
      key: 'chalk_mark', name: 'Chalk Mark', desc: 'A white arrow and cross scrawled on the floor, to find your way back out of the dark. Break one to take it up.',
      shape: 'cross', hardness: 0, light: 1, placeOn: ['stone', 'rubble', 'gravel', 'clay', 'basalt', 'dirt', 'sand', 'limestone'], textures: { all: 'chalk_mark' },
    },
    {
      key: 'cave_cairn', name: 'Cave Cairn', desc: 'A knee-high heap of stones with a glowcap tucked in the top. It glows enough to see from across a cave, and the journal notes where you built it.',
      hardness: 1.5, tool: 'pickaxe', minTier: 0, light: 7, textures: { all: 'cave_cairn' },
    },
  ],
  recipes: [
    { id: 'chalk_mark', station: 'furnace', kind: 'forge', inputs: amounts('1 limestone'), output: amount('8 chalk_mark'), minTempC: 300, minTier: 1, age: 0 },
    { id: 'cave_cairn', station: 'furnace', kind: 'forge', inputs: amounts('4 rubble, 1 glowcap'), output: amount('cave_cairn'), minTempC: 300, minTier: 1, age: 0 },
  ],
} satisfies AreaContent;
