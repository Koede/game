import { describe, expect, it } from 'vitest';
import { block } from '../core/registry';

describe('glue audit content', () => {
  it('leaves can drop their own species of sapling, and a sapling is a plantable block', () => {
    expect(block('oak_leaves').drops.some((d) => d.item === 'oak_sapling')).toBe(true);
    expect(block('pine_leaves').drops.some((d) => d.item === 'pine_sapling')).toBe(true);
    expect(block('oak_sapling').placeOn).toContain('grass');
  });
});
