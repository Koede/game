// @ts-expect-error the game's tsconfig carries no node types; vitest runs on node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeEnchantedStack, makeStack } from '../../../game/inventory';
import { itemCard, slotView } from './slotViews';

describe('enchant display', () => {
  it('tooltip card lists each enchant in its colour with its aspect', () => {
    const card = itemCard(makeEnchantedStack('iron_pickaxe', { veinseeker: 2 }));
    expect(card.lines).toEqual([expect.objectContaining({ text: 'Veinseeker II', aspect: 'vein', colour: expect.stringMatching(/^#/) })]);
    expect(itemCard(makeStack('iron_pickaxe', 1, 10)).lines).toBeUndefined();
  });

  it('slot views flag enchanted stacks for the shimmer', () => {
    expect(slotView(makeEnchantedStack('iron_pickaxe', { magnet: 1 }))?.enchanted).toBe(true);
    expect(slotView(makeStack('iron_pickaxe', 1, 10))?.enchanted).toBeUndefined();
  });

  it('the shimmer is switched off under reduce motion', () => {
    const css = readFileSync('src/ui/styles.css', 'utf8');
    expect(css).toMatch(/\.hw-slot\[data-enchanted\]::before/);
    expect(css).toMatch(/\[data-reduce-motion\] \.hw-slot\[data-enchanted\]::before \{\s*animation: none;\s*background: none;/);
  });
});
