/**
 * The goals the Ember handwork adds (docs/EMBER_PLAN.md section 4), spliced into objectives.ts at the places the plan
 * puts them. Ids of the older objectives are untouched.
 */
import { FLAG_FIRST_POUR } from '../core/constants';
import type { ObjectiveSpec } from '../core/types';
import { amounts } from './amounts';

function goal(id: string, title: string, condition: ObjectiveSpec['condition'], text: string, reward?: string): ObjectiveSpec {
  return reward ? { id, title, text, condition, age: 0, reward: amounts(reward) } : { id, title, text, condition, age: 0 };
}

export const HAND_OBJECTIVES = {
  choppingBlock: goal('place_chopping_block', 'Set up a chopping block', { type: 'place', block: 'chopping_block', count: 1 },
    'Stand a log on end: that is a Chopping Block (hand recipe, one log). Strike a log on it, stroke by stroke, to split planks. An axe in hand doubles every stroke.'),
  clayTable: goal('place_clay_table', 'Build a clay table', { type: 'place', block: 'clay_table', count: 1 },
    'Make a Clay Table at the workbench from two planks and a clay and put it down. Clay worked on it by hand becomes cups, pots and moulds.'),
  fireMould: goal('fire_mould', 'Fire a mould', { type: 'make', item: 'ingot_mould', count: 1 },
    'Press two clay into an ingot mould on the clay table, then load it into a crucible and fire it at 500 C. Metal is poured into moulds, so you need one before you smelt.'),
  firstPour: goal('first_pour', 'Pour your first ingot', { type: 'flag', flag: FLAG_FIRST_POUR },
    'Smelt copper, then hold the mould and take the molten metal from the crucible within 20 seconds. Metal taken without a mould cools into a rough bloom that must be smelted again.'),
  quern: goal('place_quern', 'Set up a hand quern', { type: 'place', block: 'hand_quern', count: 1 },
    'Make a Hand Quern at the workbench from two stone bricks and a stick. It grinds grain stroke by stroke.'),
  grindFlour: goal('grind_flour', 'Grind flour', { type: 'make', item: 'flour', count: 1 },
    'Load wheat into the quern and use it until the work bar fills: one wheat, one flour.'),
  anvil: goal('place_anvil', 'Set up a stone anvil', { type: 'place', block: 'stone_anvil', count: 1 },
    'Make a Stone Anvil at the workbench from three stone bricks. A flint hammer in hand doubles every stroke.'),
  hammerPlate: goal('hammer_plate', 'Hammer a plate', { type: 'make', item: 'bronze_plate', count: 1 },
    'Load two bronze ingots on the Stone Anvil and strike until they are beaten flat. Metal fresh from the crucible is soft for 20 seconds and needs half the strokes.'),
  castHead: goal('cast_pick_head', 'Cast a pickaxe head', { type: 'make', item: 'bronze_pickaxe_head', count: 1 },
    'Fire a pickaxe mould, alloy three copper and one tin in an Alloy Pot set against the furnace at 800 C, and pour the molten bronze into the mould within 20 seconds.'),
  dryingRack: goal('place_drying_rack', 'Build a drying rack', { type: 'place', block: 'drying_rack', count: 1 },
    'Lash three sticks and a cord into a Drying Rack and set it under open sky. It works by day and rain sets it back.'),
  leather: goal('make_leather', 'Tan leather', { type: 'make', item: 'leather', count: 1 },
    'Soak two hides for a minute in a Tanning Trough (four planks and a water bucket), then dry them on the rack in the sun.'),
  loom: goal('weave_cloth', 'Weave cloth', { type: 'make', item: 'cloth', count: 1 },
    'Make a Loom at the workbench from four planks, two sticks and two cords, load four fiber and weave stroke by stroke. A padded coat is stuffed with cloth.'),
};
