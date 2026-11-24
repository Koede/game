import { describe, expect, it } from 'vitest';
import { SEASON_DAYS } from './festival';
import { SWIM_SPOTS, chooseOutfit, coolOffAt, inPool, type OutfitState } from './outfits';
import { NPCS } from './data';
import { layoutBlocks, POOL } from './tavern';
import { walkable, findPath } from './nav';

const base: OutfitState = { phase: 'day', inWater: false, dancing: false, hired: false };

describe('outfits', () => {
  it('sleepwear only at night, day clothes otherwise', () => {
    expect(chooseOutfit({ ...base, phase: 'night' })).toBe('sleep');
    for (const phase of ['morning', 'day', 'evening'] as const) expect(chooseOutfit({ ...base, phase })).toBe('day');
  });
  it('swimwear in the water, even at night', () => {
    expect(chooseOutfit({ ...base, inWater: true })).toBe('swim');
    expect(chooseOutfit({ ...base, inWater: true, phase: 'night' })).toBe('swim');
  });
  it('dancing and hired people keep their day clothes; a party overrides everything', () => {
    expect(chooseOutfit({ ...base, phase: 'night', dancing: true })).toBe('day');
    expect(chooseOutfit({ ...base, phase: 'night', hired: true })).toBe('day');
    expect(chooseOutfit({ ...base, inWater: true, dancing: true })).toBe('day');
    expect(chooseOutfit({ ...base, dancing: true, party: true })).toBe('swim');
    expect(chooseOutfit({ ...base, hired: true, phase: 'night', party: true })).toBe('swim');
  });
  it('is deterministic', () => {
    const s = { ...base, phase: 'night' as const };
    expect(chooseOutfit(s)).toBe(chooseOutfit({ ...s }));
  });
  it('cools off only on hot midday hours of the warm season, never on the festival day', () => {
    const bloom = SEASON_DAYS + 3; // second season, not its last day
    expect(coolOffAt(bloom, 0.25)).toBe(true);
    expect(coolOffAt(bloom, 0.5)).toBe(false);
    expect(coolOffAt(3, 0.25)).toBe(false);
    expect(coolOffAt(SEASON_DAYS * 2, 0.25)).toBe(false);
  });
});

describe('the yard pool', () => {
  const blocks = layoutBlocks();
  it('is 3 x 3 water in the floor layer with a brick kerb, and every swim spot is in it and reachable', () => {
    const at = (x: number, z: number) => [...blocks].reverse().find((b) => b.x === x && b.y === 0 && b.z === z)?.block;
    let water = 0;
    for (let x = POOL.x0; x <= POOL.x1; x++) for (let z = POOL.z0; z <= POOL.z1; z++) if (at(x, z) === 'water') water++;
    expect(water).toBe(9);
    expect(at(POOL.x1 + 1, POOL.z0)).toBe('stone_brick');
    expect(at(POOL.x0, POOL.z0 - 1)).toBe('stone_brick');
    for (const n of NPCS.filter((p) => p.kind === 'person')) {
      const s = SWIM_SPOTS[n.id];
      expect(s, n.id).toBeTruthy();
      expect(inPool(s[0], s[2])).toBe(true);
      expect(walkable(Math.floor(s[0]), Math.floor(s[2]))).toBe(true);
      expect(findPath([4, 6], [Math.floor(s[0]), Math.floor(s[2])]), n.id).not.toBeNull();
    }
  });
});
