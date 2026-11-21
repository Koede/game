import { describe, expect, it } from 'vitest';
import { block } from '../core/registry';
import type { Slot } from '../core/types';
import { makeStack } from './inventory';
import { UNDER_TIER_SLOWDOWN, canHarvest, canMine, effectiveTier, harvest, miningTime, rollDrops, toolMatches, wear } from './mining';

const held = (item: string): Slot => makeStack(item, 1, 10);
/** An rng that replays the given values. */
const seq = (...values: number[]): (() => number) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('mining rules', () => {
  const stone = block('stone');
  const dirt = block('dirt');
  const log = block('oak_log');
  const iron = block('iron_ore');

  it('times mining by hardness, tool speed and the Well-Warmed bonus', () => {
    expect(miningTime(dirt, null, false)).toBeCloseTo(0.8);
    expect(miningTime(dirt, held('flint_shovel'), false)).toBeCloseTo(0.4);
    expect(miningTime(dirt, held('flint_shovel'), true)).toBeCloseTo(0.32);
    expect(miningTime(dirt, null, true)).toBeCloseTo(0.64);
    expect(miningTime(log, held('flint_axe'), false)).toBeCloseTo(1);
    expect(miningTime(stone, held('flint_pickaxe'), false)).toBeCloseTo(2);
    expect(miningTime(stone, held('steel_pickaxe'), false)).toBeCloseTo(4 / 6);
    // A non-tool item in hand is the same as bare hands.
    expect(miningTime(log, makeStack('plank', 3), false)).toBeCloseTo(2);
  });

  it('is three times slower and yields nothing below the block tier', () => {
    expect(UNDER_TIER_SLOWDOWN).toBe(3);
    expect(miningTime(stone, null, false)).toBeCloseTo(12);
    expect(canHarvest(stone, null)).toBe(false);
    // The wrong kind of tool counts as hands: tier 0, speed 1.
    expect(effectiveTier(stone, held('steel_axe'))).toBe(0);
    expect(miningTime(stone, held('steel_axe'), false)).toBeCloseTo(12);
    expect(canHarvest(stone, held('steel_axe'))).toBe(false);
    expect(canHarvest(stone, held('flint_pickaxe'))).toBe(true);
    expect(canHarvest(iron, held('flint_pickaxe'))).toBe(false);
    expect(miningTime(iron, held('flint_pickaxe'), false)).toBeCloseTo((7 / 2) * 3);
    expect(canHarvest(iron, held('bronze_pickaxe'))).toBe(true);
    expect(miningTime(iron, held('bronze_pickaxe'), false)).toBeCloseTo(7 / 3);
    expect(harvest(iron, held('flint_pickaxe'), seq(0))).toEqual([]);
    expect(harvest(iron, held('bronze_pickaxe'), seq(0))).toEqual([{ item: 'iron_ore', count: 1 }]);
    expect(canHarvest(block('pitchblende'), held('steel_pickaxe'))).toBe(false);
    expect(canHarvest(block('pitchblende'), held('power_drill'))).toBe(true);
  });

  it('treats the power drill as every tool at once', () => {
    const drill = held('power_drill');
    expect(toolMatches(dirt, drill)).toBe(true);
    expect(toolMatches(block('oak_leaves'), drill)).toBe(true);
    expect(miningTime(dirt, drill, false)).toBeCloseTo(0.08);
    expect(miningTime(log, drill, false)).toBeCloseTo(0.2);
    expect(effectiveTier(stone, drill)).toBe(5);
    expect(wear(dirt, drill)).toBe(1);
  });

  it('cannot mine unbreakable blocks', () => {
    for (const key of ['lava', 'water', 'corestone']) {
      const b = block(key);
      expect(canMine(b)).toBe(false);
      expect(miningTime(b, held('power_drill'), true)).toBe(Infinity);
      expect(canHarvest(b, held('power_drill'))).toBe(false);
      expect(wear(b, held('power_drill'))).toBe(0);
    }
  });

  it('rolls drop tables with chances and ranges', () => {
    expect(rollDrops(stone, seq(0.5))).toEqual([{ item: 'rubble', count: 1 }]);
    const gravel = block('gravel');
    expect(rollDrops(gravel, seq(0.1))).toEqual([{ item: 'gravel', count: 1 }, { item: 'flint', count: 1 }]);
    expect(rollDrops(gravel, seq(0.25))).toEqual([{ item: 'gravel', count: 1 }]);
    const coal = block('coal_ore');
    expect(rollDrops(coal, seq(0))).toEqual([{ item: 'coal', count: 1 }]);
    expect(rollDrops(coal, seq(0.49))).toEqual([{ item: 'coal', count: 1 }]);
    expect(rollDrops(coal, seq(0.5))).toEqual([{ item: 'coal', count: 2 }]);
    expect(rollDrops(coal, seq(0.999))).toEqual([{ item: 'coal', count: 2 }]);
    expect(rollDrops(block('corium'), seq(0))).toEqual([]);
    const leaves = block('oak_leaves');
    expect(rollDrops(leaves, seq(0.9))).toEqual([]);
    expect(rollDrops(leaves, seq(0.2, 0.1))).toEqual([{ item: 'fiber', count: 1 }, { item: 'stick', count: 1 }]);
  });

  it('wears only a tool that matches the block', () => {
    expect(wear(stone, held('flint_pickaxe'))).toBe(1);
    expect(wear(stone, held('flint_axe'))).toBe(0);
    expect(wear(stone, null)).toBe(0);
    expect(wear(stone, makeStack('plank', 1))).toBe(0);
    expect(wear(block('oak_leaves'), held('flint_axe'))).toBe(0);
  });
});
