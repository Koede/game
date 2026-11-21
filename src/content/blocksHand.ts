/**
 * Blocks and machines of the Ember handwork (docs/api/handwork-content.md section 2). Appended after every older block,
 * so saved voxel ids never move. All ten are 'hand' role machines: no power, no screen; the world interaction (a stroke,
 * a pour, a wait) is the interface. Recipes use the block key as their `station`.
 */
import { MOLTEN_WINDOW_S } from '../core/constants';
import type { BlockSpec, HandStationSpec, MachineSpec } from '../core/types';

interface Look {
  /** 'slab' stands half a block high. */
  shape?: 'cube' | 'slab';
  /** Wood or stone: what breaks it fastest. */
  tool: 'axe' | 'pickaxe';
  front?: boolean;
}

function station(key: string, name: string, desc: string, look: Look, machine: string, hand?: HandStationSpec, extra: Partial<BlockSpec> = {}): BlockSpec {
  return {
    key, name, desc, age: 0, machine, hardness: look.tool === 'axe' ? 1.5 : 2, tool: look.tool, stack: 16, category: 'machine',
    ...(look.shape === 'slab' ? { shape: 'slab' as const } : {}),
    ...(look.front ? { oriented: true } : {}),
    textures: { top: `${key}_top`, side: `${key}_side`, ...(look.front ? { front: `${key}_front` } : {}) },
    ...(hand ? { handStation: hand } : {}),
    ...extra,
  };
}

export const HAND_BLOCKS: BlockSpec[] = [
  station('chopping_block', 'Chopping Block', 'A log end set upright. Strike a log on it to split planks, or a plank to split sticks; an axe in hand doubles every stroke and the log yields six planks, not four.',
    { tool: 'axe' }, 'hand', { strokesPerS: 4, tool: 'axe', strokeSound: 'chop' }),
  station('hand_quern', 'Hand Quern', 'Two grinding stones, the upper turned by a peg. Load grain and turn it stroke by stroke: wheat becomes flour.',
    { tool: 'pickaxe', shape: 'slab' }, 'hand', { strokesPerS: 3, strokeSound: 'grind' }),
  station('stone_anvil', 'Stone Anvil', 'A block of brick with a flat face. Hammer ingots into plate and wire; metal taken fresh from the crucible is soft for 20 seconds and needs half the strokes.',
    { tool: 'pickaxe' }, 'hand', { strokesPerS: 2.5, tool: 'hammer', strokeSound: 'hammer', hot: true }),
  station('mortar', 'Mortar', 'A fired clay bowl and pestle. Pound ore into crushed ore; now and then a second portion shakes loose.',
    { tool: 'pickaxe', shape: 'slab' }, 'hand', { strokesPerS: 2, strokeSound: 'grind' }),
  station('clay_table', 'Clay Table', 'A plank table with a wet clay slab on it. Press and scrape clay into cups, pots and the moulds you pour metal into; fire the pieces in the furnace.',
    { tool: 'axe' }, 'hand', { strokesPerS: 2, strokeSound: 'scrape' }),
  station('loom', 'Loom', 'A wooden frame strung with fiber. Throw the shuttle stroke by stroke and fiber becomes cloth.',
    { tool: 'axe', front: true }, 'hand', { strokesPerS: 2, strokeSound: 'loom' }),
  station('drying_rack', 'Drying Rack', 'Sticks lashed into a frame. Left under open sky by day it dries soaked hide into leather and grass into fiber. Rain sets the work back.',
    { tool: 'axe' }, 'hand', { strokesPerS: 1, sky: true }),
  station('tanning_trough', 'Tanning Trough', 'A plank trough of water. A hide left in it for a minute is soaked and ready for the drying rack.',
    { tool: 'axe', shape: 'slab' }, 'hand', { strokesPerS: 1 }),
  station('casting_bench', 'Casting Bench', `A bench of brick with sockets for moulds. Set moulds in it and take molten metal from a furnace nearby: every mould is filled in turn. Metal stays molten for ${MOLTEN_WINDOW_S} seconds.`,
    { tool: 'pickaxe' }, 'casting_bench'),
  station('alloy_pot', 'Alloy Pot', 'A fired pot with a spout. Set against a lit furnace at 800 C, three copper and one tin ingot melt together into four bronze, molten and ready to pour.',
    { tool: 'pickaxe', shape: 'slab' }, 'alloy_pot'),
];

export const HAND_MACHINES: MachineSpec[] = [
  // hand - one saved entity per stroke or timed station (src/sim/handWork.ts, docs/api/handwork.md). Recipes name the block
  // key as their station; the stroke rate, tool, sound, hot-work and sky rules are the block's `handStation`.
  {
    kind: 'hand', name: 'Hand Station', role: 'hand',
    blocks: ['chopping_block', 'hand_quern', 'stone_anvil', 'mortar', 'clay_table', 'loom', 'drying_rack', 'tanning_trough'],
    desc: 'Worked by your own hands, stroke by stroke. Aim at it and use it: load an input, strike until the work bar is full, take the result.',
  },
  // casting_bench - holds up to 4 fired moulds; pours into each when molten metal is taken from a furnace within
  // params.range blocks (docs/api/handwork-content.md section 4).
  {
    kind: 'casting_bench', name: 'Casting Bench', role: 'hand', blocks: ['casting_bench'], params: { moulds: 4, range: 4 },
    desc: 'Set fired moulds in it, then take molten metal from a furnace within four blocks.',
  },
  // alloy_pot - must touch a lit furnace (any of six sides); recipes at station 'alloy_pot' run while that furnace is at
  // or above the recipe's minTempC and leave their output molten for params.moltenS.
  {
    kind: 'alloy_pot', name: 'Alloy Pot', role: 'hand', blocks: ['alloy_pot'], params: { moltenS: MOLTEN_WINDOW_S },
    desc: 'Melts ingots of two metals into an alloy while it touches a hot furnace.',
    placementHint: 'Set it against a furnace.',
  },
];
