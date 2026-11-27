import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FakeWorld } from './fakeWorld';
import { FallenLogs, LOG_LIFE_S, LOG_WARN_S, aimFallen, fallenTip, rodAxis, type FallenLog } from './fallenLogs';
import { PlayerState } from './playerState';

/** A log lying along +x from (10, 0.5, 10), the trunk reaching `length` blocks. */
const lying = (length: number) => ({
  logKey: 'oak_log',
  length,
  ox: 10,
  oy: 0.5,
  oz: 10.5,
  dx: 1,
  dz: 0,
  theta: Math.PI / 2,
});

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  const logs = new FallenLogs(world);
  const player = new PlayerState(bus, { x: 0.5, y: 1, z: 0.5 });
  const never = () => false;
  return { bus, world, logs, player, never };
}

describe('a fallen log', () => {
  it('lies along its fall direction, its tip at the far end of the remaining length', () => {
    const log = { ...lying(6), id: 1, original: 6, age: 0, warned: false } as FallenLog;
    const tip = fallenTip(log);
    expect(tip.x).toBeCloseTo(16, 6);
    expect(tip.y).toBeCloseTo(0.5, 6);
    expect(rodAxis(log).ux).toBeCloseTo(1, 6);
  });

  it('is aimed at by a ray that passes through it, and not by one that misses', () => {
    const { logs } = rig();
    const log = logs.add(lying(6));
    const hit = aimFallen(logs.list(), { x: 12, y: 3, z: 10.5 }, { x: 0, y: -1, z: 0 }, 10);
    expect(hit?.log.id).toBe(log.id);
    expect(aimFallen(logs.list(), { x: 12, y: 3, z: 14 }, { x: 0, y: -1, z: 0 }, 10)).toBeNull();
  });
});

describe('cutting it into pieces', () => {
  it('each cut takes a piece off the tip and drops its logs; the last cut removes the log', () => {
    const { logs, player } = rig();
    const log = logs.add(lying(7));
    const rng = () => 0.5;
    const first = logs.cut(log.id, rng);
    expect(first?.take).toBe(3);
    expect(first?.gone).toBe(false);
    expect(logs.get(log.id)?.length).toBe(4);
    expect(first?.drops).toEqual([{ item: 'oak_log', count: 3 }]);
    expect(logs.cut(log.id, rng)?.take).toBe(3);
    const last = logs.cut(log.id, rng);
    expect(last?.take).toBe(1);
    expect(last?.gone).toBe(true);
    expect(logs.list()).toHaveLength(0);
    void player;
  });

  it('an unknown log cannot be cut', () => {
    const { logs } = rig();
    expect(logs.cut(99, () => 0.5)).toBeNull();
  });
});

describe('ageing and despawn', () => {
  it('warns before it goes and then goes, but only while it is loaded and not near a build', () => {
    const { logs, world, never } = rig();
    logs.add(lying(4));
    const events: string[] = [];
    let t = 0;
    while (t < LOG_LIFE_S + 1 && logs.list().length > 0) {
      for (const e of logs.tick(1, never)) events.push(e.kind);
      t += 1;
    }
    expect(events).toEqual(['warn', 'gone']);
    expect(t).toBeGreaterThanOrEqual(LOG_LIFE_S - LOG_WARN_S);
    void world;
  });

  it('never ages near a build (protected) and is frozen while its chunk is unloaded', () => {
    const { logs, world, never } = rig();
    const log = logs.add(lying(4));
    logs.tick(10, () => true);
    expect(log.age).toBe(0);
    (world as unknown as { isLoaded: () => boolean }).isLoaded = () => false;
    logs.tick(10, never);
    expect(log.age).toBe(0);
    expect(logs.list()).toHaveLength(1);
  });

  it('survives a save and load across a chunk unload with its age and cut length kept', () => {
    const { logs, world, never } = rig();
    const log = logs.add(lying(6));
    logs.cut(log.id, () => 0.5);
    logs.tick(100, never);
    const saved = JSON.parse(JSON.stringify(logs.toJSON()));
    (world as unknown as { isLoaded: () => boolean }).isLoaded = () => false;
    const fresh = new FallenLogs(world);
    fresh.load(saved);
    const again = fresh.list()[0];
    expect(again.length).toBe(3);
    expect(again.age).toBeCloseTo(100, 6);
    fresh.tick(1000, never);
    expect(fresh.list()[0].age).toBeCloseTo(100, 6);
  });

  it('skips damaged entries when loading, keeps the good ones', () => {
    const { world } = rig();
    const fresh = new FallenLogs(world);
    fresh.load([{ nope: true }, { ...lying(2), id: 5, original: 2, age: 0, warned: false }]);
    expect(fresh.list()).toHaveLength(1);
    fresh.load('not a list');
    expect(fresh.list()).toHaveLength(0);
  });
});
