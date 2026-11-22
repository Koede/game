import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { AIR, type ItemAmount } from '../core/types';
import { FakeWorld } from './fakeWorld';
import { popUnsupportedAt } from './farming';
import { record } from '../player/testKit';

describe('popUnsupportedAt: a plant left on nothing pops, dropping what it would', () => {
  const setup = () => {
    const bus = createBus();
    const world = new FakeWorld();
    world.fill(-2, 0, -2, 2, 9, 2, 'stone');
    world.put(0, 10, 0, 'farmland');
    world.put(0, 11, 0, 'wheat_3');
    const drops: Array<{ items: unknown[]; at: { x: number; y: number; z: number } }> = [];
    const sounds = record(bus, 'sfx');
    return { bus, world, drops, sounds, drop: (items: ItemAmount[], at: { x: number; y: number; z: number }) => drops.push({ items, at }) };
  };

  it('pops a wheat plant whose farmland was removed by something other than the player', () => {
    const { bus, world, drops, sounds, drop } = setup();
    world.setVoxel(0, 10, 0, AIR, 'sim');
    const voxel = popUnsupportedAt(world, bus, 0, 11, 0, () => 0.5, drop, 'sim');
    expect(voxel).not.toBeNull();
    expect(world.getBlock(0, 11, 0).key).toBe('air');
    expect(drops).toHaveLength(1);
    expect(drops[0].at).toEqual({ x: 0.5, y: 11.5, z: 0.5 });
    expect(sounds.length).toBeGreaterThan(0);
  });

  it('pops nothing while the farmland is still there', () => {
    const { bus, world, drops, drop } = setup();
    expect(popUnsupportedAt(world, bus, 0, 11, 0, () => 0.5, drop, 'sim')).toBeNull();
    expect(world.getBlock(0, 11, 0).key).toBe('wheat_3');
    expect(drops).toHaveLength(0);
  });

  it('pops nothing when there is no plant at the cell', () => {
    const { bus, world, drops, drop } = setup();
    expect(popUnsupportedAt(world, bus, 0, 9, 0, () => 0.5, drop, 'sim')).toBeNull();
    expect(drops).toHaveLength(0);
  });
});
