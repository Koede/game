import { describe, expect, it } from 'vitest';
import { DT, MAX_WARMTH } from '../core/constants';
import { createBus } from '../core/context';
import type { BiomeKey } from '../core/types';
import { GameClock } from './clock';
import { FakeWorld } from './fakeWorld';
import { HELD_WARM_ITEMS, heldWarms } from './heldWarmth';
import { PlayerState } from './playerState';
import { Survival } from './survival';

function night() {
  const bus = createBus();
  const world = new FakeWorld();
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const survival = new Survival(world, player, new GameClock(bus, 0.8), () => 'woodland' as BiomeKey);
  const run = (s: number): void => {
    for (let i = Math.round(s / DT); i > 0; i--) survival.tick(DT);
  };
  return { player, survival, run };
}

describe('warm things in the hand', () => {
  it('names the torch and the boiling vessels, nothing else', () => {
    for (const k of ['torch', 'boiling_pail', 'boiling_beaker', 'boiling_vial']) expect(heldWarms({ item: k, count: 1 }), k).toBe(true);
    expect(heldWarms({ item: 'water_pail', count: 1 })).toBe(false);
    expect(heldWarms(null)).toBe(false);
    expect(HELD_WARM_ITEMS.size).toBe(4);
  });

  it('a held torch stops the night cold and warms back up; an unselected one does not', () => {
    const cold = night();
    cold.player.warmth = 50;
    cold.player.give('torch');
    cold.player.selectSlot(8); // the torch sits in slot 0
    cold.run(10);
    expect(cold.player.warmth).toBeLessThan(50);

    const warm = night();
    warm.player.warmth = 50;
    warm.player.give('torch');
    warm.player.selectSlot(0);
    warm.run(10);
    expect(warm.player.warmth).toBeGreaterThan(50);
    expect(warm.survival.inHeat).toBe(true);
    warm.player.warmth = MAX_WARMTH;
  });

  it('a boiling pail in hand warms too', () => {
    const t = night();
    t.player.warmth = 50;
    t.player.inventory.set(0, { item: 'boiling_pail', count: 1, durability: 100 });
    t.player.selectSlot(0);
    t.run(5);
    expect(t.player.warmth).toBeGreaterThan(50);
  });
});
