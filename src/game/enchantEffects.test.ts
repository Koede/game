import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { DT } from '../core/constants';
import { FakeWorld } from './fakeWorld';
import { GameClock } from './clock';
import { breakVein, magnetRadius, planVein, veinCells, veinSize } from './enchantEffects';
import { clearLine, MAGNET_ENCHANT_PULL } from './groundItems';
import { makeEnchantedStack } from './inventory';
import { rollDrops } from './mining';
import { PlayerState } from './playerState';
import { Survival } from './survival';

const rng = (): number => 0.5;

function rig(tool: string, enchants: Record<string, number>, durability?: number) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-8, 9, -8, 8, 9, 8, 'stone');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const held = makeEnchantedStack(tool, enchants);
  if (durability !== undefined) held.durability = durability;
  player.inventory.set(player.selectedSlot, held);
  return { bus, world, player, held };
}

describe('Veinseeker sizes', () => {
  it('3 / 6 / 10 by level, 0 without', () => {
    expect([1, 2, 3].map((l) => veinSize(makeEnchantedStack('iron_pickaxe', { veinseeker: l })))).toEqual([3, 6, 10]);
    expect(veinSize(makeEnchantedStack('iron_pickaxe', {}))).toBe(0);
    expect(veinSize(null)).toBe(0);
  });
});

describe('vein search', () => {
  it('takes connected ore of the same kind up to the cap, nearest first, not other ores', () => {
    const { world, held } = rig('iron_pickaxe', { veinseeker: 3 });
    for (let i = 0; i < 15; i++) world.put(i - 7, 10, 0, 'coal_ore');
    world.put(-7, 11, 3, 'coal_ore'); // not connected
    world.put(1, 10, 1, 'copper_ore'); // other kind beside the line
    const cells = veinCells(world, held, 0, 10, 0, 10);
    expect(cells).toHaveLength(10);
    expect(cells.every((c) => world.getBlock(c.x, c.y, c.z).key === 'coal_ore')).toBe(true);
    expect(Math.abs(cells[0].x)).toBe(1);
    expect(veinCells(world, held, 0, 10, 0, 3)).toHaveLength(3);
    expect(veinCells(world, held, 0, 10, 0, 0)).toEqual([]);
  });

  it('respects the tier gate: a pick that cannot harvest the ore takes no vein', () => {
    const { world } = rig('iron_pickaxe', {});
    for (let i = 0; i < 5; i++) world.put(i, 10, 0, 'quartz_ore'); // needs tier 3
    const wood = makeEnchantedStack('wooden_pickaxe', { veinseeker: 3 });
    expect(veinCells(world, wood, 0, 10, 0, 10)).toEqual([]);
    const iron = makeEnchantedStack('iron_pickaxe', { veinseeker: 3 });
    expect(veinCells(world, iron, 0, 10, 0, 10)).toHaveLength(4);
    const bronze = makeEnchantedStack('bronze_pickaxe', { veinseeker: 3 });
    expect(veinCells(world, bronze, 0, 10, 0, 10)).toEqual([]);
    // Non-ore blocks never form a vein.
    expect(veinCells(world, iron, 0, 9, 0, 10)).toEqual([]);
  });

  it('breaks the planned vein with normal drops and one durability per block', () => {
    const { world, player, held } = rig('iron_pickaxe', { veinseeker: 2 });
    for (let i = 0; i < 9; i++) world.put(i, 10, 0, 'coal_ore');
    const before = held.durability!;
    const plan = planVein(world, player, 0, 10, 0);
    expect(plan).toHaveLength(6);
    const n = breakVein(world, player, plan, rng, rollDrops);
    expect(n).toBe(6);
    expect(world.getBlock(6, 10, 0).key).toBe('air');
    expect(world.getBlock(7, 10, 0).key).toBe('coal_ore');
    expect(player.heldStack()?.durability).toBe(before - 6);
    expect(player.ground.count('coal')).toBeGreaterThanOrEqual(6);
  });

  it('never wears the tool out: capped by durability', () => {
    const { world, player } = rig('iron_pickaxe', { veinseeker: 3 }, 4);
    for (let i = 0; i < 12; i++) world.put(i, 10, 0, 'coal_ore');
    expect(planVein(world, player, 0, 10, 0)).toHaveLength(2);
  });

  it('is plain without the enchant', () => {
    const { world, player } = rig('iron_pickaxe', {});
    for (let i = 0; i < 5; i++) world.put(i, 10, 0, 'coal_ore');
    expect(planVein(world, player, 0, 10, 0)).toEqual([]);
  });
});

describe('Magnet', () => {
  it('radius 3 / 5 / 7 by level', () => {
    expect([1, 2, 3].map((l) => magnetRadius(makeEnchantedStack('iron_pickaxe', { magnet: l })))).toEqual([3, 5, 7]);
    expect(magnetRadius(makeEnchantedStack('iron_pickaxe', {}))).toBe(0);
  });

  it('line of sight stops at walls', () => {
    const world = new FakeWorld();
    world.fill(-12, 9, -12, 12, 9, 12, 'stone');
    expect(clearLine(world, 4, 10.2, 0.5, 0.5, 10.8, 0.5)).toBe(true);
    world.fill(2, 10, -3, 2, 12, 3, 'stone');
    expect(clearLine(world, 4, 10.2, 0.5, 0.5, 10.8, 0.5)).toBe(false);
    expect(MAGNET_ENCHANT_PULL).toBeGreaterThan(0);
  });

  function pull(withWall: boolean, radius: number, dist: number): number {
    const bus = createBus();
    const world = new FakeWorld(bus);
    world.fill(-12, 9, -12, 12, 9, 12, 'stone');
    const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
    if (withWall) world.fill(2, 10, -3, 2, 12, 3, 'stone');
    const survival = new Survival(world, player, new GameClock(bus, 0.3), () => 'woodland');
    player.drop('coal', 1, undefined, { x: 0.5 + dist, y: 10.2, z: 0.5 }, radius);
    player.ground.items[0].delayS = 0;
    player.ground.items[0].vx = player.ground.items[0].vy = player.ground.items[0].vz = 0;
    for (let i = Math.round(3 / DT); i > 0; i--) survival.tick(DT);
    return player.inventory.count('coal');
  }

  it('a Magnet drop flies in from inside its radius, not from outside it', () => {
    expect(pull(false, 5, 4.5)).toBe(1);
    expect(pull(false, 3, 4.5)).toBe(0);
    expect(pull(false, 0, 4.5)).toBe(0);
  });

  it('never through a wall', () => {
    expect(pull(true, 7, 4.5)).toBe(0);
  });
});
