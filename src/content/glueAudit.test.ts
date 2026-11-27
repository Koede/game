import { describe, expect, it } from 'vitest';
import { RECIPES, block, item } from '../core/registry';

describe('glue audit content', () => {
  it('swords and spears are weapons that cannot mine, and each metal has both recipes', () => {
    for (const m of ['bronze', 'iron', 'steel']) {
      expect(item(`${m}_sword`).tool?.kind).toBe('sword');
      expect(item(`${m}_spear`).tool?.kind).toBe('spear');
      expect(item(`${m}_sword`).weapon!.damage).toBeGreaterThan(item(`${m}_spear`).weapon!.damage);
      expect(RECIPES.some((r) => r.output.item === `${m}_sword`)).toBe(true);
      expect(RECIPES.some((r) => r.output.item === `${m}_spear`)).toBe(true);
    }
  });

  it('leaves can drop their own species of sapling, and a sapling is a plantable block', () => {
    expect(block('oak_leaves').drops.some((d) => d.item === 'oak_sapling')).toBe(true);
    expect(block('pine_leaves').drops.some((d) => d.item === 'pine_sapling')).toBe(true);
    expect(block('oak_sapling').placeOn).toContain('grass');
  });

  it('ice melts into a pail of water', () => {
    expect(RECIPES.some((r) => r.output.item === 'water_pail' && r.inputs.some((i) => i.item === 'ice'))).toBe(true);
  });
});
