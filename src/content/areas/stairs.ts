/**
 * Stairs and slanted roof blocks (docs/api/stairs.md), in planks and in stone brick. Oriented: placed facing you, they rise away
 * from you. Stairs are walkable half-block steps; a slope is a wedge for roofs. Made by hand, four at a time.
 */
import type { AreaContent } from '../area';
import type { BlockSpec, RecipeSpec } from '../../core/types';
import { amount, amounts } from '../amounts';

const wood = (tile: string): boolean => tile === 'plank';
const stairs = (key: string, name: string, tile: string): BlockSpec => ({
  key, name, desc: 'Half-block steps that rise away from you when placed. Walk up them without jumping.',
  shape: 'stairs', oriented: true, hardness: wood(tile) ? 1.2 : 2, tool: wood(tile) ? 'axe' : 'pickaxe', category: 'block', textures: { all: tile },
});
const slope = (key: string, name: string, tile: string): BlockSpec => ({
  key, name, desc: 'A wedge that slants up away from you when placed: the pitch of a roof.',
  shape: 'slope', oriented: true, hardness: wood(tile) ? 1.2 : 2, tool: wood(tile) ? 'axe' : 'pickaxe', category: 'block', textures: { all: tile },
});
const hand = (id: string, output: string, inputs: string): RecipeSpec => ({ id, station: 'hand', inputs: amounts(inputs), output: amount(output), age: 0 });

export default {
  blocks: [
    stairs('plank_stairs', 'Plank Stairs', 'plank'),
    stairs('stone_brick_stairs', 'Stone Brick Stairs', 'stone_brick'),
    slope('plank_roof', 'Plank Roof', 'plank'),
    slope('stone_brick_roof', 'Stone Brick Roof', 'stone_brick'),
  ],
  recipes: [
    hand('plank_stairs', '4 plank_stairs', '3 plank'),
    hand('stone_brick_stairs', '4 stone_brick_stairs', '3 stone_brick'),
    hand('plank_roof', '4 plank_roof', '3 plank'),
    hand('stone_brick_roof', '4 stone_brick_roof', '3 stone_brick'),
  ],
} satisfies AreaContent;
