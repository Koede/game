import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { BUILD_INTERVAL_S, BuildJob, captureBlueprint, materialsOf } from './blueprint';
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
});
