import { describe, expect, it } from 'vitest';
import { ITEMS } from '../core/registry';
import {
  TREASURE_OFFSET_MAX, TREASURE_OFFSET_MIN, TREASURE_POOLS, compassWord, makeTreasureMap, nearTreasure, treasureClue, treasureHint,
  type Landmark,
} from './treasure';

const LM: Landmark[] = [
  { id: 'a', name: 'the Old Works', x: 100, z: -40 },
  { id: 'b', name: 'the Glass Cave', x: -300, z: 220 },
];

describe('treasure maps', () => {
  it('is a pure function of seed, serial and age', () => {
    expect(makeTreasureMap(7, 3, 1, LM)).toEqual(makeTreasureMap(7, 3, 1, LM));
    expect(makeTreasureMap(7, 3, 1, LM)).not.toEqual(makeTreasureMap(7, 4, 1, LM));
    expect(makeTreasureMap(1, 1, 0, [])).toBeNull();
  });

  it('buries the chest 6-22 blocks from its landmark and agrees with the clue', () => {
    for (let s = 0; s < 60; s++) {
      const m = makeTreasureMap(42, s, 2, LM)!;
      const d = Math.hypot(m.x - m.landmark.x, m.z - m.landmark.z);
      expect(d).toBeGreaterThanOrEqual(TREASURE_OFFSET_MIN - 1);
      expect(d).toBeLessThanOrEqual(TREASURE_OFFSET_MAX + 1);
      expect(m.compass).toBe(compassWord(m.landmark.x, m.landmark.z, m.x, m.z));
      expect(treasureClue(m)).toContain(m.landmark.name);
    }
  });

  it('only rewards real items, at least two kinds, and pays more with age', () => {
    const keys = new Set(ITEMS.map((i) => i.key));
    for (const pool of TREASURE_POOLS) for (const p of pool) expect(keys.has(p.item), p.item).toBe(true);
    let low = 0;
    let high = 0;
    for (let s = 0; s < 40; s++) {
      const a = makeTreasureMap(5, s, 0, LM)!;
      const b = makeTreasureMap(5, s, 5, LM)!;
      expect(a.loot.length).toBeGreaterThanOrEqual(2);
      expect(b.loot.length).toBeGreaterThanOrEqual(2);
      low += a.loot.reduce((n, p) => n + p.count, 0);
      high += b.loot.reduce((n, p) => n + p.count, 0);
    }
    expect(high).toBeGreaterThan(low);
    expect(makeTreasureMap(5, 1, 99, LM)!.age).toBe(5);
  });

  it('guides the finder', () => {
    const m = makeTreasureMap(9, 1, 0, LM)!;
    expect(nearTreasure(m, m.x + 1, m.z)).toBe(true);
    expect(nearTreasure(m, m.x + 30, m.z)).toBe(false);
    expect(treasureHint(m, m.x, m.z)).toMatch(/Dig/);
    expect(treasureHint(m, m.x + 200, m.z)).toMatch(/west, cold/);
  });
});
