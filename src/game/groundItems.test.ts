import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FakeWorld } from './fakeWorld';
import { DESPAWN_S, DROP_DELAY_S, GroundItems, MAX_GROUND_ITEMS, PICKUP_RADIUS } from './groundItems';
import { PlayerState } from './playerState';

function setup(spawn = { x: 0.5, y: 5, z: 0.5 }) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-20, 0, -20, 20, 4, 20, 'stone');
  const player = new PlayerState(bus, spawn);
  const ground = new GroundItems(bus, () => 0.5);
  const run = (seconds: number, collectors: Parameters<GroundItems['tick']>[3] = []): void => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) ground.tick(0.05, world, player, collectors);
  };
  return { bus, world, player, ground, run };
}

describe('GroundItems', () => {
  it('falls and comes to rest on the ground', () => {
    const { ground, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    const [e] = ground.spawn('coal', 1, 0.5, 9, 0.5, { scatter: false });
    run(2);
    expect(e.y).toBeCloseTo(5, 1);
    expect(e.onGround).toBe(true);
    expect(e.vy).toBe(0);
  });

  it('rests on a slab at its top and falls again when the block under it is removed', () => {
    const { ground, world, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    world.put(0, 5, 0, 'solar_panel');
    const slab = world.getBlock(0, 5, 0);
    const top = 5 + (slab.shape === 'slab' ? 0.5 : 1);
    const [e] = ground.spawn('coal', 1, 0.5, 8, 0.5, { scatter: false });
    run(2);
    expect(e.y).toBeCloseTo(top, 1);
    world.setVoxel(0, 5, 0, 0);
    world.setVoxel(0, 4, 0, 0);
    run(2);
    expect(e.y).toBeCloseTo(4, 1);
  });

  it('is taken by a player in reach after its pickup delay, and adds to the pack', () => {
    const { ground, player, run } = setup();
    ground.spawn('coal', 3, 0.5, 5, 1.5, { scatter: false, delayS: 1 });
    run(0.5);
    expect(ground.count('coal')).toBe(3); // still delayed
    run(2);
    expect(ground.size).toBe(0);
    expect(player.inventory.count('coal')).toBe(3);
  });

  it('leaves items out of reach alone', () => {
    const { ground, player, run } = setup();
    ground.spawn('coal', 1, 8.5, 5, 0.5, { scatter: false, delayS: 0 });
    run(3);
    expect(ground.size).toBe(1);
    expect(player.inventory.count('coal')).toBe(0);
    expect(PICKUP_RADIUS).toBeLessThan(8);
  });

  it('a full pack leaves them on the ground; a partly full one takes what fits', () => {
    const { ground, player, run } = setup();
    for (let i = 0; i < player.inventory.size; i++) player.inventory.set(i, { item: 'stick', count: 99 });
    ground.spawn('coal', 5, 0.5, 5, 1.5, { scatter: false, delayS: 0 });
    run(3);
    expect(ground.count('coal')).toBe(5);
    player.inventory.set(0, { item: 'coal', count: 98 });
    run(3);
    expect(player.inventory.count('coal')).toBe(99);
    expect(ground.count('coal')).toBe(4);
  });

  it('merges identical resting stacks that lie together, up to the stack limit', () => {
    const { ground, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    ground.spawn('coal', 40, 0.5, 5, 0.5, { scatter: false });
    ground.spawn('coal', 40, 0.9, 5, 0.5, { scatter: false });
    ground.spawn('coal', 40, 0.7, 5, 0.9, { scatter: false });
    run(2);
    expect(ground.count('coal')).toBe(120);
    expect(ground.size).toBe(2);
    expect(Math.max(...ground.items.map((e) => e.count))).toBe(99);
  });

  it('does not merge different items or tools with wear', () => {
    const { ground, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    ground.spawn('coal', 1, 0.5, 5, 0.5, { scatter: false });
    ground.spawn('stick', 1, 0.6, 5, 0.5, { scatter: false });
    ground.spawn('flint_pickaxe', 1, 0.5, 5, 0.6, { scatter: false, durability: 10 });
    ground.spawn('flint_pickaxe', 1, 0.6, 5, 0.6, { scatter: false, durability: 20 });
    run(2);
    expect(ground.size).toBe(4);
  });

  it('splits a big count into stacks', () => {
    const { ground } = setup();
    ground.spawn('coal', 250, 0.5, 5, 0.5, { scatter: false });
    expect(ground.items.map((e) => e.count).sort()).toEqual([52, 99, 99]);
  });

  it('despawns after five minutes', () => {
    const { ground, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    ground.spawn('coal', 1, 0.5, 5, 0.5, { scatter: false });
    for (let t = 0; t < DESPAWN_S - 5; t += 0.25) ground.tick(0.25, new FakeWorld(), { position: { x: 99, y: 5, z: 99 }, dead: true, inventory: { space: () => 0 }, give: () => 0 });
    expect(ground.size).toBe(1);
    run(0);
    for (let t = 0; t < 10; t += 0.25) ground.tick(0.25, new FakeWorld(), { position: { x: 99, y: 5, z: 99 }, dead: true, inventory: { space: () => 0 }, give: () => 0 });
    expect(ground.size).toBe(0);
  });

  it('caps the entities: the oldest is merged into a neighbour or removed', () => {
    const { ground } = setup();
    const first = ground.spawn('coal', 1, 0.5, 5, 0.5, { scatter: false })[0];
    first.age = 100;
    for (let i = 0; i < MAX_GROUND_ITEMS; i++) ground.spawn('stick', 1, i % 16, 5, Math.floor(i / 16), { scatter: false });
    expect(ground.size).toBe(MAX_GROUND_ITEMS);
    expect(ground.items.includes(first)).toBe(false); // the oldest went
    // an old stick merges into a stick neighbour instead of vanishing
    const total = ground.count('stick');
    ground.items[0].age = 50;
    ground.spawn('coal', 1, 0.5, 5, 0.5, { scatter: false });
    expect(ground.count('stick')).toBe(total);
  });

  it('is not taken while the player is dead, and a hitch does not throw items through the floor', () => {
    const { ground, player, world } = setup();
    player.dead = true;
    ground.spawn('coal', 1, 0.5, 5, 1.5, { scatter: false, delayS: 0 });
    ground.tick(0.05, world, player);
    expect(ground.size).toBe(1);
    const [e] = ground.spawn('stick', 1, 3.5, 9, 3.5, { scatter: false, vy: -24 });
    ground.tick(5, world, player);
    expect(e.y).toBeGreaterThanOrEqual(5);
  });

  it('lifts an item out of a block placed on it', () => {
    const { ground, world, run } = setup({ x: 15.5, y: 5, z: 15.5 });
    const [e] = ground.spawn('coal', 1, 0.5, 5, 0.5, { scatter: false });
    run(1);
    world.put(0, 5, 0, 'stone');
    run(1);
    expect(e.y).toBeGreaterThanOrEqual(6);
  });

  it('saves and loads, dropping unknown items and bad numbers', () => {
    const { ground } = setup();
    ground.spawn('coal', 7, 1.25, 5, 2.5, { scatter: false, delayS: 1.5 });
    ground.spawn('flint_pickaxe', 1, 3, 5, 3, { scatter: false, durability: 12 });
    const saved = JSON.parse(JSON.stringify(ground.toJSON()));
    const again = new GroundItems();
    again.load([...saved, { item: 'nonsense', count: 1, x: 0, y: 0, z: 0, age: 0 }, { item: 'coal', count: 1, x: NaN, y: 0, z: 0, age: 0 }, null as never]);
    expect(again.size).toBe(2);
    expect(again.count('coal')).toBe(7);
    expect(again.items.find((e) => e.item === 'flint_pickaxe')?.durability).toBe(12);
    expect(again.items.find((e) => e.item === 'coal')?.delayS).toBeCloseTo(1.5);
    again.load(undefined);
    expect(again.size).toBe(0);
  });

  it('plays a pickup sound', () => {
    const { ground, bus, run } = setup();
    const names: string[] = [];
    bus.on('sfx', (e) => names.push(e.name));
    ground.spawn('coal', 1, 0.5, 5, 1.5, { scatter: false, delayS: 0 });
    run(1);
    expect(names).toContain('pickup');
    expect(DROP_DELAY_S).toBeGreaterThan(0);
  });
});
