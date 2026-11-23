/**
 * Tool-and-block synergy pass (docs/SYNERGY_TOOLS.md): building variants that the new tool uses make or consume.
 * Appended last so saved voxel ids never move (blockIds.lock.json). Data only.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const log = (key: string, name: string, desc: string, side: string): BlockSpec => ({
  key, name, desc, hardness: 2, tool: 'axe', category: 'block', textures: { side, top: 'log_top' },
});
const slab = (key: string, name: string, desc: string, texture: string, tool: 'axe' | 'pickaxe', hardness: number): BlockSpec => ({
  key, name, desc, shape: 'slab', hardness, tool, category: 'block', textures: { all: texture },
});
const pillar = (key: string, name: string, desc: string, side: string, top: string): BlockSpec => ({
  key, name, desc, hardness: 3.5, tool: 'pickaxe', category: 'block', textures: { side, top, bottom: top },
});
const wb = (id: string, output: string, inputs: string): RecipeSpec => ({ id, station: 'workbench', inputs: amounts(inputs), output: amount(output), age: 0 });

export default {
  blocks: [
    log('stripped_oak_log', 'Stripped Oak Log', 'An oak log with the bark taken off: pale, smooth, good for a clean beam. Made with an axe.', 'stripped_oak_side'),
    log('stripped_pine_log', 'Stripped Pine Log', 'A pine log with its bark and resin scraped off. Made with an axe; a chainsaw saws it into planks.', 'stripped_pine_side'),
    slab('plank_slab', 'Plank Slab', 'A plank sawn flat: half a block high. An axe halves a plank into one.', 'plank', 'axe', 1),
    slab('stone_slab', 'Stone Slab', 'A half-height step of stone.', 'stone', 'pickaxe', 2),
    slab('brick_slab', 'Brick Slab', 'A half-height step of fired brick.', 'brick', 'pickaxe', 3),
    slab('stone_brick_slab', 'Stone Brick Slab', 'A half-height step of stone brick.', 'stone_brick', 'pickaxe', 3.5),
    pillar('stone_pillar', 'Stone Pillar', 'Stacked courses of stone brick shaped into a post for halls and porches.', 'pillar_stone_side', 'stone_brick'),
    pillar('brick_pillar', 'Brick Pillar', 'A fired-brick post, banded at the joints.', 'pillar_brick_side', 'brick'),
    slab('brick_lintel', 'Brick Lintel', 'A flat brick beam to span a doorway or a furnace mouth.', 'lintel_side', 'pickaxe', 3),
    pillar('brick_chimney', 'Brick Chimney', 'A sooted brick stack with a dark flue. Stand it on a hearth to carry smoke up.', 'chimney_side', 'chimney_top'),
    { key: 'bronze_plate_block', name: 'Bronze Plate Block', desc: 'Four bronze plates riveted flat into a wall block. A hammer rivets it.', hardness: 4, tool: 'pickaxe', minTier: 1, category: 'block', textures: { all: 'bronze_plate_block' } },
    { key: 'rivet_plate_block', name: 'Riveted Plate Block', desc: 'Bronze plate with a hammered rivet at every corner. Machine-room cladding.', hardness: 4, tool: 'pickaxe', minTier: 1, category: 'block', textures: { all: 'rivet_plate_block' } },
  ],
  recipes: [
    wb('plank_slab', '2 plank_slab', '1 plank'),
    wb('stone_slab', '2 stone_slab', '3 rubble'),
    wb('brick_slab', '2 brick_slab', '1 brick'),
    wb('stone_brick_slab', '2 stone_brick_slab', '1 stone_brick'),
    wb('stone_pillar', '2 stone_pillar', '3 stone_brick'),
    wb('brick_pillar', '2 brick_pillar', '3 brick'),
    wb('brick_lintel', '2 brick_lintel', '3 brick'),
    wb('brick_chimney', '2 brick_chimney', '4 brick'),
    wb('bronze_plate_block', '1 bronze_plate_block', '4 bronze_plate'),
    wb('brick_from_slabs', '1 brick', '2 brick_slab'),
  ],
} satisfies AreaContent;
