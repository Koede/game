import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel, voxelId } from '../core/types';
import { FakeWorld } from './fakeWorld';
import { GROW_DAYS, Saplings, STUMP_REST_DAYS } from './saplings';

function plot() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-8, 9, -8, 8, 9, 8, 'grass');
  let day = 1;
  const s = new Saplings({ world, bus, day: () => day, rng: () => 0.01 });
  return { world, s, setDay: (d: number) => { day = d; s.tick(); } };
}

describe('saplings', () => {
  it('stands for three days, then becomes a log-and-leaf tree', () => {
    const t = plot();
    t.world.setVoxel(0, 10, 0, makeVoxel(blockId('oak_sapling')), 'player');
    expect(t.s.size).toBe(1);
    t.setDay(1 + GROW_DAYS - 1);
    expect(t.world.getBlock(0, 10, 0).key).toBe('oak_sapling');
    t.setDay(1 + GROW_DAYS);
    expect(t.world.getBlock(0, 10, 0).key).toBe('oak_log');
    expect(t.world.getBlock(0, 13, 0).key).toBe('oak_log');
    expect(t.world.getBlock(1, 13, 0).key).toBe('oak_leaves');
    expect(t.s.size).toBe(0);
  });

  it('a pine grows a pine', () => {
    const t = plot();
    t.world.setVoxel(0, 10, 0, makeVoxel(blockId('pine_sapling')), 'player');
    t.setDay(1 + GROW_DAYS);
    expect(t.world.getBlock(0, 12, 0).key).toBe('pine_log');
  });

  it('waits under a roof', () => {
    const t = plot();
    t.world.setVoxel(0, 10, 0, makeVoxel(blockId('oak_sapling')), 'player');
    t.world.setVoxel(0, 14, 0, makeVoxel(blockId('stone')), 'player');
    t.setDay(10);
    expect(t.world.getBlock(0, 10, 0).key).toBe('oak_sapling');
  });

  it('a broken sapling is forgotten', () => {
    const t = plot();
    t.world.setVoxel(0, 10, 0, makeVoxel(blockId('oak_sapling')), 'player');
    t.world.setVoxel(0, 10, 0, 0, 'player');
    expect(t.s.size).toBe(0);
  });

  it('a stump sprouts a sapling beside it after resting', () => {
    const t = plot();
    t.world.setVoxel(0, 10, 0, makeVoxel(blockId('oak_stump')), 'player');
    t.setDay(1 + STUMP_REST_DAYS - 1);
    let saplings = 0;
    const count = () => { saplings = 0; for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) if (voxelId(t.world.getVoxel(x, 10, z)) === blockId('oak_sapling')) saplings++; return saplings; };
    expect(count()).toBe(0);
    t.setDay(1 + STUMP_REST_DAYS);
    expect(count()).toBe(1);
  });

  it('saves and loads', () => {
    const t = plot();
    t.world.setVoxel(2, 10, 2, makeVoxel(blockId('pine_sapling')), 'player');
    const raw = JSON.parse(JSON.stringify(t.s.toJSON()));
    const u = plot();
    u.s.load(raw);
    expect(u.s.size).toBe(1);
  });
});
