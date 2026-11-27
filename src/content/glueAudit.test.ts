import { describe, expect, it } from 'vitest';
import { RECIPES, block } from '../core/registry';

describe('glue audit content', () => {
  it('leaves can drop their own species of sapling, and a sapling is a plantable block', () => {
    expect(block('oak_leaves').drops.some((d) => d.item === 'oak_sapling')).toBe(true);
    expect(block('pine_leaves').drops.some((d) => d.item === 'pine_sapling')).toBe(true);
    expect(block('oak_sapling').placeOn).toContain('grass');
  });

  it('ice melts into a pail of water', () => {
    expect(RECIPES.some((r) => r.output.item === 'water_pail' && r.inputs.some((i) => i.item === 'ice'))).toBe(true);
  });
});
