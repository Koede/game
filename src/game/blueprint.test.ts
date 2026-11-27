import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { makeVoxel, voxelFacing } from '../core/types';
import { blockId } from '../core/registry';
import { BUILD_INTERVAL_S, BuildJob, FREE_SOURCE, MAX_BLUEPRINT_SIDE, captureBlueprint, checkSite, materialsOf, rotateBlueprint } from './blueprint';
import { FakeWorld } from './fakeWorld';
import { Inventory } from './inventory';

const house = (): FakeWorld => {
  const w = new FakeWorld(createBus());
  w.fill(0, 5, 0, 2, 5, 2, 'plank');
  w.fill(0, 6, 0, 2, 6, 0, 'stone');
  return w;
};

describe('blueprint mode', () => {
  it('captures a box without air and counts its materials', () => {
    const bp = captureBlueprint(house(), [2, 7, 2], [0, 5, 0], 'Hut')!;
    expect(bp.size).toEqual([3, 3, 3]);
    expect(bp.cells).toHaveLength(12);
    expect(materialsOf(bp)).toEqual([{ item: 'plank', count: 9 }, { item: 'stone', count: 3 }]);
    expect(captureBlueprint(new FakeWorld(createBus()), [0, 20, 0], [1, 21, 1])).toBeNull();
  });

  it('builders raise it bottom-up from a chest, wait when it runs dry, and finish after restocking', () => {
    const bp = captureBlueprint(house(), [0, 5, 0], [2, 6, 2])!;
    const target = new FakeWorld(createBus());
    const chest = new Inventory(8);
    chest.add('plank', 9);
    chest.add('stone', 1);
    const job = new BuildJob(bp, [10, 5, 10]);
    expect(job.tick(BUILD_INTERVAL_S * 2, target, chest, 1)).toBe(2);
    expect(target.getBlock(10, 5, 10).key).toBe('plank');
    job.tick(BUILD_INTERVAL_S * 20, target, chest, 1);
    expect(job.state).toBe('waiting');
    expect(job.missing).toBe('stone');
    expect(target.getBlock(10, 6, 10).key).toBe('stone');
    chest.add('stone', 5);
    job.resume();
    job.tick(BUILD_INTERVAL_S * 20, target, chest, 2);
    expect(job.state).toBe('done');
    expect(job.placed).toBe(12);
    expect(chest.count('plank')).toBe(0);
  });

  it('more builders are faster, occupied cells are skipped, and jobs save', () => {
    const bp = captureBlueprint(house(), [0, 5, 0], [2, 5, 2])!;
    const target = new FakeWorld(createBus());
    target.put(10, 5, 10, 'stone');
    const chest = new Inventory(8);
    chest.add('plank', 20);
    const job = new BuildJob(bp, [10, 5, 10]);
    job.tick(BUILD_INTERVAL_S * 2, target, chest, 3);
    expect(job.placed + job.skipped).toBe(6);
    const back = BuildJob.fromJSON(JSON.parse(JSON.stringify(job.toJSON())))!;
    expect(back.progress).toBeCloseTo(job.progress);
    back.tick(BUILD_INTERVAL_S * 30, target, chest, 3);
    expect(back.state).toBe('done');
    expect(target.getBlock(10, 5, 10).key).toBe('stone');
    expect(BuildJob.fromJSON(null)).toBeNull();
  });

  it('keeps machines (a crate is a block with an item) and refuses a box with a side over the limit', () => {
    const w = house();
    w.put(1, 5, 1, 'crate');
    const bp = captureBlueprint(w, [0, 5, 0], [2, 5, 2])!;
    expect(bp.cells.some((c) => c.block === 'crate' && c.item === 'crate')).toBe(true);
    expect(captureBlueprint(w, [0, 5, 0], [MAX_BLUEPRINT_SIDE, 5, 0])).toBeNull();
    const target = new FakeWorld(createBus());
    const chest = new Inventory(8);
    chest.add('plank', 9);
    chest.add('crate', 1);
    const job = new BuildJob(bp, [20, 5, 20]);
    job.tick(BUILD_INTERVAL_S * 30, target, chest, 2, 'player');
    expect(target.getBlock(21, 5, 21).key).toBe('crate');
    expect(job.state).toBe('done');
  });

  it('turns in quarter turns: the shape and facings follow, four turns come back', () => {
    const w = new FakeWorld(createBus());
    w.fill(0, 5, 0, 2, 5, 0, 'stone'); // a wall along x
    w.setVoxel(0, 6, 0, makeVoxel(blockId('crate'), 1), 'sim');
    const bp = captureBlueprint(w, [0, 5, 0], [2, 6, 0])!;
    const r = rotateBlueprint(bp, 1);
    expect(r.size).toEqual([1, 2, 3]);
    expect(new Set(r.cells.map((c) => `${c.dx},${c.dy},${c.dz}`)).size).toBe(bp.cells.length);
    const crate = r.cells.find((c) => c.block === 'crate')!;
    expect(crate.facing).toBe(2); // east turned clockwise is south
    expect(crate.dz).toBe(0);
    const back = rotateBlueprint(bp, 4);
    expect(back).toBe(bp);
    const full = rotateBlueprint(rotateBlueprint(rotateBlueprint(rotateBlueprint(bp, 1), 1), 1), 1);
    expect(full.cells.map((c) => `${c.dx},${c.dy},${c.dz},${c.facing}`).sort()).toEqual(bp.cells.map((c) => `${c.dx},${c.dy},${c.dz},${c.facing}`).sort());
    expect(voxelFacing(makeVoxel(1, 3))).toBe(3);
  });

  it('checkSite tells free, right and blocked cells; a free source never runs dry', () => {
    const bp = captureBlueprint(house(), [0, 5, 0], [2, 5, 0])!;
    const t = new FakeWorld(createBus());
    t.put(10, 5, 10, 'plank');
    t.put(11, 5, 10, 'stone');
    expect(checkSite(t, bp, [10, 5, 10]).map((c) => c.state)).toEqual(['right', 'blocked', 'free']);
    const job = new BuildJob(bp, [10, 5, 10]);
    job.tick(BUILD_INTERVAL_S * 10, t, FREE_SOURCE, 1);
    expect(t.getBlock(12, 5, 10).key).toBe('plank');
    expect(job.state).toBe('done');
  });
});
