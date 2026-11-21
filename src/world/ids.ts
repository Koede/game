/** Block ids world generation writes, resolved once from the registry. */
import { blockId } from '../core/registry';

export const ID = {
  corestone: blockId('corestone'),
  stone: blockId('stone'),
  dirt: blockId('dirt'),
  grass: blockId('grass'),
  sand: blockId('sand'),
  gravel: blockId('gravel'),
  clay: blockId('clay'),
  snow: blockId('snow'),
  ice: blockId('ice'),
  basalt: blockId('basalt'),
  water: blockId('water'),
  lava: blockId('lava'),
  oakLog: blockId('oak_log'),
  oakLeaves: blockId('oak_leaves'),
  pineLog: blockId('pine_log'),
  pineLeaves: blockId('pine_leaves'),
  tallGrass: blockId('tall_grass'),
  dryShrub: blockId('dry_shrub'),
} as const;
